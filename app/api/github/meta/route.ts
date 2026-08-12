import { NextRequest, NextResponse } from "next/server";

export const runtime = "nodejs";

const SAFE_SEGMENT = /^[\w.-]+$/;

export async function GET(request: NextRequest) {
  const owner = request.nextUrl.searchParams.get("owner") ?? "";
  const repo = request.nextUrl.searchParams.get("repo") ?? "";

  if (!SAFE_SEGMENT.test(owner) || !SAFE_SEGMENT.test(repo)) {
    return NextResponse.json({ error: "Invalid GitHub repository." }, { status: 400 });
  }

  const response = await fetch(`https://api.github.com/repos/${owner}/${repo}`, {
    headers: {
      Accept: "application/vnd.github+json",
      "User-Agent": "RepoSphere",
      "X-GitHub-Api-Version": "2022-11-28",
    },
    cache: "no-store",
  });

  if (!response.ok) {
    const message = response.status === 404
      ? "Repository not found or it is not public."
      : `GitHub returned ${response.status}. Please try again.`;
    return NextResponse.json({ error: message }, { status: response.status });
  }

  const data = (await response.json()) as {
    name: string;
    full_name: string;
    default_branch: string;
    size: number;
  };

  return NextResponse.json({
    name: data.name,
    fullName: data.full_name,
    defaultBranch: data.default_branch,
    repositorySizeKb: data.size,
  });
}
