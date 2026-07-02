"use client";

// /home renders the full PayFlow SMT application shell (landing + dashboard).
// The root "/" redirects here after painting a minimal static HTML shell,
// so users always see content immediately and never see a JSON error.
import { AppShell } from "@/components/common/app-shell";

export default function HomePage() {
  return <AppShell />;
}
