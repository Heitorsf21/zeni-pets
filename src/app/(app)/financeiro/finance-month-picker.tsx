"use client";

import { useRouter } from "next/navigation";

type Props = {
  defaultValue: string;
  tab: "income" | "expense" | "all";
};

export function FinanceMonthPicker({ defaultValue, tab }: Props) {
  const router = useRouter();

  function hrefForMonth(month: string) {
    const params = new URLSearchParams({ month });
    if (tab !== "all") params.set("tab", tab);
    return `/financeiro?${params.toString()}`;
  }

  return (
    <form className="row" method="get" action="/financeiro" style={{ gap: 8 }}>
      {tab !== "all" ? <input type="hidden" name="tab" value={tab} /> : null}
      <input
        className="input input--month"
        type="month"
        name="month"
        defaultValue={defaultValue}
        aria-label="Mes financeiro"
        onChange={(event) => {
          const value = event.currentTarget.value;
          if (value) router.push(hrefForMonth(value));
        }}
      />
      <button className="btn btn--sm" type="submit">Aplicar filtro</button>
    </form>
  );
}
