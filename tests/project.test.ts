import assert from "node:assert/strict";
import test from "node:test";

import { buildProjectModel, type RawProject } from "../lib/project";

function localProject(name: string, files: RawProject["files"]): RawProject {
  return {
    name,
    source: { kind: "local", folderName: name },
    files,
  };
}

test("different real file sets produce different normalized graphs and metrics", () => {
  const small = buildProjectModel(localProject("small", [
    { path: "src/index.ts", size: 42, content: "export const value = 1;" },
  ]));
  const linked = buildProjectModel(localProject("linked", [
    { path: "src/index.ts", size: 58, content: "import { test } from './REPOSPHERE_LOCAL_TEST_9281';\ntest();" },
    { path: "src/REPOSPHERE_LOCAL_TEST_9281.ts", size: 35, content: "export const test = () => true;" },
    { path: "styles/main.css", size: 12, content: "body{}" },
  ]));

  assert.notEqual(small.tree.stats.files, linked.tree.stats.files);
  assert.notEqual(small.tree.stats.folders, linked.tree.stats.folders);
  assert.equal(linked.tree.stats.dependencies, 1);
  assert.ok(linked.tree.nodes["file:src/REPOSPHERE_LOCAL_TEST_9281.ts"]);
  assert.ok(linked.graph.edges.some((edge) => edge.to === "file:src/REPOSPHERE_LOCAL_TEST_9281.ts"));
  assert.equal(linked.tree.nodes["file:src/index.ts"]?.externalImports.length, 0);
});

test("ignored generated directories never leak into the project model", () => {
  const model = buildProjectModel(localProject("clean", [
    { path: "src/app.tsx", size: 80, content: "import React from 'react';" },
    { path: "node_modules/fake/OLD_MOCK_FILE.ts", size: 20, content: "" },
    { path: ".next/server/generated.js", size: 20, content: "" },
  ]));

  assert.equal(model.tree.stats.files, 1);
  assert.equal(model.tree.nodes["file:src/app.tsx"]?.externalImports[0], "react");
  assert.equal(model.tree.order.some((id) => id.includes("OLD_MOCK_FILE")), false);
});

test("standard aliases resolve only when a real target exists", () => {
  const model = buildProjectModel(localProject("aliases", [
    { path: "tsconfig.json", size: 150, content: `{
      // Globs inside strings must not be treated as block comments.
      "compilerOptions": { "baseUrl": ".", "paths": { "@/*": ["src/*"], }, },
      "include": ["**/*.ts", "**/*.tsx"],
    }` },
    { path: "src/page.tsx", size: 70, content: "import { Button } from '@/components/Button';\nimport Missing from '@/missing';" },
    { path: "src/components/Button.tsx", size: 45, content: "export const Button = () => null;" },
  ]));

  assert.equal(model.tree.stats.dependencies, 1);
  assert.deepEqual(model.tree.nodes["file:src/page.tsx"]?.unresolvedImports, ["@/missing"]);
});

test("multiple disconnected import groups and standalone files remain in the model", () => {
  const model = buildProjectModel(localProject("full-stack", [
    { path: "app/page.tsx", size: 70, content: "import Header from '@/components/header';\nimport { format } from '@/lib/format';" },
    { path: "components/header.tsx", size: 40, content: "export default function Header() { return null; }" },
    { path: "lib/format.ts", size: 35, content: "export const format = () => 'ok';" },
    { path: "server/route.ts", size: 60, content: "import { db } from './db';\nexport const route = db;" },
    { path: "server/db.ts", size: 30, content: "export const db = {};" },
    { path: "scripts/standalone.ts", size: 20, content: "export const task = true;" },
  ]));

  assert.equal(model.tree.stats.files, 6);
  assert.equal(model.tree.stats.dependencies, 3);
  assert.equal(model.graph.importsOf["file:app/page.tsx"]?.length, 2);
  assert.equal(model.graph.importsOf["file:server/route.ts"]?.length, 1);
  assert.ok(model.tree.nodes["file:scripts/standalone.ts"]);
});
