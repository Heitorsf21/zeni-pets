"use client";

import { GitMerge, Loader2, Search, X } from "lucide-react";
import Link from "next/link";
import { useCallback, useDeferredValue, useEffect, useMemo, useRef, useState } from "react";
import { StatusBadge } from "@/components/ui/status-badge";
import {
  mergeTutoresManualmenteAction,
  previewMergeTutorsAction,
  type TutorMergeFieldDiff,
  type TutorMergePreview,
  type TutorMergePreviewItem,
} from "./merge-actions";

export type TutorRow = {
  id: string;
  name: string;
  phone: string;
  secondaryPhone: string;
  secondaryPhoneNote: string;
  email: string;
  pets: string;
  reservations: number;
  since: string;
  lastVisit: string;
  status: "ACTIVE" | "INACTIVE";
};

const FIELD_LABELS: Record<TutorMergeFieldDiff["field"], string> = {
  email: "E-mail",
  phone: "Telefone",
  secondaryPhone: "Segundo telefone",
  secondaryPhoneNote: "Obs. segundo telefone",
  document: "CPF/RG",
  birthDate: "Nascimento",
  address: "Endereço",
  cep: "CEP",
  notes: "Observações",
};

function formatFieldValue(field: TutorMergeFieldDiff["field"], value: string | null): string {
  if (!value) return "—";
  if (field === "birthDate") {
    const date = new Date(value);
    if (!Number.isNaN(date.getTime())) {
      return new Intl.DateTimeFormat("pt-BR", { day: "2-digit", month: "2-digit", year: "numeric" }).format(date);
    }
  }
  if (value.length > 60) return `${value.slice(0, 57)}...`;
  return value;
}

export function TutoresListClient({ tutors }: { tutors: TutorRow[] }) {
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [preview, setPreview] = useState<TutorMergePreview | null>(null);
  const [loadingPreview, setLoadingPreview] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [canonicalId, setCanonicalId] = useState<string | null>(null);
  const [overrides, setOverrides] = useState<Record<string, string>>({});
  const [confirm, setConfirm] = useState(false);
  const dialogRef = useRef<HTMLDialogElement>(null);
  const [searchQuery, setSearchQuery] = useState("");
  const deferredQuery = useDeferredValue(searchQuery);

  const filteredTutors = useMemo(() => {
    const q = deferredQuery.trim().toLowerCase();
    if (!q) return tutors;
    return tutors.filter((tutor) =>
      [tutor.name, tutor.phone, tutor.secondaryPhone, tutor.secondaryPhoneNote, tutor.email, tutor.pets]
        .some((field) => field && field.toLowerCase().includes(q))
    );
  }, [tutors, deferredQuery]);

  const toggle = useCallback((id: string) => {
    setSelected((current) => {
      const next = new Set(current);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }, []);

  const allChecked = filteredTutors.length > 0 && filteredTutors.every((t) => selected.has(t.id));
  const toggleAll = () => {
    if (allChecked) {
      setSelected((current) => {
        const next = new Set(current);
        filteredTutors.forEach((t) => next.delete(t.id));
        return next;
      });
    } else {
      setSelected((current) => {
        const next = new Set(current);
        filteredTutors.forEach((t) => next.add(t.id));
        return next;
      });
    }
  };

  const clear = () => setSelected(new Set());

  const closeDialog = useCallback(() => {
    dialogRef.current?.close();
    setPreview(null);
    setLoadingPreview(false);
    setCanonicalId(null);
    setOverrides({});
    setConfirm(false);
  }, []);

  const openMerge = async () => {
    if (selected.size < 2) return;
    setLoadingPreview(true);
    setPreview(null);
    setOverrides({});
    setConfirm(false);
    dialogRef.current?.showModal();
    try {
      const result = await previewMergeTutorsAction(Array.from(selected));
      setPreview(result);
      if (result.ok) setCanonicalId(result.suggestedCanonicalId);
    } catch (error) {
      setPreview({ ok: false, error: error instanceof Error ? error.message : "Falha ao carregar preview" });
    } finally {
      setLoadingPreview(false);
    }
  };

  useEffect(() => {
    const dialog = dialogRef.current;
    if (!dialog) return;
    const onClick = (event: MouseEvent) => {
      if (event.target === dialog) closeDialog();
    };
    dialog.addEventListener("click", onClick);
    return () => dialog.removeEventListener("click", onClick);
  }, [closeDialog]);

  const tutorsById = useMemo(() => {
    if (!preview || !preview.ok) return new Map<string, TutorMergePreviewItem>();
    return new Map(preview.tutors.map((tutor) => [tutor.id, tutor]));
  }, [preview]);

  const totals = useMemo(() => {
    if (!preview || !preview.ok || !canonicalId) {
      return { pets: 0, reservations: 0, tasks: 0, duplicates: 0 };
    }
    const duplicates = preview.tutors.filter((tutor) => tutor.id !== canonicalId);
    return {
      pets: duplicates.reduce((sum, tutor) => sum + tutor.petsCount, 0),
      reservations: duplicates.reduce((sum, tutor) => sum + tutor.reservationsCount, 0),
      tasks: duplicates.reduce((sum, tutor) => sum + tutor.tasksCount, 0),
      duplicates: duplicates.length,
    };
  }, [preview, canonicalId]);

  return (
    <>
      <div className="row" style={{ gap: 8, alignItems: "center", padding: "0 16px 12px", flexWrap: "wrap" }}>
        <label className="field" style={{ flex: 1, minWidth: 240, margin: 0 }}>
          <span className="row" style={{ position: "relative", alignItems: "center" }}>
            <Search style={{ position: "absolute", left: 10, width: 16, height: 16, color: "var(--muted)" }} />
            <input
              className="input"
              type="search"
              placeholder="Buscar por nome, telefone, e-mail, observação ou pet"
              value={searchQuery}
              onChange={(event) => setSearchQuery(event.target.value)}
              style={{ paddingLeft: 32, width: "100%" }}
            />
          </span>
        </label>
        <span className="subtle" style={{ fontSize: 12 }}>
          {filteredTutors.length} de {tutors.length} {tutors.length === 1 ? "tutor" : "tutores"}
        </span>
      </div>

      {selected.size >= 2 ? (
        <div className="alert" role="status" style={{ display: "flex", justifyContent: "space-between", alignItems: "center", background: "var(--surface)", borderColor: "var(--border)" }}>
          <div>
            <strong>{selected.size} tutores selecionados.</strong>{" "}
            <span className="subtle">Use a mesclagem para juntar registros duplicados em um so.</span>
          </div>
          <div className="row" style={{ gap: 8 }}>
            <button type="button" className="btn" onClick={clear}>Limpar</button>
            <button type="button" className="btn btn--primary" onClick={openMerge}>
              <GitMerge /> Mesclar tutores
            </button>
          </div>
        </div>
      ) : null}

      <div className="card__body card__body--flush" style={{ overflowX: "auto" }}>
        <table className="table" style={{ minWidth: 960 }}>
          <thead>
            <tr>
              <th style={{ width: 36 }}>
                <input
                  type="checkbox"
                  aria-label="Selecionar todos"
                  checked={allChecked}
                  onChange={toggleAll}
                />
              </th>
              <th>Tutor</th>
              <th>Contato</th>
              <th>Pets</th>
              <th>Reservas</th>
              <th>Cliente desde</th>
              <th>Ultima visita</th>
              <th>Status</th>
            </tr>
          </thead>
          <tbody>
            {filteredTutors.length === 0 ? (
              <tr>
                <td colSpan={8} className="muted" style={{ textAlign: "center", padding: 24 }}>
                  Nenhum tutor encontrado.
                </td>
              </tr>
            ) : null}
            {filteredTutors.map((tutor) => (
              <tr key={tutor.id} style={selected.has(tutor.id) ? { background: "var(--surface-2, #f5f7fb)" } : undefined}>
                <td>
                  <input
                    type="checkbox"
                    aria-label={`Selecionar ${tutor.name}`}
                    checked={selected.has(tutor.id)}
                    onChange={() => toggle(tutor.id)}
                  />
                </td>
                <td>
                  <Link href={`/tutores/${tutor.id}/ficha`}>
                    <strong>{tutor.name}</strong>
                    <div className="subtle">{tutor.email}</div>
                  </Link>
                </td>
                <td>
                  <div className="mono">{tutor.phone || "-"}</div>
                  {tutor.secondaryPhone ? (
                    <div className="subtle mono" style={{ fontSize: 12 }}>{tutor.secondaryPhone}</div>
                  ) : null}
                  {tutor.secondaryPhoneNote ? (
                    <div className="subtle" style={{ fontSize: 11 }}>{tutor.secondaryPhoneNote}</div>
                  ) : null}
                </td>
                <td>{tutor.pets}</td>
                <td className="mono">{tutor.reservations}</td>
                <td>{tutor.since}</td>
                <td>{tutor.lastVisit}</td>
                <td><StatusBadge status={tutor.status} /></td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <dialog ref={dialogRef} className="modal" style={{ width: 880, maxWidth: "calc(100vw - 32px)" }}>
        <div className="modal__header">
          <h2 className="modal__title">Mesclar tutores</h2>
          <button type="button" className="btn btn--ghost btn--icon" aria-label="Fechar" onClick={closeDialog}>
            <X />
          </button>
        </div>
        <div className="modal__body">
          {loadingPreview ? (
            <div className="row" style={{ justifyContent: "center", padding: 32 }}>
              <Loader2 style={{ animation: "spin 1s linear infinite" }} /> Carregando comparação...
            </div>
          ) : null}

          {preview && !preview.ok ? (
            <div className="alert alert--danger" role="alert">{preview.error}</div>
          ) : null}

          {preview && preview.ok && canonicalId ? (
            <form
              action={async (formData) => {
                setSubmitting(true);
                try {
                  await mergeTutoresManualmenteAction(formData);
                } finally {
                  setSubmitting(false);
                }
              }}
              className="stack"
              style={{ gap: 16 }}
            >
              <input type="hidden" name="canonicalId" value={canonicalId} />
              {preview.tutors
                .filter((tutor) => tutor.id !== canonicalId)
                .map((tutor) => (
                  <input key={tutor.id} type="hidden" name="mergeIds" value={tutor.id} />
                ))}

              {preview.warnings.length ? (
                <div className="alert alert--danger" role="alert" style={{ background: "rgba(255, 200, 0, 0.12)", color: "#7a4a00", borderColor: "#f0b400" }}>
                  <strong>Atenção</strong>
                  <ul style={{ margin: "8px 0 0 16px", padding: 0 }}>
                    {preview.warnings.map((warning, idx) => (
                      <li key={idx}>{warning}</li>
                    ))}
                  </ul>
                </div>
              ) : null}

              <section>
                <div className="card__title" style={{ marginBottom: 8 }}>1. Tutor canonico</div>
                <div className="subtle" style={{ marginBottom: 8 }}>
                  Os pets, reservas e tarefas dos demais serao transferidos para o canonico. Os outros registros serao removidos.
                </div>
                <div style={{ display: "grid", gridTemplateColumns: `repeat(${preview.tutors.length}, minmax(0, 1fr))`, gap: 12 }}>
                  {preview.tutors.map((tutor) => {
                    const isCanonical = tutor.id === canonicalId;
                    return (
                      <label
                        key={tutor.id}
                        className="card"
                        style={{
                          padding: 12,
                          borderColor: isCanonical ? "var(--brand, #0a66ff)" : undefined,
                          borderWidth: isCanonical ? 2 : 1,
                          cursor: "pointer",
                        }}
                      >
                        <div className="row" style={{ gap: 8, alignItems: "flex-start" }}>
                          <input
                            type="radio"
                            name="canonical-pick"
                            checked={isCanonical}
                            onChange={() => setCanonicalId(tutor.id)}
                          />
                          <div style={{ flex: 1 }}>
                            <div><strong>{tutor.name}</strong></div>
                            <div className="subtle" style={{ fontSize: 12 }}>
                              {tutor.petsCount} pets · {tutor.reservationsCount} reservas · {tutor.tasksCount} tarefas
                            </div>
                            <div className="subtle" style={{ fontSize: 12 }}>{tutor.phone ?? "Sem telefone"}</div>
                            <div className="subtle" style={{ fontSize: 12 }}>{tutor.email ?? "Sem email"}</div>
                          </div>
                        </div>
                      </label>
                    );
                  })}
                </div>
              </section>

              {preview.fields.some((field) => field.divergent) ? (
                <section>
                  <div className="card__title" style={{ marginBottom: 8 }}>2. Campos divergentes</div>
                  <div className="subtle" style={{ marginBottom: 8 }}>
                    Para cada campo abaixo, escolha qual valor deve ficar no tutor canônico. &quot;Automático&quot; mantém o valor do canônico se houver, senão pega o primeiro não vazio.
                  </div>
                  <div className="stack" style={{ gap: 12 }}>
                    {preview.fields
                      .filter((field) => field.divergent)
                      .map((field) => {
                        const overrideValue = overrides[field.field] ?? "auto";
                        return (
                          <div key={field.field} className="card" style={{ padding: 12 }}>
                            <div style={{ marginBottom: 6 }}><strong>{FIELD_LABELS[field.field]}</strong></div>
                            <input type="hidden" name={`override_${field.field}`} value={overrideValue} />
                            <div className="stack" style={{ gap: 6 }}>
                              <label className="row" style={{ gap: 8, cursor: "pointer" }}>
                                <input
                                  type="radio"
                                  name={`override-radio-${field.field}`}
                                  checked={overrideValue === "auto"}
                                  onChange={() => setOverrides((current) => ({ ...current, [field.field]: "auto" }))}
                                />
                                <span className="subtle">Automatico</span>
                              </label>
                              {field.values.map((entry) => {
                                const tutor = tutorsById.get(entry.tutorId);
                                if (!tutor) return null;
                                return (
                                  <label key={entry.tutorId} className="row" style={{ gap: 8, cursor: "pointer" }}>
                                    <input
                                      type="radio"
                                      name={`override-radio-${field.field}`}
                                      checked={overrideValue === entry.tutorId}
                                      onChange={() => setOverrides((current) => ({ ...current, [field.field]: entry.tutorId }))}
                                    />
                                    <span>
                                      <span style={{ fontWeight: 500 }}>{formatFieldValue(field.field, entry.value)}</span>{" "}
                                      <span className="subtle" style={{ fontSize: 12 }}>(de {tutor.name})</span>
                                    </span>
                                  </label>
                                );
                              })}
                            </div>
                          </div>
                        );
                      })}
                  </div>
                </section>
              ) : null}

              <section className="alert" role="status" style={{ background: "var(--surface)", borderColor: "var(--border)" }}>
                <strong>Resumo da mesclagem</strong>
                <div style={{ marginTop: 6, fontSize: 14 }}>
                  {totals.pets} pets, {totals.reservations} reservas e {totals.tasks} tarefas serao movidos para
                  {" "}<strong>{tutorsById.get(canonicalId)?.name}</strong>.
                  {" "}{totals.duplicates} {totals.duplicates === 1 ? "tutor sera removido" : "tutores serao removidos"}.
                  Esta ação não pode ser desfeita.
                </div>
              </section>

              <label className="row" style={{ gap: 8, cursor: "pointer" }}>
                <input type="checkbox" checked={confirm} onChange={(event) => setConfirm(event.target.checked)} />
                <span>Confirmo que revisei os dados e quero mesclar.</span>
              </label>

              <div className="row" style={{ justifyContent: "flex-end", gap: 8 }}>
                <button type="button" className="btn" onClick={closeDialog}>Cancelar</button>
                <button
                  type="submit"
                  className="btn btn--primary"
                  disabled={!confirm || submitting}
                >
                  {submitting ? "Mesclando..." : "Mesclar agora"}
                </button>
              </div>
            </form>
          ) : null}
        </div>
      </dialog>
    </>
  );
}
