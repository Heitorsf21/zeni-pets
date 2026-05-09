import type { LucideIcon } from "lucide-react";
import { ArrowUp } from "lucide-react";

export function MetricCard({
  label,
  value,
  hint,
  icon: Icon,
  positive,
}: {
  label: string;
  value: string;
  hint: string;
  icon: LucideIcon;
  positive?: boolean;
}) {
  return (
    <div className="stat">
      <div className="stat__label">
        <Icon />
        {label}
      </div>
      <div className="stat__value">{value}</div>
      {positive ? (
        <div className="stat__delta stat__delta--up">
          <ArrowUp /> {hint}
        </div>
      ) : (
        <div className="stat__hint">{hint}</div>
      )}
    </div>
  );
}
