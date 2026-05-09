"use client";

import { useRouter } from "next/navigation";

type Props = {
  defaultValue: string;
};

export function AgendaMonthPicker({ defaultValue }: Props) {
  const router = useRouter();
  return (
    <input
      className="input input--month"
      type="month"
      defaultValue={defaultValue}
      aria-label="Ir para mes"
      onChange={(event) => {
        const value = event.currentTarget.value;
        if (value) router.push(`/agenda?month=${value}`);
      }}
    />
  );
}
