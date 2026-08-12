import { NextRequest, NextResponse } from "next/server";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const SAFE_SEGMENT = /^[\w.-]+$/;

export async function GET(request: NextRequest) {
  const owner = request.nextUrl.searchParams.get("owner") ?? "";
  const repo = request.nextUrl.searchParams.get("repo") ?? "";
  const branch = request.nextUrl.searchParams.get("branch") ?? "";

  if (!SAFE_SEGMENT.test(owner) || !SAFE_SEGMENT.test(repo) || !branch || branch.length > 200) {
    return NextResponse.json({ error: "Invalid GitHub tree request." }, { status: 400 });
  }

  const response = await fetch(
    `https://api.github.com/repos/${owner}/${repo}/git/trees/${encodeURIComponent(branch)}?recursive=1`,
    {
      headers: {
        Accept: "application/vnd.github+json",
        "User-Agent": "RepoSphere",
        "X-GitHub-Api-Version": "2022-11-28",
        ...(process.env.GITHUB_TOKEN ? { Authorization: `Bearer ${process.env.GITHUB_TOKEN}` } : {}),
      },
      cache: "no-store",
    },
  );

  if (!response.ok) {
    const message = response.status === 403
      ? "GitHub API rate limit reached. Add GITHUB_TOKEN or try again later."
      : `GitHub tree request failed (${response.status}).`;
    return NextResponse.json({ error: message }, { status: response.status });
  }

  const data = (await response.json()) as {
    truncated?: boolean;
    tree?: Array<{ path: string; type: "blob" | "tree" | "commit"; size?: number; sha: string }>;
  };

  if (data.truncated) {
    return NextResponse.json(
      { error: "GitHub truncated this exceptionally large repository tree; RepoSphere will not display incomplete structure." },
      { status: 422 },
    );
  }

  const files = (data.tree ?? [])
    .filter((entry) => entry.type === "blob")
    .map((entry) => ({ path: entry.path, size: entry.size ?? 0, sha: entry.sha }));

  return NextResponse.json({ files, truncated: false });
}
