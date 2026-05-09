import type { ReactNode } from "react";
import { AppShell } from "@/components/layout/app-shell";
import { requireUser } from "@/lib/auth";
import { getCurrentUserData, getShellCountsData } from "@/lib/app-data";

export default async function ProtectedLayout({ children }: { children: ReactNode }) {
  const userId = await requireUser();
  const [counts, user] = await Promise.all([
    getShellCountsData(),
    getCurrentUserData(userId),
  ]);
  return <AppShell counts={counts} user={user}>{children}</AppShell>;
}
