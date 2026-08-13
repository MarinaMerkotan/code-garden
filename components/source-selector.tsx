"use client";

import { motion } from "framer-motion";
import {
  ArrowRight,
  Boxes,
  FolderOpen,
  Github,
  HardDrive,
  LockKeyhole,
  Network,
  ShieldCheck,
  Sparkles,
} from "lucide-react";
import { useEffect, useRef, useState } from "react";

import {
  loadDirectoryHandle,
  loadFileList,
  loadGitHubProject,
  type LoadProgress,
  type ProgressReporter,
} from "@/lib/load-project";
import { parseGitHubUrl, type RawProject } from "@/lib/project";

export interface LoadRequest {
  label: string;
  run: (report: ProgressReporter) => Promise<RawProject>;
}

interface DirectoryPickerWindow extends Window {
  showDirectoryPicker?: (options?: { mode?: "read" | "readwrite" }) => Promise<{
    name: string;
    values(): AsyncIterableIterator<never>;
  }>;
}

export function SourceSelector({
  onRequest,
  error,
}: {
  onRequest: (request: LoadRequest) => void;
  error: string | null;
}) {
  const [githubValue, setGithubValue] = useState("");
  const [inputError, setInputError] = useState<string | null>(null);
  const [hasPrivateDirectoryPicker, setHasPrivateDirectoryPicker] = useState<boolean | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    const frame = requestAnimationFrame(() => {
      setHasPrivateDirectoryPicker(
        typeof (window as DirectoryPickerWindow).showDirectoryPicker === "function",
      );
    });
    return () => cancelAnimationFrame(frame);
  }, []);

  const submitGitHub = (value: string) => {
    const parsed = parseGitHubUrl(value);
    if (!parsed) {
      setInputError("Enter owner/repository or a complete github.com URL.");
      return;
    }
    setInputError(null);
    onRequest({
      label: `${parsed.owner}/${parsed.repo}`,
      run: (report) => loadGitHubProject(parsed.owner, parsed.repo, report),
    });
  };

  const openLocalFolder = async () => {
    const browserWindow = window as DirectoryPickerWindow;
    if (hasPrivateDirectoryPicker !== false && browserWindow.showDirectoryPicker) {
      try {
        const handle = await browserWindow.showDirectoryPicker({ mode: "read" });
        onRequest({
          label: handle.name,
          run: (report: ProgressReporter) => loadDirectoryHandle(handle, report),
        });
      } catch (caught) {
        if (caught instanceof DOMException && caught.name === "AbortError") return;
        setHasPrivateDirectoryPicker(false);
        setInputError(
          "The private folder picker is unavailable. Click the folder button again to use compatibility mode; files will still stay on this device.",
        );
      }
      return;
    }
    fileInputRef.current?.click();
  };

  return (
    <motion.section
      initial={{ opacity: 0, y: 14 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: -16 }}
      className="relative flex min-h-screen items-center justify-center px-5 py-10"
    >
      <div className="graph-grid absolute inset-0 opacity-40" />
      <div className="absolute left-[12%] top-[18%] size-80 rounded-full bg-indigo-600/12 blur-[100px]" />
      <div className="absolute bottom-[10%] right-[12%] size-96 rounded-full bg-cyan-500/8 blur-[120px]" />

      <div className="relative z-10 w-full max-w-5xl">
        <div className="mb-9 flex flex-col items-center text-center">
          <div className="mb-5 flex items-center gap-3">
            <span className="logo-cube grid size-11 place-items-center rounded-xl border border-indigo-400/30 bg-indigo-500/15 shadow-[0_0_35px_rgba(99,102,241,0.22)]">
              <Boxes className="size-5 text-indigo-200" />
            </span>
            <div className="text-left">
              <p className="text-lg font-semibold tracking-tight">RepoSphere</p>
              <p className="text-[11px] text-slate-500">See the architecture, not just the files.</p>
            </div>
          </div>
          <p className="mb-3 flex items-center gap-2 text-xs font-semibold uppercase tracking-[0.2em] text-indigo-300">
            <Sparkles className="size-3.5" /> Interactive code intelligence
          </p>
          <h1 className="max-w-3xl text-balance text-4xl font-semibold tracking-[-0.04em] sm:text-5xl">
            Explore your codebase in <span className="text-gradient">three dimensions.</span>
          </h1>
          <p className="mt-4 max-w-xl text-pretty text-sm leading-6 text-slate-400 sm:text-base">
            Load a real repository, map its file structure, and trace actual import relationships in an interactive spatial graph.
          </p>
        </div>

        {(error || inputError) ? (
          <div className="mx-auto mb-4 max-w-2xl rounded-xl border border-rose-400/25 bg-rose-500/8 px-4 py-3 text-sm text-rose-200">
            {inputError || error}
          </div>
        ) : null}

        <div className="grid gap-4 lg:grid-cols-2">
          <motion.article whileHover={{ y: -3 }} className="panel group rounded-2xl p-6">
            <header className="mb-5 flex items-start gap-3">
              <span className="grid size-11 place-items-center rounded-xl border border-indigo-400/20 bg-indigo-400/8 text-indigo-300">
                <Github className="size-5" />
              </span>
              <div>
                <h2 className="font-semibold">Public GitHub repository</h2>
                <p className="mt-1 text-xs leading-5 text-slate-500">RepoSphere downloads the selected branch and analyzes its real files.</p>
              </div>
            </header>

            <form
              onSubmit={(event) => {
                event.preventDefault();
                submitGitHub(githubValue);
              }}
              className="space-y-3"
            >
              <label className="relative block">
                <Github className="absolute left-3.5 top-1/2 size-4 -translate-y-1/2 text-slate-500" />
                <input
                  value={githubValue}
                  onChange={(event) => {
                    setGithubValue(event.target.value);
                    setInputError(null);
                  }}
                  placeholder="https://github.com/owner/repository"
                  aria-label="GitHub repository URL"
                  spellCheck={false}
                  className="h-12 w-full rounded-xl border border-white/8 bg-black/20 pl-10 pr-4 font-mono text-sm outline-none transition focus:border-indigo-400/55 focus:ring-4 focus:ring-indigo-500/8"
                />
              </label>
              <button className="flex h-11 w-full items-center justify-center gap-2 rounded-xl bg-indigo-500 text-sm font-semibold text-white transition hover:bg-indigo-400">
                Visualize repository <ArrowRight className="size-4" />
              </button>
            </form>

            <div className="mt-4 flex flex-wrap items-center gap-2">
              <span className="text-[11px] text-slate-600">Try</span>
              {["facebook/react", "vercel/next.js"].map((example) => (
                <button
                  key={example}
                  type="button"
                  onClick={() => {
                    setGithubValue(example);
                    submitGitHub(example);
                  }}
                  className="rounded-full border border-white/8 bg-white/[0.025] px-2.5 py-1 font-mono text-[10px] text-slate-400 transition hover:border-indigo-400/35 hover:text-slate-200"
                >
                  {example}
                </button>
              ))}
            </div>
          </motion.article>

          <motion.article whileHover={{ y: -3 }} className="panel group rounded-2xl p-6">
            <header className="mb-5 flex items-start gap-3">
              <span className="grid size-11 place-items-center rounded-xl border border-cyan-400/20 bg-cyan-400/8 text-cyan-300">
                <HardDrive className="size-5" />
              </span>
              <div>
                <h2 className="font-semibold">Local project folder</h2>
                <p className="mt-1 text-xs leading-5 text-slate-500">Files are read in your browser and are never uploaded for analysis.</p>
              </div>
            </header>

            <button
              type="button"
              onClick={openLocalFolder}
              className="flex h-[108px] w-full flex-col items-center justify-center gap-2 rounded-xl border border-dashed border-cyan-300/20 bg-cyan-400/[0.025] text-center transition hover:border-cyan-300/45 hover:bg-cyan-400/[0.05]"
            >
              <FolderOpen className="size-6 text-cyan-300" />
              <span className="text-sm font-semibold">Open project folder privately</span>
              <span className="text-xs text-slate-500">
                {hasPrivateDirectoryPicker
                  ? "Recommended · read-only · no upload dialog"
                  : hasPrivateDirectoryPicker === false
                    ? "Compatibility mode · files still stay on this device"
                    : "Checking private folder access…"}
              </span>
            </button>
            {hasPrivateDirectoryPicker === false ? (
              <p className="mt-3 rounded-lg border border-cyan-300/10 bg-cyan-400/[0.025] px-3 py-2 text-[10px] leading-4 text-slate-500">
                Your browser may use the word “upload” in its compatibility dialog. RepoSphere
                does not transmit the selected files: scanning and analysis remain local.
              </p>
            ) : null}
            <input
              ref={fileInputRef}
              type="file"
              multiple
              className="hidden"
              {...({ webkitdirectory: "", directory: "" } as Record<string, string>)}
              onChange={(event) => {
                const files = Array.from(event.currentTarget.files ?? []);
                if (!files.length) return;
                const name = files[0]?.webkitRelativePath.split("/")[0] || "local-project";
                onRequest({ label: name, run: (report: (progress: LoadProgress) => void) => loadFileList(files, report) });
                event.currentTarget.value = "";
              }}
            />
          </motion.article>
        </div>

        <div className="mt-6 flex flex-wrap justify-center gap-x-7 gap-y-2 text-[11px] text-slate-600">
          <span className="flex items-center gap-1.5"><Network className="size-3.5" /> Real dependency graph</span>
          <span className="flex items-center gap-1.5"><ShieldCheck className="size-3.5" /> No mock fallback</span>
          <span className="flex items-center gap-1.5"><LockKeyhole className="size-3.5" /> Local files stay local</span>
        </div>
      </div>
    </motion.section>
  );
}
