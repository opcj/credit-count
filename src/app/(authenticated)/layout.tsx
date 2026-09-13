import type { ReactNode } from "react";
import { requireViewer } from "@/lib/data";
import { AppShell } from "@/components/app-shell";
export const dynamic = "force-dynamic";
export default async function AuthenticatedLayout({
  children,
}: {
  children: ReactNode;
}) {
  const viewer = await requireViewer();
  return (
    <AppShell
      name={viewer.profile.display_name}
      userId={viewer.user.id}
      isAdmin={viewer.isAdmin}
    >
      {children}
    </AppShell>
  );
}
