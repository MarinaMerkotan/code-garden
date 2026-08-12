"use client";

import { motion } from "framer-motion";
import {
  ArrowLeft,
  Boxes,
  Braces,
  ChevronDown,
  ChevronRight,
  CircleDot,
  Expand,
  File,
  FileCode2,
  Folder,
  GitBranch,
  Github,
  HardDrive,
  LayoutList,
  ListTree,
  Maximize2,
  Network,
  PieChart,
  RotateCcw,
  Search,
  Share2,
  X,
} from "lucide-react";
import { useEffect, useMemo, useRef, useState } from "react";

import { RepositoryScene, type CameraCommand } from "@/components/repository-scene";
import {
  CATEGORY_LABEL,
  breadcrumbFor,
  categoryCounts,
  descendantsOf,
  formatBytes,
  type FileCategory,
  type ProjectModel,
  type ProjectNode,
} from "@/lib/project";

type ViewMode = "graph" | "tree" | "list";
type Section = "explorer" | "dependencies" | "statistics";

const CATEGORIES: FileCategory[] = ["typescript", "javascript", "react", "css", "json", "image", "other"];

export function RepositoryExplorer({
  model,
  onChooseAnother,
}: {
  model: ProjectModel;
  onChooseAnother: () => void;
}) {
  const [activeFolderId, setActiveFolderId] = useState(model.tree.rootId);
  const [selectedId, setSelectedId] = useState<string | null>(model.tree.rootId);
  const [hoveredId, setHoveredId] = useState<string | null>(null);
  const [filter, setFilter] = useState<FileCategory | "all">("all");
  const [query, setQuery] = useState("");
  const [view, setView] = useState<ViewMode>("graph");
  const [section, setSection] = useState<Section>("explorer");
  const [cameraCommand, setCameraCommand] = useState<CameraCommand>({ type: "reset", nonce: 0 });
  const shellRef = useRef<HTMLDivElement>(null);
  const counts = useMemo(() => categoryCounts(model.tree), [model]);
  const selectedNode = selectedId ? model.tree.nodes[selectedId] : undefined;
  const crumbs = useMemo(
    () => breadcrumbFor(model.tree, selectedId ?? activeFolderId),
    [model, selectedId, activeFolderId],
  );
  const searchResults = useMemo(() => {
    const term = query.trim().toLowerCase();
    if (!term) return [];
    return model.tree.order
      .map((id) => model.tree.nodes[id])
      .filter((node): node is ProjectNode => Boolean(node && `${node.name} ${node.path}`.toLowerCase().includes(term)))
      .slice(0, 12);
  }, [query, model]);

  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        if (selectedId) setSelectedId(null);
        else {
          const parentId = model.tree.nodes[activeFolderId]?.parentId;
          if (parentId) setActiveFolderId(parentId);
        }
      }
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [selectedId, activeFolderId, model]);

  const selectSearchResult = (node: ProjectNode) => {
    setSelectedId(node.id);
    setActiveFolderId(node.kind === "folder" ? node.id : node.parentId ?? model.tree.rootId);
    setQuery("");
  };

  return (
    <motion.div
      ref={shellRef}
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      className="flex h-screen min-h-[620px] w-full overflow-hidden bg-[#070c15]"
    >
      <Sidebar
        model={model}
        counts={counts}
        filter={filter}
        setFilter={setFilter}
        view={view}
        setView={setView}
        section={section}
        setSection={setSection}
        onChooseAnother={onChooseAnother}
      />

      <div className="flex min-w-0 flex-1 flex-col">
        <header className="relative z-30 flex h-14 shrink-0 items-center gap-3 border-b border-white/[0.07] bg-[#0c1320]/95 px-4 backdrop-blur-xl">
          <nav className="hidden min-w-0 items-center gap-1 overflow-hidden md:flex">
            {crumbs.map((crumb, index) => (
              <span key={crumb.id} className="flex min-w-0 items-center gap-1">
                {index ? <ChevronRight className="size-3 shrink-0 text-slate-700" /> : null}
                <button
                  onClick={() => {
                    if (crumb.kind === "folder") {
                      setActiveFolderId(crumb.id);
                      setSelectedId(crumb.id);
                    }
                  }}
                  className={`max-w-32 truncate rounded-md px-1.5 py-1 font-mono text-[11px] ${index === crumbs.length - 1 ? "text-slate-100" : "text-slate-500 hover:text-slate-300"}`}
                >
                  {crumb.id === model.tree.rootId ? model.tree.name : crumb.name}
                </button>
              </span>
            ))}
          </nav>

          <div className="relative ml-auto w-full max-w-[340px]">
            <Search className="pointer-events-none absolute left-3 top-1/2 size-3.5 -translate-y-1/2 text-slate-500" />
            <input
              value={query}
              onChange={(event) => setQuery(event.target.value)}
              placeholder="Search real files or folders…"
              className="h-9 w-full rounded-lg border border-white/[0.07] bg-black/20 pl-9 pr-8 text-xs outline-none focus:border-indigo-400/40"
            />
            {query ? (
              <button onClick={() => setQuery("")} aria-label="Clear search" className="absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-500 hover:text-white">
                <X className="size-3.5" />
              </button>
            ) : <kbd className="absolute right-2.5 top-1/2 -translate-y-1/2 rounded border border-white/10 px-1 font-mono text-[9px] text-slate-600">/</kbd>}
            {query ? (
              <div className="panel absolute left-0 right-0 top-11 max-h-80 overflow-y-auto rounded-xl p-1.5 shadow-2xl">
                {searchResults.length ? searchResults.map((node) => (
                  <button
                    key={node.id}
                    onClick={() => selectSearchResult(node)}
                    className="flex w-full items-center gap-2 rounded-lg px-2.5 py-2 text-left hover:bg-white/[0.05]"
                  >
                    {node.kind === "folder" ? <Folder className="size-3.5 text-violet-300" /> : <FileCode2 className="size-3.5 text-blue-300" />}
                    <span className="min-w-0 flex-1">
                      <span className="block truncate font-mono text-xs text-slate-200">{node.name}</span>
                      <span className="block truncate font-mono text-[9px] text-slate-600">{node.path}</span>
                    </span>
                  </button>
                )) : <p className="px-3 py-4 text-center text-xs text-slate-500">No project files match “{query}”.</p>}
              </div>
            ) : null}
          </div>

          <button
            onClick={() => shellRef.current?.requestFullscreen?.()}
            aria-label="Fullscreen"
            className="grid size-9 shrink-0 place-items-center rounded-lg border border-white/[0.07] text-slate-500 hover:bg-white/[0.04] hover:text-white"
          >
            <Maximize2 className="size-4" />
          </button>
        </header>

        <div className="flex min-h-0 flex-1">
          <div className="relative min-w-0 flex-1">
            <RepositoryScene
              model={model}
              activeFolderId={activeFolderId}
              selectedId={selectedId}
              hoveredId={hoveredId}
              filter={filter}
              query={query}
              dependenciesMode={section === "dependencies"}
              cameraCommand={cameraCommand}
              onHover={setHoveredId}
              onSelect={setSelectedId}
              onEnterFolder={(id) => {
                setActiveFolderId(id);
                setSelectedId(id);
              }}
            />

            {view !== "graph" ? (
              <ProjectListOverlay
                model={model}
                rootId={activeFolderId}
                flat={view === "list"}
                onSelect={(node) => {
                  setSelectedId(node.id);
                  if (node.kind === "folder") setActiveFolderId(node.id);
                }}
              />
            ) : null}

            {section === "statistics" ? <StatisticsOverlay counts={counts} model={model} /> : null}

            <div className="pointer-events-none absolute inset-x-0 bottom-4 flex justify-center px-4">
              <div className="panel pointer-events-auto flex items-center gap-1 rounded-xl p-1.5 shadow-xl">
                <Hint icon={<CircleDot className="size-3.5" />} label="Drag to rotate" />
                <Hint icon={<Expand className="size-3.5" />} label="Scroll to zoom" />
                <button onClick={() => setCameraCommand({ type: "reset", nonce: Date.now() })} title="Reset camera" className="control-button"><RotateCcw className="size-3.5" /></button>
                <button onClick={() => setCameraCommand({ type: "fit", nonce: Date.now() })} title="Fit graph" className="control-button"><Maximize2 className="size-3.5" /></button>
              </div>
            </div>
          </div>

          <Inspector
            model={model}
            node={selectedNode}
            onClose={() => setSelectedId(null)}
            onSelect={(node) => {
              setSelectedId(node.id);
              if (node.kind === "folder") setActiveFolderId(node.id);
            }}
          />
        </div>
      </div>
    </motion.div>
  );
}

function Sidebar({
  model, counts, filter, setFilter, view, setView, section, setSection, onChooseAnother,
}: {
  model: ProjectModel;
  counts: Record<FileCategory, number>;
  filter: FileCategory | "all";
  setFilter: (filter: FileCategory | "all") => void;
  view: ViewMode;
  setView: (view: ViewMode) => void;
  section: Section;
  setSection: (section: Section) => void;
  onChooseAnother: () => void;
}) {
  const source = model.tree.source;
  return (
    <aside className="hidden h-full w-[242px] shrink-0 flex-col border-r border-white/[0.07] bg-[#0b121e] md:flex">
      <div className="flex h-14 items-center gap-2.5 border-b border-white/[0.07] px-4">
        <span className="grid size-8 place-items-center rounded-lg border border-indigo-400/25 bg-indigo-500/12 text-indigo-300"><Boxes className="size-4" /></span>
        <div><p className="text-sm font-semibold">RepoSphere</p><p className="text-[9px] text-slate-600">3D codebase explorer</p></div>
      </div>
      <div className="border-b border-white/[0.07] p-4">
        <p className="truncate font-mono text-xs text-slate-200">
          {source.kind === "github" ? <><span className="text-slate-600">{source.owner}/</span>{source.repo}</> : source.folderName}
        </p>
        <div className="mt-2.5 flex items-center gap-2">
          {source.kind === "github" ? (
            <><span className="flex min-w-0 items-center gap-1 rounded-md border border-white/[0.07] px-2 py-1 font-mono text-[9px] text-slate-500"><GitBranch className="size-3" /><span className="max-w-20 truncate">{source.branch}</span><ChevronDown className="size-3" /></span><span className="source-badge text-indigo-300"><Github className="size-3" />GitHub</span></>
          ) : <span className="source-badge text-cyan-300"><HardDrive className="size-3" />Local</span>}
        </div>
      </div>
      <div className="thin-scroll flex-1 overflow-y-auto p-3">
        <p className="eyebrow px-1 pb-2">Navigate</p>
        {([
          ["explorer", "Explorer", Boxes],
          ["dependencies", "Dependencies", Share2],
          ["statistics", "Statistics", PieChart],
        ] as const).map(([key, label, Icon]) => (
          <button key={key} onClick={() => setSection(key)} className={`sidebar-item ${section === key ? "sidebar-item-active" : ""}`}><Icon className="size-4" />{label}</button>
        ))}
        <p className="eyebrow px-1 pb-2 pt-5">View</p>
        <div className="grid grid-cols-3 gap-1 rounded-lg border border-white/[0.07] bg-black/20 p-1">
          {([["graph", Network], ["tree", ListTree], ["list", LayoutList]] as const).map(([key, Icon]) => (
            <button key={key} onClick={() => setView(key)} className={`flex flex-col items-center gap-1 rounded-md py-1.5 text-[9px] capitalize ${view === key ? "bg-indigo-500/15 text-indigo-300" : "text-slate-600 hover:text-slate-300"}`}><Icon className="size-3.5" />{key}</button>
          ))}
        </div>
        <p className="eyebrow px-1 pb-2 pt-5">Filters</p>
        <button onClick={() => setFilter("all")} className={`sidebar-item justify-between ${filter === "all" ? "sidebar-item-active" : ""}`}><span className="flex items-center gap-2"><FileCode2 className="size-4" />All files</span><span className="metric-number">{model.tree.stats.files}</span></button>
        {CATEGORIES.map((category) => (
          <button key={category} onClick={() => setFilter(category)} className={`sidebar-item justify-between ${filter === category ? "sidebar-item-active" : ""}`}>
            <span className="flex items-center gap-2"><span className={`category-dot category-${category}`} />{CATEGORY_LABEL[category]}</span><span className="metric-number">{counts[category]}</span>
          </button>
        ))}
      </div>
      <div className="border-t border-white/[0.07] p-4">
        <p className="eyebrow mb-2.5">Project metrics</p>
        <div className="grid grid-cols-2 gap-2 text-[10px] text-slate-500">
          <Metric icon={<FileCode2 className="size-3" />} value={`${model.tree.stats.files} files`} />
          <Metric icon={<Folder className="size-3" />} value={`${model.tree.stats.folders} folders`} />
          <Metric icon={<Share2 className="size-3" />} value={`${model.tree.stats.dependencies} deps`} />
          <Metric icon={<Boxes className="size-3" />} value={model.tree.stats.sourceSize} />
        </div>
        <button onClick={onChooseAnother} className="mt-4 flex w-full items-center justify-center gap-2 rounded-lg border border-white/[0.07] py-2 text-[10px] text-slate-500 hover:bg-white/[0.04] hover:text-white"><ArrowLeft className="size-3" />Choose another source</button>
      </div>
    </aside>
  );
}

function Metric({ icon, value }: { icon: React.ReactNode; value: string }) {
  return <span className="flex items-center gap-1.5"><span className="text-slate-600">{icon}</span><span className="font-mono text-slate-300">{value}</span></span>;
}

function Inspector({ model, node, onClose, onSelect }: { model: ProjectModel; node?: ProjectNode; onClose: () => void; onSelect: (node: ProjectNode) => void }) {
  if (!node) return <aside className="hidden w-[310px] shrink-0 border-l border-white/[0.07] bg-[#0b121e] p-5 xl:block"><p className="eyebrow">Inspector</p><p className="mt-3 text-sm leading-6 text-slate-500">Select any real file or folder in the graph to inspect its path, size, imports, and dependents.</p></aside>;
  const imports = model.graph.importsOf[node.id] ?? [];
  const importedBy = model.graph.importedBy[node.id] ?? [];
  return (
    <aside className="thin-scroll hidden w-[310px] shrink-0 overflow-y-auto border-l border-white/[0.07] bg-[#0b121e] xl:block">
      <div className="flex items-start gap-3 border-b border-white/[0.07] p-4">
        <span className={`grid size-10 shrink-0 place-items-center rounded-xl border ${node.kind === "folder" ? "border-violet-400/20 bg-violet-400/8 text-violet-300" : "border-blue-400/20 bg-blue-400/8 text-blue-300"}`}>{node.kind === "folder" ? <Folder className="size-4" /> : <FileCode2 className="size-4" />}</span>
        <div className="min-w-0 flex-1"><p className="truncate font-mono text-xs text-slate-100">{node.name}</p><p className="mt-1 text-[10px] text-slate-600">{node.kind === "folder" ? "Folder" : CATEGORY_LABEL[node.category ?? "other"]}</p></div>
        <button onClick={onClose} aria-label="Close inspector" className="text-slate-600 hover:text-white"><X className="size-4" /></button>
      </div>
      <dl className="space-y-3 border-b border-white/[0.07] p-4 text-xs">
        <InfoRow label="Path" value={node.path} mono />
        <InfoRow label="Size" value={formatBytes(node.size)} />
        {node.kind === "folder" ? <InfoRow label="Items" value={`${node.childIds.length} direct`} /> : <InfoRow label="Lines" value={node.lines ? node.lines.toLocaleString() : "Not analyzed"} />}
      </dl>
      <div className="p-3">
        {node.kind === "folder" ? (
          <NodeSection title="Contents">
            {node.childIds.slice(0, 120).map((id) => {
              const child = model.tree.nodes[id];
              return child ? <NodeButton key={id} node={child} onClick={() => onSelect(child)} /> : null;
            })}
          </NodeSection>
        ) : (
          <>
            <NodeSection title="Internal imports">
              {imports.length ? imports.map((id) => { const target = model.tree.nodes[id]; return target ? <NodeButton key={id} node={target} onClick={() => onSelect(target)} /> : null; }) : <Empty>No resolved internal imports.</Empty>}
            </NodeSection>
            <NodeSection title="External packages">
              {node.externalImports.length ? node.externalImports.map((name) => <p key={name} className="flex items-center gap-2 rounded-md px-2 py-1.5 font-mono text-[11px] text-slate-400"><Braces className="size-3 text-cyan-400" />{name}</p>) : <Empty>No external imports detected.</Empty>}
            </NodeSection>
            <NodeSection title="Imported by">
              {importedBy.length ? importedBy.map((id) => { const target = model.tree.nodes[id]; return target ? <NodeButton key={id} node={target} onClick={() => onSelect(target)} /> : null; }) : <Empty>No dependents detected.</Empty>}
            </NodeSection>
          </>
        )}
      </div>
    </aside>
  );
}

function InfoRow({ label, value, mono }: { label: string; value: string | number; mono?: boolean }) {
  return <div className="flex items-start justify-between gap-3"><dt className="text-slate-600">{label}</dt><dd className={`max-w-[200px] truncate text-right text-slate-300 ${mono ? "font-mono text-[10px]" : ""}`}>{value}</dd></div>;
}

function NodeSection({ title, children }: { title: string; children: React.ReactNode }) {
  return <section className="mb-5"><p className="eyebrow px-2 pb-2">{title}</p>{children}</section>;
}

function NodeButton({ node, onClick }: { node: ProjectNode; onClick: () => void }) {
  return <button onClick={onClick} className="flex w-full items-center gap-2 rounded-lg px-2 py-2 text-left hover:bg-white/[0.04]">{node.kind === "folder" ? <Folder className="size-3.5 text-violet-300" /> : <File className="size-3.5 text-slate-500" />}<span className="min-w-0 flex-1 truncate font-mono text-[11px] text-slate-300">{node.name}</span><span className="font-mono text-[9px] text-slate-700">{node.kind === "file" ? formatBytes(node.size) : node.childIds.length}</span><ChevronRight className="size-3 text-slate-700" /></button>;
}

function Empty({ children }: { children: React.ReactNode }) {
  return <p className="px-2 py-1 text-[11px] text-slate-600">{children}</p>;
}

function ProjectListOverlay({ model, rootId, flat, onSelect }: { model: ProjectModel; rootId: string; flat: boolean; onSelect: (node: ProjectNode) => void }) {
  const ids = flat ? descendantsOf(model.tree, rootId).slice(0, 800) : (model.tree.nodes[rootId]?.childIds ?? []);
  return (
    <div className="panel thin-scroll absolute left-4 top-4 z-10 max-h-[72%] w-[310px] overflow-y-auto rounded-xl p-2 shadow-2xl">
      <div className="flex items-center justify-between px-2 py-1.5"><p className="eyebrow">{flat ? "List" : "Tree"} view</p><span className="font-mono text-[9px] text-slate-600">{ids.length} shown</span></div>
      {ids.map((id) => { const node = model.tree.nodes[id]; return node ? <NodeButton key={id} node={node} onClick={() => onSelect(node)} /> : null; })}
    </div>
  );
}

function StatisticsOverlay({ counts, model }: { counts: Record<FileCategory, number>; model: ProjectModel }) {
  const total = Math.max(1, model.tree.stats.files);
  return (
    <div className="panel absolute right-4 top-4 z-10 w-[260px] rounded-xl p-4 shadow-2xl">
      <p className="eyebrow mb-4">Repository composition</p>
      <div className="space-y-3">
        {CATEGORIES.filter((category) => counts[category] > 0).map((category) => (
          <div key={category}><div className="mb-1 flex justify-between text-[10px]"><span className="text-slate-500">{CATEGORY_LABEL[category]}</span><span className="font-mono text-slate-300">{counts[category]}</span></div><div className="h-1 overflow-hidden rounded-full bg-white/[0.05]"><div className={`h-full rounded-full category-bar-${category}`} style={{ width: `${(counts[category] / total) * 100}%` }} /></div></div>
        ))}
      </div>
    </div>
  );
}

function Hint({ icon, label }: { icon: React.ReactNode; label: string }) {
  return <span className="hidden items-center gap-1.5 px-2 text-[10px] text-slate-500 lg:flex">{icon}{label}</span>;
}
