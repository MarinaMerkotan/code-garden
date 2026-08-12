"use client";

import { AnimatePresence, motion } from "framer-motion";
import { Check, LoaderCircle } from "lucide-react";
import { useCallback, useState } from "react";

import { RepositoryExplorer } from "@/components/repository-explorer";
import { SourceSelector, type LoadRequest } from "@/components/source-selector";
import type { LoadProgress } from "@/lib/load-project";
import { buildProjectModel, type ProjectModel } from "@/lib/project";

type Phase = "select" | "loading" | "explorer";

const STAGES: LoadProgress["stage"][] = [
  "reading",
  "mapping",
  "detecting",
  "dependencies",
  "layout",
  "building",
];

const STAGE_LABELS: Record<LoadProgress["stage"], string> = {
  reading: "Reading project",
  mapping: "Mapping file structure",
  detecting: "Detecting technologies",
  dependencies: "Analyzing dependencies",
  layout: "Calculating layout",
  building: "Building 3D graph",
};

const INITIAL_PROGRESS: LoadProgress = {
  stage: "reading",
  label: "Preparing project…",
};

export function RepoSphereApp() {
  const [phase, setPhase] = useState<Phase>("select");
  const [progress, setProgress] = useState<LoadProgress>(INITIAL_PROGRESS);
  const [model, setModel] = useState<ProjectModel | null>(null);
  const [error, setError] = useState<string | null>(null);

  const startLoad = useCallback(async (request: LoadRequest) => {
    setError(null);
    setProgress({ stage: "reading", label: "Preparing project…", detail: request.label });
    setPhase("loading");

    try {
      const raw = await request.run(setProgress);
      setProgress({
        stage: "dependencies",
        label: "Analyzing real import relationships…",
        detail: `${raw.files.length.toLocaleString()} files`,
      });
      await new Promise<void>((resolve) => requestAnimationFrame(() => resolve()));
      setProgress({ stage: "layout", label: "Calculating graph layout…", detail: raw.name });
      await new Promise<void>((resolve) => requestAnimationFrame(() => resolve()));
      const nextModel = buildProjectModel(raw);
      setProgress({
        stage: "building",
        label: "Building 3D graph…",
        detail: `${nextModel.tree.stats.files.toLocaleString()} files · ${nextModel.tree.stats.dependencies.toLocaleString()} dependencies`,
      });
      await new Promise<void>((resolve) => requestAnimationFrame(() => resolve()));
      setModel(nextModel);
      setPhase("explorer");
    } catch (caught) {
      setModel(null);
      setError(caught instanceof Error ? caught.message : "The project could not be loaded.");
      setPhase("select");
    }
  }, []);

  return (
    <main className="relative min-h-screen overflow-hidden bg-[#080d16] text-[#edf2ff]">
      <AnimatePresence mode="wait">
        {phase === "select" ? (
          <SourceSelector key="select" onRequest={startLoad} error={error} />
        ) : phase === "loading" ? (
          <LoadingView key="loading" progress={progress} />
        ) : model ? (
          <RepositoryExplorer
            key={`${model.tree.source.kind}-${model.tree.name}`}
            model={model}
            onChooseAnother={() => {
              setModel(null);
              setPhase("select");
            }}
          />
        ) : null}
      </AnimatePresence>
    </main>
  );
}

function LoadingView({ progress }: { progress: LoadProgress }) {
  const activeIndex = STAGES.indexOf(progress.stage);
  return (
    <motion.section
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      className="relative flex min-h-screen items-center justify-center overflow-hidden px-6"
    >
      <div className="graph-grid absolute inset-0 opacity-60" />
      <div className="loading-orbit absolute size-[36rem] rounded-full border border-indigo-400/10" />
      <div className="loading-orbit delay-2 absolute size-[24rem] rounded-full border border-cyan-400/10" />
      <div className="absolute inset-0 bg-[radial-gradient(circle_at_center,rgba(79,70,229,0.16),transparent_48%)]" />

      <div className="panel relative z-10 w-full max-w-lg rounded-2xl p-6 shadow-2xl shadow-black/40">
        <div className="mb-6 flex items-start gap-4">
          <span className="grid size-11 shrink-0 place-items-center rounded-xl border border-indigo-400/25 bg-indigo-500/10 text-indigo-300">
            <LoaderCircle className="size-5 animate-spin" />
          </span>
          <div className="min-w-0">
            <p className="text-xs font-semibold uppercase tracking-[0.18em] text-indigo-300">Live analysis</p>
            <h1 className="mt-1 truncate text-lg font-semibold">{progress.label}</h1>
            {progress.detail ? <p className="mt-1 truncate font-mono text-xs text-slate-400">{progress.detail}</p> : null}
          </div>
        </div>

        <ol className="space-y-2">
          {STAGES.map((stage, index) => (
            <li
              key={stage}
              className={`flex items-center gap-3 rounded-lg px-3 py-2 text-sm transition-colors ${
                index === activeIndex ? "bg-indigo-400/8 text-white" : "text-slate-500"
              }`}
            >
              {index < activeIndex ? (
                <Check className="size-4 text-cyan-300" />
              ) : index === activeIndex ? (
                <LoaderCircle className="size-4 animate-spin text-indigo-300" />
              ) : (
                <span className="mx-0.5 size-3 rounded-full border border-slate-700" />
              )}
              {STAGE_LABELS[stage]}
            </li>
          ))}
        </ol>
      </div>
    </motion.section>
  );
}
