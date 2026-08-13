export type SourceKind = "github" | "local";

export interface GitHubProjectSource {
  kind: "github";
  owner: string;
  repo: string;
  branch: string;
  url: string;
}

export interface LocalProjectSource {
  kind: "local";
  folderName: string;
}

export type ProjectSource = GitHubProjectSource | LocalProjectSource;

export type FileCategory =
  | "typescript"
  | "javascript"
  | "react"
  | "css"
  | "json"
  | "image"
  | "other";

export type FolderTier = "root" | "app" | "util";

export interface RawProjectFile {
  path: string;
  size: number;
  content?: string;
  lastModified?: number;
}

export interface RawProject {
  name: string;
  source: ProjectSource;
  files: RawProjectFile[];
}

export interface ProjectNode {
  id: string;
  name: string;
  kind: "folder" | "file";
  path: string;
  parentId: string | null;
  childIds: string[];
  size: number;
  lines?: number;
  ext?: string;
  category?: FileCategory;
  tier: FolderTier;
  depth: number;
  position: [number, number, number];
  externalImports: string[];
  unresolvedImports: string[];
}

export interface DependencyEdge {
  from: string;
  to: string;
  specifier: string;
}

export interface DependencyGraph {
  edges: DependencyEdge[];
  importsOf: Record<string, string[]>;
  importedBy: Record<string, string[]>;
}

export interface NormalizedProjectTree {
  name: string;
  source: ProjectSource;
  rootId: string;
  nodes: Record<string, ProjectNode>;
  order: string[];
  stats: {
    files: number;
    folders: number;
    dependencies: number;
    sourceBytes: number;
    sourceSize: string;
  };
}

export interface ProjectModel {
  tree: NormalizedProjectTree;
  graph: DependencyGraph;
}

export const IGNORED_DIRECTORIES = new Set([
  "node_modules",
  ".git",
  ".next",
  ".nuxt",
  ".turbo",
  ".cache",
  "dist",
  "build",
  "coverage",
  ".output",
  "out",
  "target",
  "vendor",
]);

export const CATEGORY_LABEL: Record<FileCategory, string> = {
  typescript: "TypeScript",
  javascript: "JavaScript",
  react: "React",
  css: "CSS",
  json: "JSON",
  image: "Images",
  other: "Other",
};

export const CATEGORY_COLOR: Record<FileCategory, string> = {
  react: "#8b78ff",
  typescript: "#458eff",
  javascript: "#edbe42",
  css: "#23c8b7",
  json: "#74cf76",
  image: "#e55c9d",
  other: "#8790aa",
};

export const TIER_COLOR: Record<FolderTier, string> = {
  root: "#6f5cff",
  app: "#297df0",
  util: "#13b9bb",
};

const ANALYZABLE = new Set(["ts", "tsx", "js", "jsx", "mjs", "cjs"]);
const RESOLUTION_EXTENSIONS = [
  "",
  ".ts",
  ".tsx",
  ".js",
  ".jsx",
  ".mjs",
  ".cjs",
  ".json",
  ".css",
  ".scss",
  ".svg",
];

export function normalizePath(path: string) {
  return path.replaceAll("\\", "/").replace(/^\/+/, "").replace(/\/+/g, "/");
}

export function isIgnoredPath(path: string) {
  return normalizePath(path)
    .split("/")
    .some((segment) => IGNORED_DIRECTORIES.has(segment));
}

export function extensionOf(name: string) {
  const index = name.lastIndexOf(".");
  return index < 0 ? "" : name.slice(index + 1).toLowerCase();
}

export function categoryOf(name: string): FileCategory {
  const ext = extensionOf(name);
  if (ext === "tsx" || ext === "jsx") return "react";
  if (ext === "ts" || name.toLowerCase().endsWith(".d.ts")) return "typescript";
  if (["js", "mjs", "cjs"].includes(ext)) return "javascript";
  if (["css", "scss", "sass", "less"].includes(ext)) return "css";
  if (ext === "json" || ext === "jsonc") return "json";
  if (["png", "jpg", "jpeg", "svg", "webp", "gif", "avif", "ico"].includes(ext)) {
    return "image";
  }
  return "other";
}

export function formatBytes(bytes: number) {
  if (bytes >= 1024 ** 3) return `${(bytes / 1024 ** 3).toFixed(2)} GB`;
  if (bytes >= 1024 ** 2) return `${(bytes / 1024 ** 2).toFixed(1)} MB`;
  if (bytes >= 1024) return `${Math.round(bytes / 1024)} KB`;
  return `${bytes} B`;
}

function dirname(path: string) {
  const index = path.lastIndexOf("/");
  return index < 0 ? "" : path.slice(0, index);
}

function basename(path: string) {
  return path.slice(path.lastIndexOf("/") + 1);
}

function joinPath(...parts: string[]) {
  const stack: string[] = [];
  normalizePath(parts.filter(Boolean).join("/"))
    .split("/")
    .forEach((part) => {
      if (!part || part === ".") return;
      if (part === "..") stack.pop();
      else stack.push(part);
    });
  return stack.join("/");
}

function tierFor(path: string, depth: number): FolderTier {
  if (depth <= 1) return "root";
  const parts = path.toLowerCase().split("/");
  if (parts.some((part) => ["app", "src", "pages", "components", "features"].includes(part))) {
    return "app";
  }
  return "util";
}

function stableHash(value: string) {
  let hash = 2166136261;
  for (let index = 0; index < value.length; index += 1) {
    hash ^= value.charCodeAt(index);
    hash = Math.imul(hash, 16777619);
  }
  return (hash >>> 0) / 4294967295;
}

function layout(nodes: Record<string, ProjectNode>, rootId: string) {
  const place = (
    id: string,
    center: [number, number, number],
    radius: number,
    angleOffset: number,
  ) => {
    const node = nodes[id];
    if (!node) return;
    node.position = center;
    const children = node.childIds;
    const childRadius = Math.max(2.2, Math.min(11, 2.4 + Math.sqrt(children.length) * 1.25));

    children.forEach((childId, index) => {
      const child = nodes[childId];
      if (!child) return;
      const angle = angleOffset + (index / Math.max(1, children.length)) * Math.PI * 2;
      const noise = stableHash(child.path);
      const next: [number, number, number] = [
        center[0] + Math.cos(angle) * childRadius,
        center[1] + Math.sin(angle * 1.7) * childRadius * 0.36 + (noise - 0.5) * 1.2,
        center[2] + Math.sin(angle) * childRadius * 0.72,
      ];
      child.position = next;
      if (child.kind === "folder") {
        place(childId, next, radius * 0.58, angle + 0.62);
      }
    });
  };

  place(rootId, [0, 0, 0], 11, 0.37);
}

function extractImportSpecifiers(content: string) {
  const found = new Set<string>();
  const patterns = [
    /(?:import|export)\s+(?:[^"']*?\s+from\s*)?["']([^"']+)["']/g,
    /require\(\s*["']([^"']+)["']\s*\)/g,
    /import\(\s*["']([^"']+)["']\s*\)/g,
  ];
  for (const pattern of patterns) {
    for (const match of content.matchAll(pattern)) {
      if (match[1]) found.add(match[1]);
    }
  }
  return [...found];
}

interface AliasRule {
  prefix: string;
  targetPrefix: string;
}

function stripJsonCommentsAndTrailingCommas(input: string) {
  let output = "";
  let inString = false;
  let escaped = false;
  let lineComment = false;
  let blockComment = false;

  for (let index = 0; index < input.length; index += 1) {
    const char = input[index]!;
    const next = input[index + 1];
    if (lineComment) {
      if (char === "\n") {
        lineComment = false;
        output += char;
      }
      continue;
    }
    if (blockComment) {
      if (char === "*" && next === "/") {
        blockComment = false;
        index += 1;
      } else if (char === "\n") output += char;
      continue;
    }
    if (inString) {
      output += char;
      if (escaped) escaped = false;
      else if (char === "\\") escaped = true;
      else if (char === '"') inString = false;
      continue;
    }
    if (char === '"') {
      inString = true;
      output += char;
      continue;
    }
    if (char === "/" && next === "/") {
      lineComment = true;
      index += 1;
      continue;
    }
    if (char === "/" && next === "*") {
      blockComment = true;
      index += 1;
      continue;
    }
    if (char === ",") {
      let cursor = index + 1;
      while (/\s/.test(input[cursor] ?? "")) cursor += 1;
      if (input[cursor] === "}" || input[cursor] === "]") continue;
    }
    output += char;
  }
  return output;
}

function parseAliasRules(files: RawProjectFile[]) {
  const config = files.find((file) => ["tsconfig.json", "jsconfig.json"].includes(file.path));
  if (!config?.content) return [{ prefix: "@/", targetPrefix: "" }];
  try {
    const parsed = JSON.parse(stripJsonCommentsAndTrailingCommas(config.content)) as {
      compilerOptions?: { baseUrl?: string; paths?: Record<string, string[]> };
    };
    const baseUrl = normalizePath(parsed.compilerOptions?.baseUrl ?? "");
    const paths = parsed.compilerOptions?.paths ?? {};
    const rules = Object.entries(paths).flatMap(([key, targets]) => {
      const target = targets[0];
      if (!target) return [];
      return [{
        prefix: key.replace(/\*$/, ""),
        targetPrefix: joinPath(baseUrl, target.replace(/\*$/, "")),
      }];
    });
    if (!rules.some((rule) => rule.prefix === "@/")) {
      rules.push({ prefix: "@/", targetPrefix: joinPath(baseUrl, "src") });
    }
    return rules;
  } catch {
    return [{ prefix: "@/", targetPrefix: "src" }];
  }
}

function resolveInternalImport(
  importer: string,
  specifier: string,
  paths: Set<string>,
  aliases: AliasRule[],
) {
  let base: string | null = null;
  if (specifier.startsWith(".")) base = joinPath(dirname(importer), specifier);
  else if (specifier.startsWith("/")) base = normalizePath(specifier);
  else {
    const alias = aliases.find((rule) => specifier.startsWith(rule.prefix));
    if (alias) base = joinPath(alias.targetPrefix, specifier.slice(alias.prefix.length));
  }
  if (!base) return null;

  for (const ext of RESOLUTION_EXTENSIONS) {
    const candidate = `${base}${ext}`;
    if (paths.has(candidate)) return candidate;
  }
  for (const ext of RESOLUTION_EXTENSIONS.slice(1)) {
    const candidate = `${base}/index${ext}`;
    if (paths.has(candidate)) return candidate;
  }
  return undefined;
}

export function buildProjectModel(raw: RawProject): ProjectModel {
  const files = raw.files
    .map((file) => ({ ...file, path: normalizePath(file.path) }))
    .filter((file) => file.path && !file.path.endsWith("/") && !isIgnoredPath(file.path));
  const nodes: Record<string, ProjectNode> = {};
  const order: string[] = [];
  const rootId = "folder:/";

  const add = (node: ProjectNode) => {
    nodes[node.id] = node;
    order.push(node.id);
  };

  add({
    id: rootId,
    name: raw.name,
    kind: "folder",
    path: "/",
    parentId: null,
    childIds: [],
    size: 0,
    tier: "root",
    depth: 0,
    position: [0, 0, 0],
    externalImports: [],
    unresolvedImports: [],
  });

  const ensureFolder = (folderPath: string) => {
    const normalized = normalizePath(folderPath);
    if (!normalized) return rootId;
    const id = `folder:${normalized}`;
    if (nodes[id]) return id;
    const parentPath = dirname(normalized);
    const parentId = ensureFolder(parentPath);
    const depth = normalized.split("/").length;
    add({
      id,
      name: basename(normalized),
      kind: "folder",
      path: `/${normalized}`,
      parentId,
      childIds: [],
      size: 0,
      tier: tierFor(normalized, depth),
      depth,
      position: [0, 0, 0],
      externalImports: [],
      unresolvedImports: [],
    });
    nodes[parentId]?.childIds.push(id);
    return id;
  };

  const rawByPath = new Map<string, RawProjectFile>();
  for (const file of files) {
    rawByPath.set(file.path, file);
    const parentId = ensureFolder(dirname(file.path));
    const id = `file:${file.path}`;
    const ext = extensionOf(file.path);
    add({
      id,
      name: basename(file.path),
      kind: "file",
      path: `/${file.path}`,
      parentId,
      childIds: [],
      size: file.size,
      lines: file.content ? file.content.split(/\r?\n/).length : undefined,
      ext,
      category: categoryOf(file.path),
      tier: tierFor(dirname(file.path), dirname(file.path).split("/").filter(Boolean).length),
      depth: file.path.split("/").length,
      position: [0, 0, 0],
      externalImports: [],
      unresolvedImports: [],
    });
    nodes[parentId]?.childIds.push(id);
  }

  for (const node of Object.values(nodes)) {
    node.childIds.sort((left, right) => {
      const a = nodes[left];
      const b = nodes[right];
      if (!a || !b) return 0;
      if (a.kind !== b.kind) return a.kind === "folder" ? -1 : 1;
      return a.name.localeCompare(b.name);
    });
  }

  const folderIds = order.filter((id) => nodes[id]?.kind === "folder").reverse();
  for (const id of folderIds) {
    const folder = nodes[id];
    if (folder) folder.size = folder.childIds.reduce((sum, childId) => sum + (nodes[childId]?.size ?? 0), 0);
  }

  const filePaths = new Set(files.map((file) => file.path));
  const aliases = parseAliasRules(files);
  const edges: DependencyEdge[] = [];
  const importsOf: Record<string, string[]> = {};
  const importedBy: Record<string, string[]> = {};
  const edgeKeys = new Set<string>();

  for (const [path, rawFile] of rawByPath) {
    const ext = extensionOf(path);
    if (!ANALYZABLE.has(ext) || !rawFile.content) continue;
    const sourceId = `file:${path}`;
    const sourceNode = nodes[sourceId];
    if (!sourceNode) continue;
    for (const specifier of extractImportSpecifiers(rawFile.content)) {
      const resolved = resolveInternalImport(path, specifier, filePaths, aliases);
      if (resolved === null) {
        sourceNode.externalImports.push(specifier.split("/").slice(0, specifier.startsWith("@") ? 2 : 1).join("/"));
        continue;
      }
      if (!resolved) {
        sourceNode.unresolvedImports.push(specifier);
        continue;
      }
      const targetId = `file:${resolved}`;
      const key = `${sourceId}>${targetId}`;
      if (edgeKeys.has(key)) continue;
      edgeKeys.add(key);
      edges.push({ from: sourceId, to: targetId, specifier });
      (importsOf[sourceId] ??= []).push(targetId);
      (importedBy[targetId] ??= []).push(sourceId);
    }
    sourceNode.externalImports = [...new Set(sourceNode.externalImports)].sort();
    sourceNode.unresolvedImports = [...new Set(sourceNode.unresolvedImports)].sort();
  }

  layout(nodes, rootId);
  const totalBytes = files.reduce((sum, file) => sum + file.size, 0);
  const folders = order.filter((id) => nodes[id]?.kind === "folder").length;
  const tree: NormalizedProjectTree = {
    name: raw.name,
    source: raw.source,
    rootId,
    nodes,
    order,
    stats: {
      files: files.length,
      folders,
      dependencies: edges.length,
      sourceBytes: totalBytes,
      sourceSize: formatBytes(totalBytes),
    },
  };

  return { tree, graph: { edges, importsOf, importedBy } };
}

export function parseGitHubUrl(input: string) {
  const cleaned = input.trim().replace(/\.git$/, "").replace(/\/+$/, "");
  const match = cleaned.match(/^(?:https?:\/\/)?(?:www\.)?github\.com\/([\w.-]+)\/([\w.-]+)$/)
    ?? cleaned.match(/^([\w.-]+)\/([\w.-]+)$/);
  if (!match) return null;
  return { owner: match[1]!, repo: match[2]! };
}

export function breadcrumbFor(tree: NormalizedProjectTree, id: string) {
  const chain: ProjectNode[] = [];
  let current: ProjectNode | undefined = tree.nodes[id];
  while (current) {
    chain.unshift(current);
    current = current.parentId ? tree.nodes[current.parentId] : undefined;
  }
  return chain;
}

export function descendantsOf(tree: NormalizedProjectTree, id: string) {
  const result: string[] = [];
  const pending = [...(tree.nodes[id]?.childIds ?? [])];
  while (pending.length) {
    const current = pending.shift();
    if (!current) continue;
    result.push(current);
    pending.push(...(tree.nodes[current]?.childIds ?? []));
  }
  return result;
}

export function categoryCounts(tree: NormalizedProjectTree) {
  const counts: Record<FileCategory, number> = {
    typescript: 0,
    javascript: 0,
    react: 0,
    css: 0,
    json: 0,
    image: 0,
    other: 0,
  };
  for (const id of tree.order) {
    const node = tree.nodes[id];
    if (node?.kind === "file") counts[node.category ?? "other"] += 1;
  }
  return counts;
}
