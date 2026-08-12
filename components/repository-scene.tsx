"use client";

import { Grid, Html, Line, OrbitControls, RoundedBox, Stars } from "@react-three/drei";
import { Canvas, useFrame, useThree } from "@react-three/fiber";
import { useEffect, useMemo, useRef } from "react";
import * as THREE from "three";

import {
  CATEGORY_COLOR,
  TIER_COLOR,
  formatBytes,
  type FileCategory,
  type ProjectModel,
  type ProjectNode,
} from "@/lib/project";

export interface CameraCommand {
  type: "reset" | "fit";
  nonce: number;
}

interface Props {
  model: ProjectModel;
  activeFolderId: string;
  selectedId: string | null;
  hoveredId: string | null;
  filter: FileCategory | "all";
  query: string;
  dependenciesMode: boolean;
  cameraCommand: CameraCommand;
  onSelect: (id: string) => void;
  onHover: (id: string | null) => void;
  onEnterFolder: (id: string) => void;
}

function visibleNodeIds(model: ProjectModel, activeFolderId: string) {
  const tree = model.tree;
  const active = tree.nodes[activeFolderId];
  if (!active) return new Set([tree.rootId]);
  const ids = new Set<string>([activeFolderId]);
  const direct = active.childIds.slice(0, 180);
  direct.forEach((id) => ids.add(id));

  if (direct.length < 90) {
    for (const id of direct) {
      const node = tree.nodes[id];
      if (node?.kind !== "folder") continue;
      for (const childId of node.childIds.slice(0, Math.max(3, Math.floor(90 / Math.max(1, direct.length))))) {
        if (ids.size >= 220) break;
        ids.add(childId);
      }
    }
  }
  return ids;
}

function boundsFor(nodes: ProjectNode[]) {
  if (!nodes.length) return { center: new THREE.Vector3(), distance: 24 };
  const box = new THREE.Box3();
  nodes.forEach((node) => box.expandByPoint(new THREE.Vector3(...node.position)));
  const center = box.getCenter(new THREE.Vector3());
  const size = box.getSize(new THREE.Vector3()).length();
  return { center, distance: Math.max(16, Math.min(72, size * 1.05)) };
}

function CameraRig({
  center,
  distance,
  command,
}: {
  center: THREE.Vector3;
  distance: number;
  command: CameraCommand;
}) {
  const { camera } = useThree();

  useEffect(() => {
    if (command.type === "reset" || command.type === "fit") {
      camera.position.set(center.x + 3, center.y + 6, center.z + distance);
      camera.lookAt(center);
    }
  }, [camera, center, distance, command.nonce, command.type]);

  return <OrbitControls target={center} enableDamping dampingFactor={0.08} minDistance={5} maxDistance={110} />;
}

function Connection({ from, to, dependency, active }: {
  from: [number, number, number];
  to: [number, number, number];
  dependency?: boolean;
  active?: boolean;
}) {
  const points = useMemo(() => {
    const start = new THREE.Vector3(...from);
    const end = new THREE.Vector3(...to);
    const middle = start.clone().lerp(end, 0.5);
    middle.y += start.distanceTo(end) * (dependency ? 0.16 : 0.07);
    return new THREE.QuadraticBezierCurve3(start, middle, end).getPoints(18);
  }, [from, to, dependency]);
  return (
    <Line
      points={points}
      color={dependency ? (active ? "#a999ff" : "#596bd9") : "#44516e"}
      transparent
      opacity={dependency ? (active ? 0.95 : 0.42) : 0.38}
      lineWidth={dependency && active ? 1.8 : 0.8}
      depthWrite={false}
    />
  );
}

function FolderNode({
  node,
  selected,
  hovered,
  dimmed,
  matched,
  onSelect,
  onHover,
  onEnter,
}: NodeProps & { onEnter: (id: string) => void }) {
  const group = useRef<THREE.Group>(null);
  const color = TIER_COLOR[node.tier];
  useFrame((state, delta) => {
    if (!group.current) return;
    const target = selected ? 1.18 : hovered ? 1.1 : 1;
    group.current.scale.lerp(new THREE.Vector3(target, target, target), Math.min(1, delta * 7));
    group.current.position.y = node.position[1] + Math.sin(state.clock.elapsedTime * 0.5 + node.position[0]) * 0.06;
  });

  return (
    <group ref={group} position={node.position}>
      <group
        onPointerOver={(event) => {
          event.stopPropagation();
          onHover(node.id);
          document.body.style.cursor = "pointer";
        }}
        onPointerOut={() => {
          onHover(null);
          document.body.style.cursor = "auto";
        }}
        onClick={(event) => {
          event.stopPropagation();
          onSelect(node.id);
        }}
        onDoubleClick={(event) => {
          event.stopPropagation();
          onEnter(node.id);
        }}
      >
        <RoundedBox args={[1.55, 0.38, 1.12]} radius={0.1} smoothness={3} position={[0, -0.2, 0]}>
          <meshStandardMaterial color={color} emissive={color} emissiveIntensity={selected ? 0.95 : hovered ? 0.72 : 0.4} transparent opacity={dimmed ? 0.22 : 0.95} roughness={0.34} metalness={0.2} />
        </RoundedBox>
        <RoundedBox args={[1.34, 0.32, 0.96]} radius={0.09} smoothness={3} position={[0, 0.13, 0.04]}>
          <meshStandardMaterial color={color} emissive={color} emissiveIntensity={matched ? 0.9 : 0.5} transparent opacity={dimmed ? 0.18 : 0.86} roughness={0.36} />
        </RoundedBox>
        <RoundedBox args={[0.64, 0.17, 0.34]} radius={0.05} smoothness={3} position={[-0.3, 0.36, 0.08]}>
          <meshStandardMaterial color={color} emissive={color} emissiveIntensity={0.65} transparent opacity={dimmed ? 0.16 : 0.9} />
        </RoundedBox>
      </group>
      {selected ? (
        <mesh rotation={[Math.PI / 2, 0, 0]} position={[0, -0.42, 0]}>
          <ringGeometry args={[1.08, 1.16, 48]} />
          <meshBasicMaterial color="#9da8ff" transparent opacity={0.9} side={THREE.DoubleSide} />
        </mesh>
      ) : null}
      {!dimmed ? (
        <Html center distanceFactor={16} position={[0, -0.86, 0]} zIndexRange={[20, 0]}>
          <span className="node-label">{node.name}</span>
        </Html>
      ) : null}
    </group>
  );
}

interface NodeProps {
  node: ProjectNode;
  selected: boolean;
  hovered: boolean;
  dimmed: boolean;
  matched: boolean;
  onSelect: (id: string) => void;
  onHover: (id: string | null) => void;
}

function FileNode({ node, selected, hovered, dimmed, matched, onSelect, onHover }: NodeProps) {
  const group = useRef<THREE.Group>(null);
  const color = CATEGORY_COLOR[node.category ?? "other"];
  useFrame((state, delta) => {
    if (!group.current) return;
    const target = selected ? 1.55 : hovered ? 1.3 : 1;
    group.current.scale.lerp(new THREE.Vector3(target, target, target), Math.min(1, delta * 8));
    group.current.rotation.y += delta * (hovered ? 0.42 : 0.08);
    group.current.position.y = node.position[1] + Math.sin(state.clock.elapsedTime * 0.7 + node.position[2]) * 0.05;
  });

  return (
    <group ref={group} position={node.position}>
      <RoundedBox
        args={[0.45, 0.56, 0.18]}
        radius={0.05}
        smoothness={3}
        onPointerOver={(event) => {
          event.stopPropagation();
          onHover(node.id);
          document.body.style.cursor = "pointer";
        }}
        onPointerOut={() => {
          onHover(null);
          document.body.style.cursor = "auto";
        }}
        onClick={(event) => {
          event.stopPropagation();
          onSelect(node.id);
        }}
      >
        <meshStandardMaterial color={color} emissive={color} emissiveIntensity={selected ? 1.2 : matched ? 0.9 : hovered ? 0.75 : 0.28} transparent opacity={dimmed ? 0.18 : 0.96} roughness={0.3} metalness={0.18} />
      </RoundedBox>
      {(hovered || selected) ? (
        <Html center distanceFactor={14} position={[0, 0.72, 0]} zIndexRange={[40, 0]}>
          <div className="node-tooltip">
            <strong>{node.name}</strong>
            <span>{formatBytes(node.size)}</span>
          </div>
        </Html>
      ) : null}
    </group>
  );
}

function SceneContent(props: Props) {
  const { model, activeFolderId, selectedId, hoveredId, filter, query } = props;
  const visible = useMemo(() => visibleNodeIds(model, activeFolderId), [model, activeFolderId]);
  const visibleNodes = useMemo(
    () => [...visible].map((id) => model.tree.nodes[id]).filter((node): node is ProjectNode => Boolean(node)),
    [visible, model],
  );
  const { center, distance } = useMemo(() => boundsFor(visibleNodes), [visibleNodes]);
  const queryLower = query.trim().toLowerCase();

  return (
    <>
      <color attach="background" args={["#070c15"]} />
      <fog attach="fog" args={["#070c15", 28, 95]} />
      <ambientLight intensity={0.72} />
      <directionalLight position={[8, 12, 12]} intensity={1.25} color="#ced6ff" />
      <pointLight position={[-14, -6, 8]} intensity={34} color="#1ccfc1" distance={46} />
      <Stars radius={58} depth={42} count={700} factor={2.2} saturation={0.35} fade speed={0.15} />
      <Grid position={[center.x, center.y - 9, center.z]} args={[90, 90]} cellSize={1.8} cellColor="#17243d" sectionSize={9} sectionColor="#273a5b" fadeDistance={70} fadeStrength={1.6} infiniteGrid />

      {visibleNodes.map((node) => {
        if (!node.parentId || !visible.has(node.parentId)) return null;
        const parent = model.tree.nodes[node.parentId];
        return parent ? <Connection key={`tree-${node.id}`} from={parent.position} to={node.position} /> : null;
      })}

      {model.graph.edges.map((edge) => {
        if (!visible.has(edge.from) || !visible.has(edge.to)) return null;
        const active = selectedId === edge.from || selectedId === edge.to;
        if (!props.dependenciesMode && !active) return null;
        const from = model.tree.nodes[edge.from];
        const to = model.tree.nodes[edge.to];
        return from && to ? <Connection key={`dep-${edge.from}-${edge.to}`} from={from.position} to={to.position} dependency active={active} /> : null;
      })}

      {visibleNodes.map((node) => {
        const matched = Boolean(queryLower && `${node.name} ${node.path}`.toLowerCase().includes(queryLower));
        const dimmed = (filter !== "all" && node.kind === "file" && node.category !== filter)
          || Boolean(queryLower && !matched);
        const nodeProps = {
          node,
          selected: selectedId === node.id,
          hovered: hoveredId === node.id,
          dimmed,
          matched,
          onSelect: props.onSelect,
          onHover: props.onHover,
        };
        return node.kind === "folder"
          ? <FolderNode key={node.id} {...nodeProps} onEnter={props.onEnterFolder} />
          : <FileNode key={node.id} {...nodeProps} />;
      })}
      <CameraRig center={center} distance={distance} command={props.cameraCommand} />
    </>
  );
}

export function RepositoryScene(props: Props) {
  return (
    <Canvas
      camera={{ position: [3, 7, 28], fov: 48 }}
      dpr={[1, 1.7]}
      gl={{ antialias: true }}
      onPointerMissed={() => props.onHover(null)}
    >
      <SceneContent {...props} />
    </Canvas>
  );
}
