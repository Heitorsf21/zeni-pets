"use client";

/* eslint-disable @next/next/no-img-element */
import Link from "next/link";
import { usePathname } from "next/navigation";
import type { ReactNode } from "react";
import {
  CalendarClock,
  CalendarDays,
  LayoutDashboard,
  LogOut,
  PawPrint,
  Settings,
  ClipboardList,
  Users,
  Wallet,
} from "lucide-react";
import { logoutAction } from "@/app/(app)/auth-actions";

const nav = [
  { href: "/dashboard", id: "dashboard", label: "Dashboard", icon: LayoutDashboard },
  { href: "/agenda", id: "agenda", label: "Google Agenda", icon: CalendarDays },
  { href: "/reservas", id: "reservas", label: "Reservas", icon: CalendarClock },
  { href: "/tutores", id: "tutores", label: "Tutores", icon: Users },
  { href: "/pets", id: "pets", label: "Pets", icon: PawPrint },
  { href: "/financeiro", id: "financeiro", label: "Financeiro", icon: Wallet },
];

const systemNav = [
  { href: "/configuracoes", id: "configuracoes", label: "Configuracoes", icon: Settings },
  { href: "/importacao", id: "importacao", label: "Importacao", icon: ClipboardList },
];

type ShellCounts = {
  agenda: number;
  reservas: number;
  tutores: number;
  pets: number;
};

type ShellUser = {
  name: string;
  email: string;
  role: "OWNER" | "STAFF";
} | null;

const ROLE_LABEL: Record<"OWNER" | "STAFF", string> = {
  OWNER: "Proprietaria",
  STAFF: "Equipe",
};

function userInitials(name: string) {
  return name
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0]!.toUpperCase())
    .join("");
}

export function AppShell({
  children,
  counts,
  user,
}: {
  children: ReactNode;
  counts: ShellCounts;
  user: ShellUser;
}) {
  const pathname = usePathname();
  const countById: Partial<Record<string, number>> = {
    agenda: counts.agenda,
    reservas: counts.reservas,
    tutores: counts.tutores,
    pets: counts.pets,
  };

  return (
    <div className="app">
      <aside className="sidebar">
        <Link className="sidebar__brand" href="/dashboard">
          <img src="/zeni-logo.png" alt="Zeni Pets" width={34} height={34} />
          <div className="sidebar__brand-text">
            <span className="sidebar__brand-name">Zeni Pets</span>
            <span className="sidebar__brand-sub">Painel interno</span>
          </div>
        </Link>

        <div className="sidebar__section-label">Operacao</div>
        {nav.map((item) => {
          const Icon = item.icon;
          const active = pathname.startsWith(item.href);
          return (
            <Link
              className={`nav-item ${active ? "is-active" : ""}`}
              href={item.href}
              key={item.id}
            >
              <Icon />
              <span>{item.label}</span>
              {countById[item.id] != null ? (
                <span className="nav-item__count">{countById[item.id]}</span>
              ) : null}
            </Link>
          );
        })}

        <div className="sidebar__section-label">Sistema</div>
        {systemNav.map((item) => {
          const Icon = item.icon;
          return (
            <Link
              className={`nav-item ${pathname.startsWith(item.href) ? "is-active" : ""}`}
              href={item.href}
              key={item.id}
            >
              <Icon />
              <span>{item.label}</span>
            </Link>
          );
        })}

        <div className="sidebar__user">
          <div className="sidebar__user-avatar">{user ? userInitials(user.name) : "?"}</div>
          <div className="sidebar__user-info">
            <div className="sidebar__user-name">{user?.name ?? "Usuario"}</div>
            <div className="sidebar__user-role">{user ? ROLE_LABEL[user.role] : ""}</div>
          </div>
          <form action={logoutAction}>
            <button className="btn btn--ghost btn--icon sidebar__logout" type="submit" aria-label="Sair">
              <LogOut />
            </button>
          </form>
        </div>
      </aside>
      <main className="main">{children}</main>
    </div>
  );
}
