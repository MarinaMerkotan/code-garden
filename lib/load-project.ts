"use client";

import {
  extensionOf,
  isIgnoredPath,
  normalizePath,
  type GitHubProjectSource,
  type RawProject,
  type RawProjectFile,
} from "@/lib/project";

export interface LoadProgress {
  stage: "reading" | "mapping" | "detecting" | "dependencies" | "layout" | "building";
  label: string;
  detail?: string;
}

export type ProgressReporter = (progress: LoadProgress) => void;

const TEXT_EXTENSIONS = new Set([
  "ts", "tsx", "js", "jsx", "mjs", "cjs", "json", "jsonc", "css", "scss", "sass",
  "less", "md", "mdx", "html", "htm", "vue", "svelte", "py", "rb", "go", "rs", "java",
  "kt", "kts", "swift", "php", "c", "cc", "cpp", "h", "hpp", "cs", "sh", "bash", "zsh",
  "yml", "yaml", "toml", "xml", "graphql", "gql", "sql", "txt", "env", "gitignore",
]);

const MAX_TEXT_FILE_BYTES = 1_500_000;
const MAX_GITHUB_CONTENT_FILES = 360;

function shouldReadText(path: string, size: number) {
  if (size > MAX_TEXT_FILE_BYTES) return false;
  const name = path.slice(path.lastIndexOf("/") + 1).toLowerCase();
  return TEXT_EXTENSIONS.has(extensionOf(path))
    || ["dockerfile", "makefile", "license", "readme", "tsconfig.json", "jsconfig.json"].includes(name);
}

async function responseError(response: Response) {
  try {
    const body = (await response.json()) as { error?: string };
    return body.error ?? `Request failed (${response.status}).`;
  } catch {
    return `Request failed (${response.status}).`;
  }
}

export async function loadGitHubProject(
  owner: string,
  repo: string,
  report: ProgressReporter,
): Promise<RawProject> {
  report({ stage: "reading", label: "Reading repository…", detail: `${owner}/${repo}` });
  const metadataResponse = await fetch(
    `/api/github/meta?owner=${encodeURIComponent(owner)}&repo=${encodeURIComponent(repo)}`,
  );
  if (!metadataResponse.ok) throw new Error(await responseError(metadataResponse));
  const metadata = (await metadataResponse.json()) as {
    name: string;
    fullName: string;
    defaultBranch: string;
  };

  report({
    stage: "mapping",
    label: "Downloading project tree…",
    detail: `${metadata.fullName} · ${metadata.defaultBranch}`,
  });
  const treeResponse = await fetch(
    `/api/github/tree?owner=${encodeURIComponent(owner)}&repo=${encodeURIComponent(repo)}&branch=${encodeURIComponent(metadata.defaultBranch)}`,
  );
  if (!treeResponse.ok) throw new Error(await responseError(treeResponse));
  const tree = (await treeResponse.json()) as {
    files: Array<{ path: string; size: number; sha: string }>;
  };
  const files: RawProjectFile[] = tree.files
    .map((file) => ({ path: normalizePath(file.path), size: file.size }))
    .filter((file) => file.path && !isIgnoredPath(file.path));

  if (!files.length) throw new Error("The repository tree did not contain readable project files.");
  report({ stage: "mapping", label: "Mapping file structure…", detail: `${files.length.toLocaleString()} real files` });

  const contentCandidates = files
    .filter((file) => shouldReadText(file.path, file.size))
    .sort((left, right) => contentPriority(left.path) - contentPriority(right.path) || left.path.localeCompare(right.path))
    .slice(0, MAX_GITHUB_CONTENT_FILES);

  for (let start = 0; start < contentCandidates.length; start += 12) {
    const batch = contentCandidates.slice(start, start + 12);
    await Promise.all(batch.map(async (file) => {
      const rawPath = file.path.split("/").map(encodeURIComponent).join("/");
      const url = `https://raw.githubusercontent.com/${encodeURIComponent(owner)}/${encodeURIComponent(repo)}/${encodeURIComponent(metadata.defaultBranch)}/${rawPath}`;
      const response = await fetch(url);
      if (response.ok) file.content = await response.text();
    }));
    report({
      stage: "detecting",
      label: "Reading source files…",
      detail: `${Math.min(start + batch.length, contentCandidates.length).toLocaleString()} / ${contentCandidates.length.toLocaleString()} analyzed`,
    });
  }

  report({
    stage: "detecting",
    label: "Detecting technologies…",
    detail: `${files.length.toLocaleString()} files · ${contentCandidates.length.toLocaleString()} source contents`,
  });

  const source: GitHubProjectSource = {
    kind: "github",
    owner,
    repo,
    branch: metadata.defaultBranch,
    url: `https://github.com/${owner}/${repo}`,
  };
  return { name: metadata.name, source, files };
}

interface DirectoryHandleLike {
  name: string;
  values(): AsyncIterableIterator<DirectoryEntryLike>;
}

type DirectoryEntryLike =
  | { kind: "file"; name: string; getFile(): Promise<File> }
  | ({ kind: "directory" } & DirectoryHandleLike);

export async function loadDirectoryHandle(
  handle: DirectoryHandleLike,
  report: ProgressReporter,
): Promise<RawProject> {
  report({ stage: "reading", label: "Reading local project…", detail: handle.name });
  const files: RawProjectFile[] = [];

  const walk = async (directory: DirectoryHandleLike, parentPath: string) => {
    for await (const entry of directory.values()) {
      const path = normalizePath(`${parentPath}/${entry.name}`);
      if (entry.kind === "directory") {
        if (!isIgnoredPath(path)) await walk(entry, path);
        continue;
      }
      if (isIgnoredPath(path)) continue;
      const file = await entry.getFile();
      files.push({
        path,
        size: file.size,
        lastModified: file.lastModified,
        content: shouldReadText(path, file.size) ? await file.text() : undefined,
      });
      if (files.length % 100 === 0) {
        report({ stage: "mapping", label: "Mapping file structure…", detail: `${files.length.toLocaleString()} files` });
      }
    }
  };

  await walk(handle, "");
  if (!files.length) throw new Error("The selected folder does not contain readable project files.");
  report({ stage: "detecting", label: "Detecting technologies…", detail: `${files.length.toLocaleString()} files` });
  return {
    name: handle.name,
    source: { kind: "local", folderName: handle.name },
    files,
  };
}

export async function loadFileList(filesList: FileList, report: ProgressReporter): Promise<RawProject> {
  const browserFiles = Array.from(filesList);
  const firstPath = browserFiles[0]?.webkitRelativePath || browserFiles[0]?.name || "local-project";
  const folderName = normalizePath(firstPath).split("/")[0] || "local-project";
  report({ stage: "reading", label: "Reading local project…", detail: folderName });

  const files: RawProjectFile[] = [];
  for (let index = 0; index < browserFiles.length; index += 1) {
    const file = browserFiles[index]!;
    const fullPath = normalizePath(file.webkitRelativePath || file.name);
    const path = fullPath.startsWith(`${folderName}/`) ? fullPath.slice(folderName.length + 1) : fullPath;
    if (!path || isIgnoredPath(path)) continue;
    files.push({
      path,
      size: file.size,
      lastModified: file.lastModified,
      content: shouldReadText(path, file.size) ? await file.text() : undefined,
    });
    if (index > 0 && index % 100 === 0) {
      report({ stage: "mapping", label: "Mapping file structure…", detail: `${index.toLocaleString()} files` });
      await new Promise<void>((resolve) => requestAnimationFrame(() => resolve()));
    }
  }

  if (!files.length) throw new Error("The selected folder does not contain readable project files.");
  report({ stage: "detecting", label: "Detecting technologies…", detail: `${files.length.toLocaleString()} files` });
  return {
    name: folderName,
    source: { kind: "local", folderName },
    files,
  };
}

function contentPriority(path: string) {
  const normalized = normalizePath(path).toLowerCase();
  const name = normalized.slice(normalized.lastIndexOf("/") + 1);
  if (["tsconfig.json", "jsconfig.json", "package.json"].includes(name)) return 0;
  const depth = normalized.split("/").length;
  if (normalized.startsWith("src/") || normalized.startsWith("app/") || normalized.startsWith("pages/")) {
    return 10 + depth;
  }
  if (normalized.startsWith("packages/") || normalized.startsWith("components/")) return 30 + depth;
  return 60 + depth;
}
