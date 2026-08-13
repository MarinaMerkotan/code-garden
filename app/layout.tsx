import type { Metadata } from "next";
import { IBM_Plex_Sans, JetBrains_Mono } from "next/font/google";
import type { ReactNode } from "react";

import { GoogleAnalytics } from "@/components/google-analytics";
import "./globals.css";

const siteUrl =
  process.env.NEXT_PUBLIC_SITE_URL ??
  process.env.VERCEL_PROJECT_PRODUCTION_URL ??
  process.env.VERCEL_URL ??
  "http://localhost:3000";

const sans = IBM_Plex_Sans({
  variable: "--font-sans",
  subsets: ["latin"],
  weight: ["400", "500", "600"],
});

const mono = JetBrains_Mono({
  variable: "--font-mono",
  subsets: ["latin"],
  weight: ["400", "500", "600"],
});

export const metadata: Metadata = {
  metadataBase: new URL(siteUrl.startsWith("http") ? siteUrl : `https://${siteUrl}`),
  title: "RepoSphere — Interactive 3D codebase explorer",
  description:
    "Load a public GitHub repository or a local folder and explore its real files, metrics, and dependencies in 3D.",
  authors: [{ name: "RepoSphere" }],
  openGraph: {
    title: "RepoSphere — Interactive 3D codebase explorer",
    description:
      "Load a public GitHub repository or a local folder and explore its real files, metrics, and dependencies in 3D.",
    type: "website",
    siteName: "RepoSphere",
  },
  twitter: {
    card: "summary_large_image",
    title: "RepoSphere — Interactive 3D codebase explorer",
    description:
      "Load a public GitHub repository or a local folder and explore its real files, metrics, and dependencies in 3D.",
    images: [{ url: "/opengraph-image", alt: "RepoSphere — Explore your codebase in 3D" }],
  },
};

export default function RootLayout({ children }: Readonly<{ children: ReactNode }>) {
  return (
    <html lang="en" className={`${sans.variable} ${mono.variable}`}>
      <body>
        {children}
        <GoogleAnalytics />
      </body>
    </html>
  );
}
