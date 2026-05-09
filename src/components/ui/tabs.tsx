import Link from "next/link";
import type { ReactNode } from "react";

export type TabItem = {
  id: string;
  label: string;
  href: string;
  icon?: ReactNode;
};

type TabsProps = {
  items: TabItem[];
  activeId: string;
};

export function Tabs({ items, activeId }: TabsProps) {
  return (
    <div className="ficha-tabs">
      {items.map((item) => (
        <Link
          key={item.id}
          href={item.href}
          className={`ficha-tab ${activeId === item.id ? "is-active" : ""}`}
          scroll={false}
        >
          {item.icon}
          {item.label}
        </Link>
      ))}
    </div>
  );
}
