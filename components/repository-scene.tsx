"use client";

import { Edges, Grid, Html, Line, OrbitControls, RoundedBox, Stars } from "@react-three/drei";
import { Canvas, useFrame, useThree } from "@react-three/fiber";
import { useEffect, useMemo, useRef } from "react";
import * as THREE from "three";
import type { OrbitControls as OrbitControlsImpl } from "three-stdlib";

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

export function getVisibleNodeIds(
  model: ProjectModel,
  activeFolderId: string,
  selectedId?: string | null,
  dependenciesMode = false,
) {
  const tree = model.tree;
  const active = tree.nodes[activeFolderId];
  if (!active) return new Set([tree.rootId]);

  if (dependenciesMode) {
    const scopePrefix = active.path === "/" ? "/" : `${active.path}/`;
    const isInScope = (id: string) => {
      const node = tree.nodes[id];
      return Boolean(node?.kind === "file" && node.path.startsWith(scopePrefix));
    };
    const scopeFiles = tree.order.filter(isInScope);
    if (scopeFiles.length <= 220) return new Set(scopeFiles);

    const degree = new Map<string, number>();
    for (const edge of model.graph.edges) {
      if (!isInScope(edge.from) || !isInScope(edge.to)) continue;
      degree.set(edge.from, (degree.get(edge.from) ?? 0) + 1);
      degree.set(edge.to, (degree.get(edge.to) ?? 0) + 1);
    }
    const linked = scopeFiles
      .filter((id) => degree.has(id))
      .sort((a, b) => (degree.get(b) ?? 0) - (degree.get(a) ?? 0));
    const ids = new Set(linked.slice(0, 180));
    for (const id of scopeFiles) {
      if (ids.size >= 220) break;
      ids.add(id);
    }
    return ids;
  }

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

  if (selectedId && tree.nodes[selectedId]) {
    let cursor: ProjectNode | undefined = tree.nodes[selectedId];
    while (cursor) {
      ids.add(cursor.id);
      if (cursor.id === activeFolderId) break;
      cursor = cursor.parentId ? tree.nodes[cursor.parentId] : undefined;
    }
  }
  return ids;
}

interface DependencyGroup {
  id: string;
  label: string;
  center: [number, number, number];
  width: number;
  height: number;
  linked: boolean;
}

interface DependencyLayout {
  positions: Map<string, [number, number, number]>;
  groups: DependencyGroup[];
}

function dependencyGroupLabel(model: ProjectModel, ids: string[], linked: boolean) {
  const roots = [...new Set(ids.map((id) => model.tree.nodes[id]?.path.split("/").filter(Boolean)[0] ?? "root"))];
  const scope = roots.length === 1 ? roots[0]! : roots.slice(0, 2).join(" + ");
  return linked ? `${scope} dependencies` : `${scope} · standalone`;
}

function layoutDependencyPositions(model: ProjectModel, visible: Set<string>): DependencyLayout {
  const ids = [...visible].filter((id) => model.tree.nodes[id]?.kind === "file");
  const visibleFiles = new Set(ids);
  const adjacency = new Map(ids.map((id) => [id, new Set<string>()]));
  const visibleEdges = model.graph.edges.filter((edge) => visibleFiles.has(edge.from) && visibleFiles.has(edge.to));
  for (const edge of visibleEdges) {
    adjacency.get(edge.from)?.add(edge.to);
    adjacency.get(edge.to)?.add(edge.from);
  }

  const connected: string[][] = [];
  const isolatedByRoot = new Map<string, string[]>();
  const visited = new Set<string>();
  for (const id of ids) {
    if (visited.has(id)) continue;
    const component: string[] = [];
    const queue = [id];
    visited.add(id);
    while (queue.length) {
      const current = queue.shift()!;
      component.push(current);
      for (const neighbor of adjacency.get(current) ?? []) {
        if (visited.has(neighbor)) continue;
        visited.add(neighbor);
        queue.push(neighbor);
      }
    }
    if (component.length > 1) connected.push(component);
    else {
      const root = model.tree.nodes[id]?.path.split("/").filter(Boolean)[0] ?? "root";
      (isolatedByRoot.get(root) ?? isolatedByRoot.set(root, []).get(root)!).push(id);
    }
  }

  const clusters = [
    ...connected.map((component) => ({ ids: component, linked: true })),
    ...[...isolatedByRoot.values()].map((component) => ({ ids: component, linked: false })),
  ].sort((a, b) => Number(b.linked) - Number(a.linked) || b.ids.length - a.ids.length);

  const localLayouts = clusters.map((cluster, clusterIndex) => {
    const local = new Map<string, [number, number]>();
    if (!cluster.linked) {
      const columns = Math.min(5, Math.max(1, Math.ceil(Math.sqrt(cluster.ids.length))));
      cluster.ids.sort((a, b) => model.tree.nodes[a]!.path.localeCompare(model.tree.nodes[b]!.path));
      cluster.ids.forEach((id, index) => {
        const column = index % columns;
        const row = Math.floor(index / columns);
        local.set(id, [column * 2.25, -row * 1.35]);
      });
    } else {
      const componentSet = new Set(cluster.ids);
      const incoming = new Map(cluster.ids.map((id) => [id, 0]));
      const outgoing = new Map<string, string[]>();
      for (const edge of visibleEdges) {
        if (!componentSet.has(edge.from) || !componentSet.has(edge.to)) continue;
        incoming.set(edge.to, (incoming.get(edge.to) ?? 0) + 1);
        (outgoing.get(edge.from) ?? outgoing.set(edge.from, []).get(edge.from)!).push(edge.to);
      }
      const levels = new Map<string, number>();
      const queue = cluster.ids.filter((id) => (incoming.get(id) ?? 0) === 0).sort();
      if (!queue.length) queue.push(cluster.ids[0]!);
      queue.forEach((id) => levels.set(id, 0));
      while (queue.length) {
        const id = queue.shift()!;
        const level = levels.get(id) ?? 0;
        for (const target of outgoing.get(id) ?? []) {
          levels.set(target, Math.max(levels.get(target) ?? 0, level + 1));
          const remaining = (incoming.get(target) ?? 1) - 1;
          incoming.set(target, remaining);
          if (remaining === 0) queue.push(target);
        }
      }
      cluster.ids.filter((id) => !levels.has(id)).forEach((id) => levels.set(id, 1));
      const columns = new Map<number, string[]>();
      for (const id of cluster.ids) {
        const level = Math.min(5, levels.get(id) ?? 0);
        (columns.get(level) ?? columns.set(level, []).get(level)!).push(id);
      }
      const visualColumns: string[][] = [];
      for (const level of [...columns.keys()].sort((a, b) => a - b)) {
        const column = columns.get(level)!.sort((a, b) => model.tree.nodes[a]!.path.localeCompare(model.tree.nodes[b]!.path));
        for (let start = 0; start < column.length; start += 7) visualColumns.push(column.slice(start, start + 7));
      }
      visualColumns.forEach((column, columnIndex) => {
        column.forEach((id, rowIndex) => local.set(id, [columnIndex * 2.55, -rowIndex * 1.38]));
      });
    }

    const xs = [...local.values()].map(([x]) => x);
    const ys = [...local.values()].map(([, y]) => y);
    const width = (xs.length ? Math.max(...xs) - Math.min(...xs) : 0) + 1.8;
    const height = (ys.length ? Math.max(...ys) - Math.min(...ys) : 0) + 1.8;
    return {
      ...cluster,
      id: `dependency-group-${clusterIndex}`,
      label: dependencyGroupLabel(model, cluster.ids, cluster.linked),
      local,
      width,
      height,
    };
  });

  const positions = new Map<string, [number, number, number]>();
  const groups: DependencyGroup[] = [];
  const targetRowWidth = Math.max(18, Math.sqrt(localLayouts.reduce((sum, group) => sum + group.width * group.height, 0)) * 1.8);
  let cursorX = 0;
  let cursorY = 0;
  let rowHeight = 0;
  for (const group of localLayouts) {
    if (cursorX > 0 && cursorX + group.width > targetRowWidth) {
      cursorX = 0;
      cursorY -= rowHeight + 2.6;
      rowHeight = 0;
    }
    const originX = cursorX + 0.9;
    const originY = cursorY - 0.9;
    for (const [id, [x, y]] of group.local) positions.set(id, [originX + x, originY + y, 0]);
    groups.push({
      id: group.id,
      label: group.label,
      center: [cursorX + group.width / 2, cursorY - group.height / 2, -0.08],
      width: group.width,
      height: group.height,
      linked: group.linked,
    });
    cursorX += group.width + 2.2;
    rowHeight = Math.max(rowHeight, group.height);
  }

  const allPositions = [...positions.values()];
  const centerX = allPositions.length ? (Math.min(...allPositions.map(([x]) => x)) + Math.max(...allPositions.map(([x]) => x))) / 2 : 0;
  const centerY = allPositions.length ? (Math.min(...allPositions.map(([, y]) => y)) + Math.max(...allPositions.map(([, y]) => y))) / 2 : 0;
  for (const [id, [x, y, z]] of positions) positions.set(id, [x - centerX, y - centerY, z]);
  groups.forEach((group) => {
    group.center = [group.center[0] - centerX, group.center[1] - centerY, group.center[2]];
  });
  return { positions, groups };
}

function CameraRig({
  target,
  distance,
  commandNonce,
  frontFacing,
}: {
  target: THREE.Vector3;
  distance: number;
  commandNonce: number;
  frontFacing: boolean;
}) {
  const controls = useRef<OrbitControlsImpl>(null);
  const { camera } = useThree();
  const desiredTarget = useRef(target.clone());
  const desiredPosition = useRef(new THREE.Vector3(0, 6, distance));
  const isAnimating = useRef(false);

  useEffect(() => {
    desiredTarget.current.copy(target);
    const direction = frontFacing
      ? new THREE.Vector3(0, 0.07, 1)
      : camera.position.clone().sub(controls.current?.target ?? target);
    if (direction.lengthSq() < 0.01) direction.set(0.4, 0.5, 1);
    direction.normalize().multiplyScalar(distance);
    desiredPosition.current.copy(target).add(direction);
    isAnimating.current = true;
  }, [camera, target, distance, commandNonce, frontFacing]);

  useFrame((_, delta) => {
    if (!isAnimating.current) return;
    const easing = Math.min(1, delta * 2.6);
    camera.position.lerp(desiredPosition.current, easing);
    if (controls.current) {
      controls.current.target.lerp(desiredTarget.current, easing);
      controls.current.update();
      if (
        camera.position.distanceToSquared(desiredPosition.current) < 0.0025
        && controls.current.target.distanceToSquared(desiredTarget.current) < 0.0025
      ) {
        camera.position.copy(desiredPosition.current);
        controls.current.target.copy(desiredTarget.current);
        controls.current.update();
        isAnimating.current = false;
      }
    }
  });

  return (
    <OrbitControls
      ref={controls}
      enableDamping
      dampingFactor={0.08}
      rotateSpeed={0.65}
      zoomSpeed={0.7}
      panSpeed={0.6}
      minDistance={3}
      maxDistance={60}
      onStart={() => {
        isAnimating.current = false;
      }}
    />
  );
}

function DependencyPulse({
  curve,
  color,
  active,
  phase,
}: {
  curve: THREE.QuadraticBezierCurve3;
  color: string;
  active: boolean;
  phase: number;
}) {
  const pulse = useRef<THREE.Mesh>(null);
  useFrame((state) => {
    if (!pulse.current) return;
    const progress = (state.clock.elapsedTime * (active ? 0.24 : 0.16) + phase) % 1;
    curve.getPointAt(progress, pulse.current.position);
  });
  return (
    <mesh ref={pulse}>
      <sphereGeometry args={[active ? 0.075 : 0.05, 10, 10]} />
      <meshBasicMaterial color={color} transparent opacity={active ? 1 : 0.78} blending={THREE.AdditiveBlending} depthWrite={false} />
    </mesh>
  );
}

function Connection({ from, to, dependency, active, direction, muted }: {
  from: [number, number, number];
  to: [number, number, number];
  dependency?: boolean;
  active?: boolean;
  direction?: "outgoing" | "incoming";
  muted?: boolean;
}) {
  const curve = useMemo(() => {
    const start = new THREE.Vector3(...from);
    const end = new THREE.Vector3(...to);
    const middle = start.clone().lerp(end, 0.5);
    const distance = start.distanceTo(end);
    middle.y += dependency
      ? Math.min(0.85, distance * 0.08) * (start.y <= end.y ? 1 : -1)
      : distance * 0.07;
    return new THREE.QuadraticBezierCurve3(start, middle, end);
  }, [from, to, dependency]);
  const points = useMemo(() => curve.getPoints(dependency ? 28 : 18), [curve, dependency]);
  const color = direction === "outgoing"
    ? "#a999ff"
    : direction === "incoming"
      ? "#36d4df"
      : dependency
        ? active ? "#a999ff" : "#6078d8"
        : "#44516e";
  const arrow = useMemo(() => {
    if (!dependency || points.length < 2) return null;
    const end = points[points.length - 1]!;
    const previous = points[points.length - 3] ?? points[points.length - 2]!;
    const vector = end.clone().sub(previous).normalize();
    return {
      position: end.clone().addScaledVector(vector, -0.32),
      quaternion: new THREE.Quaternion().setFromUnitVectors(new THREE.Vector3(0, 1, 0), vector),
    };
  }, [dependency, points]);
  return (
    <>
      <Line
        points={points}
        color={color}
        transparent
        opacity={muted ? 0.1 : dependency ? (active ? 0.96 : 0.58) : 0.38}
        lineWidth={muted ? 0.6 : dependency && active ? 2 : dependency ? 1.15 : 0.8}
        depthWrite={false}
      />
      {arrow ? (
        <mesh position={arrow.position} quaternion={arrow.quaternion}>
          <coneGeometry args={[active ? 0.09 : 0.065, active ? 0.23 : 0.17, 7]} />
          <meshBasicMaterial color={color} transparent opacity={muted ? 0.12 : active ? 0.96 : 0.72} />
        </mesh>
      ) : null}
      {dependency && !muted ? <DependencyPulse curve={curve} color={color} active={Boolean(active)} phase={0} /> : null}
      {dependency && active ? <DependencyPulse curve={curve} color={color} active phase={0.48} /> : null}
    </>
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
  position,
}: NodeProps & { onEnter: (id: string) => void }) {
  const group = useRef<THREE.Group>(null);
  const icon = useRef<THREE.Group>(null);
  const { camera } = useThree();
  const color = TIER_COLOR[node.tier];
  const brightColor = useMemo(
    () => new THREE.Color(color).lerp(new THREE.Color("#ffffff"), 0.16).getStyle(),
    [color],
  );
  const deepColor = useMemo(
    () => new THREE.Color(color).lerp(new THREE.Color("#05091a"), 0.34).getStyle(),
    [color],
  );
  const opacity = dimmed ? 0.16 : 0.96;
  useFrame((state, delta) => {
    if (!group.current) return;
    const target = selected ? 1.18 : hovered ? 1.1 : 1;
    group.current.scale.lerp(new THREE.Vector3(target, target, target), Math.min(1, delta * 7));
    group.current.position.y = position[1] + Math.sin(state.clock.elapsedTime * 0.5 + position[0]) * 0.06;
    icon.current?.quaternion.slerp(camera.quaternion, Math.min(1, delta * 12));
  });

  return (
    <group ref={group} position={position}>
      <group
        ref={icon}
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
        <RoundedBox args={[1.34, 0.64, 0.1]} radius={0.025} smoothness={2} position={[0.09, 0.06, -0.07]}>
          <meshStandardMaterial color={deepColor} emissive={color} emissiveIntensity={0.2} transparent opacity={opacity * 0.68} roughness={0.38} metalness={0.14} />
        </RoundedBox>
        <RoundedBox args={[0.54, 0.16, 0.1]} radius={0.02} smoothness={2} position={[-0.25, 0.43, -0.065]}>
          <meshStandardMaterial color={deepColor} emissive={color} emissiveIntensity={0.22} transparent opacity={opacity * 0.7} roughness={0.36} metalness={0.12} />
        </RoundedBox>

        <RoundedBox args={[1.38, 0.66, 0.12]} radius={0.03} smoothness={2} position={[0, 0, 0]}>
          <meshStandardMaterial color={color} emissive={color} emissiveIntensity={selected ? 0.62 : hovered ? 0.46 : 0.26} transparent opacity={opacity * 0.94} roughness={0.34} metalness={0.12} />
          <Edges color={brightColor} transparent opacity={opacity * 0.4} />
        </RoundedBox>
        <RoundedBox args={[0.56, 0.17, 0.12]} radius={0.022} smoothness={2} position={[-0.29, 0.43, 0.005]}>
          <meshStandardMaterial color={brightColor} emissive={color} emissiveIntensity={selected ? 0.58 : 0.34} transparent opacity={opacity * 0.95} roughness={0.32} metalness={0.1} />
        </RoundedBox>

        <RoundedBox args={[1.42, 0.43, 0.075]} radius={0.028} smoothness={2} position={[0, -0.13, 0.095]}>
          <meshStandardMaterial color={brightColor} emissive={color} emissiveIntensity={matched ? 0.72 : selected ? 0.58 : hovered ? 0.44 : 0.3} transparent opacity={opacity} roughness={0.3} metalness={0.1} />
          <Edges color={brightColor} transparent opacity={opacity * 0.44} />
        </RoundedBox>
        <RoundedBox args={[1.12, 0.025, 0.012]} radius={0.004} smoothness={2} position={[0, 0.055, 0.137]}>
          <meshBasicMaterial color={deepColor} transparent opacity={opacity * 0.54} />
        </RoundedBox>
        {(hovered || selected) ? <pointLight color={color} intensity={selected ? 2.2 : 1.2} distance={3} position={[0, 0.05, 0.5]} /> : null}
      </group>
      {selected ? (
        <mesh rotation={[Math.PI / 2, 0, 0]} position={[0, -0.5, 0]}>
          <ringGeometry args={[0.96, 1.04, 48]} />
          <meshBasicMaterial color="#9da8ff" transparent opacity={0.9} side={THREE.DoubleSide} />
        </mesh>
      ) : null}
      {!dimmed ? (
        <Html center distanceFactor={16} position={[0, -0.78, 0]} zIndexRange={[20, 0]}>
          <span className="node-label dependency-node-label" title={node.name}>{node.name}</span>
        </Html>
      ) : null}
    </group>
  );
}

interface NodeProps {
  node: ProjectNode;
  position: [number, number, number];
  selected: boolean;
  hovered: boolean;
  dimmed: boolean;
  matched: boolean;
  onSelect: (id: string) => void;
  onHover: (id: string | null) => void;
  showLabel?: boolean;
  dependencyMode?: boolean;
}

function FileNode({ node, position, selected, hovered, dimmed, matched, onSelect, onHover, showLabel, dependencyMode }: NodeProps) {
  const group = useRef<THREE.Group>(null);
  const icon = useRef<THREE.Group>(null);
  const { camera } = useThree();
  const color = CATEGORY_COLOR[node.category ?? "other"];
  const brightColor = useMemo(
    () => new THREE.Color(color).lerp(new THREE.Color("#ffffff"), 0.3).getStyle(),
    [color],
  );
  const deepColor = useMemo(
    () => new THREE.Color(color).lerp(new THREE.Color("#040817"), 0.38).getStyle(),
    [color],
  );
  const opacity = dimmed ? 0.16 : 0.96;
  useFrame((state, delta) => {
    if (!group.current) return;
    const target = selected
      ? dependencyMode ? 1.16 : 1.55
      : hovered ? dependencyMode ? 1.12 : 1.3
        : 1;
    group.current.scale.lerp(new THREE.Vector3(target, target, target), Math.min(1, delta * 8));
    group.current.position.y = position[1] + Math.sin(state.clock.elapsedTime * 0.7 + position[0]) * 0.035;
    icon.current?.quaternion.slerp(camera.quaternion, Math.min(1, delta * 12));
  });

  return (
    <group ref={group} position={position}>
      <group
        ref={icon}
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
        <RoundedBox args={[0.46, 0.62, 0.075]} radius={0.018} smoothness={2} position={[0.04, 0.035, -0.035]}>
          <meshStandardMaterial color={deepColor} emissive={color} emissiveIntensity={0.18} transparent opacity={opacity * 0.66} roughness={0.38} metalness={0.16} />
        </RoundedBox>
        <RoundedBox args={[0.46, 0.62, 0.085]} radius={0.02} smoothness={2} position={[0, 0, 0.02]}>
          <meshStandardMaterial color={color} emissive={color} emissiveIntensity={selected ? 0.9 : matched ? 0.72 : hovered ? 0.58 : 0.28} transparent opacity={opacity} roughness={0.32} metalness={0.12} />
          <Edges color={brightColor} transparent opacity={opacity * 0.58} />
        </RoundedBox>
        <RoundedBox args={[0.34, 0.055, 0.012]} radius={0.008} smoothness={2} position={[-0.025, 0.17, 0.07]}>
          <meshBasicMaterial color={brightColor} transparent opacity={opacity * 0.66} />
        </RoundedBox>
        <RoundedBox args={[0.23, 0.032, 0.012]} radius={0.006} smoothness={2} position={[-0.075, 0.045, 0.07]}>
          <meshBasicMaterial color={brightColor} transparent opacity={opacity * 0.42} />
        </RoundedBox>
        <RoundedBox args={[0.28, 0.032, 0.012]} radius={0.006} smoothness={2} position={[-0.05, -0.045, 0.07]}>
          <meshBasicMaterial color={brightColor} transparent opacity={opacity * 0.35} />
        </RoundedBox>
        {(hovered || selected) ? <pointLight color={color} intensity={selected ? 2.4 : 1.4} distance={2.6} position={[0, 0, 0.5]} /> : null}
      </group>
      {(hovered || (selected && !dependencyMode)) ? (
        <Html
          center
          distanceFactor={14}
          position={[0, 0.72, 0]}
          zIndexRange={[40, 0]}
          style={{ pointerEvents: "none", userSelect: "none" }}
        >
          <div className="node-tooltip">
            <strong>{node.name}</strong>
            <span>{formatBytes(node.size)}</span>
          </div>
        </Html>
      ) : null}
      {showLabel && !hovered ? (
        <Html
          center
          distanceFactor={17}
          position={[0, -0.48, 0]}
          zIndexRange={[18, 0]}
          style={{ pointerEvents: "none", userSelect: "none", opacity: dimmed ? 0.22 : 1 }}
        >
          <span className="node-label">{node.name}</span>
        </Html>
      ) : null}
    </group>
  );
}

function DependencyGroupRegion({ group }: { group: DependencyGroup }) {
  const color = group.linked ? "#596bd9" : "#2d766f";
  return (
    <group>
      <RoundedBox
        args={[group.width + 0.5, group.height + 0.65, 0.025]}
        radius={0.16}
        smoothness={3}
        position={group.center}
      >
        <meshBasicMaterial color={color} transparent opacity={0.055} depthWrite={false} />
        <Edges color={color} transparent opacity={0.18} />
      </RoundedBox>
      <Html
        center
        position={[group.center[0], group.center[1] + group.height / 2 + 0.56, -0.04]}
        distanceFactor={19}
        zIndexRange={[12, 0]}
        style={{ pointerEvents: "none", userSelect: "none" }}
      >
        <span className={`dependency-group-label ${group.linked ? "dependency-group-linked" : ""}`}>
          {group.label}
        </span>
      </Html>
    </group>
  );
}

function SceneContent(props: Props) {
  const { model, activeFolderId, selectedId, hoveredId, filter, query } = props;
  const visible = useMemo(
    () => getVisibleNodeIds(model, activeFolderId, selectedId, props.dependenciesMode),
    [model, activeFolderId, selectedId, props.dependenciesMode],
  );
  const visibleNodes = useMemo(
    () => [...visible].map((id) => model.tree.nodes[id]).filter((node): node is ProjectNode => Boolean(node)),
    [visible, model],
  );
  const dependencyLayout = useMemo<DependencyLayout>(
    () => props.dependenciesMode
      ? layoutDependencyPositions(model, visible)
      : { positions: new Map<string, [number, number, number]>(), groups: [] },
    [model, visible, props.dependenciesMode],
  );
  const dependencyFocus = useMemo(() => {
    const selected = selectedId ? model.tree.nodes[selectedId] : undefined;
    if (!props.dependenciesMode || selected?.kind !== "file" || !visible.has(selected.id)) return null;
    return new Set([
      selected.id,
      ...(model.graph.importsOf[selected.id] ?? []),
      ...(model.graph.importedBy[selected.id] ?? []),
    ]);
  }, [model, selectedId, visible, props.dependenciesMode]);
  const positionFor = (node: ProjectNode): [number, number, number] => {
    if (!props.dependenciesMode) return node.position;
    return dependencyLayout.positions.get(node.id) ?? [0, 0, 0];
  };
  const queryLower = query.trim().toLowerCase();
  const cameraFocusId = props.dependenciesMode ? activeFolderId : selectedId ?? activeFolderId;
  const cameraTarget = useMemo(() => {
    if (props.dependenciesMode) return new THREE.Vector3(0, 0, 0);
    const node = model.tree.nodes[cameraFocusId] ?? model.tree.nodes[activeFolderId];
    return new THREE.Vector3(...(node?.position ?? [0, 0, 0]));
  }, [cameraFocusId, activeFolderId, model.tree.nodes, props.dependenciesMode]);
  const cameraDistance = props.dependenciesMode
    ? activeFolderId === model.tree.rootId ? 23 : 15
    : selectedId
      ? model.tree.nodes[selectedId]?.kind === "file" ? 5.5 : 8.5
      : activeFolderId === model.tree.rootId ? 23 : 15;

  return (
    <>
      <color attach="background" args={["#070c15"]} />
      <fog attach="fog" args={["#070c15", 28, 95]} />
      <ambientLight intensity={0.72} />
      <directionalLight position={[8, 12, 12]} intensity={1.25} color="#ced6ff" />
      <pointLight position={[-14, -6, 8]} intensity={34} color="#1ccfc1" distance={46} />
      <Stars radius={58} depth={42} count={700} factor={2.2} saturation={0.35} fade speed={0.15} />
      <Grid position={[0, -9, 0]} args={[90, 90]} cellSize={1.8} cellColor="#17243d" sectionSize={9} sectionColor="#273a5b" fadeDistance={70} fadeStrength={1.6} infiniteGrid />

      {props.dependenciesMode
        ? dependencyLayout.groups.map((group) => <DependencyGroupRegion key={group.id} group={group} />)
        : null}

      {visibleNodes.map((node) => {
        if (props.dependenciesMode) return null;
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
        const direction = selectedId === edge.from
          ? "outgoing"
          : selectedId === edge.to
            ? "incoming"
            : undefined;
        return from && to ? <Connection key={`dep-${edge.from}-${edge.to}`} from={positionFor(from)} to={positionFor(to)} dependency active={active} direction={direction} muted={Boolean(dependencyFocus && !active)} /> : null;
      })}

      {visibleNodes.map((node) => {
        const matched = Boolean(queryLower && `${node.name} ${node.path}`.toLowerCase().includes(queryLower));
        const dimmed = (filter !== "all" && node.kind === "file" && node.category !== filter)
          || Boolean(queryLower && !matched)
          || Boolean(dependencyFocus && !dependencyFocus.has(node.id));
        const nodeProps = {
          node,
          position: positionFor(node),
          selected: selectedId === node.id,
          hovered: hoveredId === node.id,
          dimmed,
          matched,
          onSelect: props.onSelect,
          onHover: props.onHover,
          showLabel: props.dependenciesMode,
          dependencyMode: props.dependenciesMode,
        };
        return node.kind === "folder"
          ? <FolderNode key={node.id} {...nodeProps} onEnter={props.onEnterFolder} />
          : <FileNode key={node.id} {...nodeProps} />;
      })}
      <CameraRig
        target={cameraTarget}
        distance={cameraDistance}
        commandNonce={props.cameraCommand.nonce}
        frontFacing={props.dependenciesMode}
      />
    </>
  );
}

export function RepositoryScene(props: Props) {
  return (
    <Canvas
      camera={{ position: [3, 7, 26], fov: 48 }}
      dpr={[1, 1.7]}
      gl={{ antialias: true }}
      onPointerMissed={() => props.onHover(null)}
    >
      <SceneContent {...props} />
    </Canvas>
  );
}
