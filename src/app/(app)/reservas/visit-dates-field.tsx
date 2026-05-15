"use client";

import { Plus, X } from "lucide-react";
import { useState } from "react";

type Props = {
  name?: string;
  defaultDates?: string[];
};

function sortDates(values: string[]) {
  return [...values].sort();
}

function formatBR(value: string) {
  const [y, m, d] = value.split("-");
  if (!y || !m || !d) return value;
  return `${d}/${m}/${y}`;
}

export function VisitDatesField({ name = "visitDates", defaultDates = [] }: Props) {
  const [dates, setDates] = useState<string[]>(sortDates(defaultDates));
  const [draft, setDraft] = useState<string>("");

  function add() {
    if (!draft) return;
    setDates((current) => (current.includes(draft) ? current : sortDates([...current, draft])));
    setDraft("");
  }

  function remove(value: string) {
    setDates((current) => current.filter((item) => item !== value));
  }

  return (
    <div className="field" style={{ gridColumn: "1 / -1" }}>
      <span className="field__label">Datas da visita</span>
      <div className="row" style={{ gap: 8, alignItems: "stretch" }}>
        <input
          className="input"
          type="date"
          value={draft}
          onChange={(event) => setDraft(event.target.value)}
          onKeyDown={(event) => {
            if (event.key === "Enter") {
              event.preventDefault();
              add();
            }
          }}
          style={{ flex: 1 }}
          aria-label="Adicionar data de visita"
        />
        <button
          type="button"
          className="btn"
          onClick={add}
          disabled={!draft}
          aria-label="Adicionar data"
        >
          <Plus style={{ width: 14, height: 14 }} /> Adicionar
        </button>
      </div>

      {dates.length === 0 ? (
        <p className="subtle" style={{ margin: "8px 0 0", fontSize: 12 }}>
          Adicione cada dia que o serviço será realizado (ex: 05/05, 06/05, 09/05).
        </p>
      ) : (
        <ul
          style={{
            display: "flex",
            flexWrap: "wrap",
            gap: 6,
            margin: "8px 0 0",
            padding: 0,
            listStyle: "none",
          }}
        >
          {dates.map((value) => (
            <li
              key={value}
              style={{
                display: "inline-flex",
                alignItems: "center",
                gap: 6,
                background: "var(--bg-subtle)",
                color: "var(--text)",
                border: "1px solid var(--border)",
                padding: "4px 8px",
                borderRadius: 999,
                fontSize: 12,
              }}
            >
              {formatBR(value)}
              <button
                type="button"
                onClick={() => remove(value)}
                aria-label={`Remover ${formatBR(value)}`}
                style={{
                  background: "transparent",
                  border: 0,
                  cursor: "pointer",
                  display: "inline-flex",
                  padding: 0,
                  color: "var(--muted)",
                }}
              >
                <X style={{ width: 12, height: 12 }} />
              </button>
            </li>
          ))}
        </ul>
      )}

      {dates.length > 0 ? (
        <p className="subtle" style={{ margin: "6px 0 0", fontSize: 11 }}>
          {dates.length} {dates.length === 1 ? "visita" : "visitas"} adicionada{dates.length === 1 ? "" : "s"}.
        </p>
      ) : null}

      {dates.map((value) => (
        <input key={value} type="hidden" name={name} value={value} />
      ))}
    </div>
  );
}
