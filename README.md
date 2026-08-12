# RepoSphere

RepoSphere is a Next.js application for exploring the real structure of a public GitHub repository or a local project folder as an interactive 3D graph.

## Local development

```bash
npm install
npm run dev
```

The GitHub loader resolves the repository's default branch, retrieves its complete Git tree, and reads real source contents for dependency analysis without unpacking enormous archives in the browser. Local folders are read with `showDirectoryPicker()` where available, with a `webkitdirectory` fallback. Both loaders feed the same normalized project, dependency-analysis, and layout pipeline.
