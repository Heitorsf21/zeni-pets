"use client";

import { Search, X } from "lucide-react";
import { useEffect, useLayoutEffect, useMemo, useRef, useState } from "react";
import { createPortal } from "react-dom";

type Tutor = { id: string; name: string; phone?: string | null; email?: string | null };
type Pet = { id: string; name: string; tutor: { id: string; name: string } };

type Props = {
  tutors: Tutor[];
  pets: Pet[];
  defaultTutorId?: string;
  defaultPetId?: string;
  defaultPetIds?: string[];
};

export function ReservationPetFields({ tutors, pets, defaultTutorId, defaultPetId, defaultPetIds }: Props) {
  const initialPetIds = defaultPetIds && defaultPetIds.length ? defaultPetIds : defaultPetId ? [defaultPetId] : [];
  const [selectedTutorId, setSelectedTutorId] = useState(defaultTutorId ?? "");
  const [selectedPetIds, setSelectedPetIds] = useState<string[]>(initialPetIds);
  const [tutorQuery, setTutorQuery] = useState(() => {
    if (!defaultTutorId) return "";
    return tutors.find((tutor) => tutor.id === defaultTutorId)?.name ?? "";
  });
  const [tutorOpen, setTutorOpen] = useState(false);
  const [petQuery, setPetQuery] = useState("");
  const tutorBoxRef = useRef<HTMLDivElement>(null);
  const tutorHiddenRef = useRef<HTMLInputElement>(null);
  const tutorRowRef = useRef<HTMLSpanElement>(null);
  const tutorDropdownRef = useRef<HTMLUListElement>(null);
  const [tutorDropdownPos, setTutorDropdownPos] = useState<
    { top: number; left: number; width: number } | null
  >(null);

  const tutorsById = useMemo(() => new Map(tutors.map((tutor) => [tutor.id, tutor])), [tutors]);
  const selectedTutor = selectedTutorId ? tutorsById.get(selectedTutorId) ?? null : null;

  const filteredTutors = useMemo(() => {
    const q = tutorQuery.trim().toLowerCase();
    if (!q) return tutors.slice(0, 12);
    return tutors
      .filter((tutor) => {
        const haystack = `${tutor.name} ${tutor.phone ?? ""} ${tutor.email ?? ""}`.toLowerCase();
        return haystack.includes(q);
      })
      .slice(0, 12);
  }, [tutors, tutorQuery]);

  const filteredPets = useMemo(() => {
    if (!selectedTutorId) return [];
    const list = pets.filter((pet) => pet.tutor.id === selectedTutorId);
    const q = petQuery.trim().toLowerCase();
    if (!q) return list;
    return list.filter((pet) => pet.name.toLowerCase().includes(q));
  }, [pets, selectedTutorId, petQuery]);

  const tutorPetsCount = useMemo(
    () => (selectedTutorId ? pets.filter((pet) => pet.tutor.id === selectedTutorId).length : 0),
    [pets, selectedTutorId],
  );

  useEffect(() => {
    function onDocClick(event: MouseEvent) {
      const target = event.target as Node;
      if (tutorBoxRef.current?.contains(target)) return;
      if (tutorDropdownRef.current?.contains(target)) return;
      setTutorOpen(false);
    }
    document.addEventListener("mousedown", onDocClick);
    return () => document.removeEventListener("mousedown", onDocClick);
  }, []);

  useLayoutEffect(() => {
    if (!tutorOpen) {
      setTutorDropdownPos(null);
      return;
    }
    function recompute() {
      const anchor = tutorRowRef.current;
      if (!anchor) return;
      const rect = anchor.getBoundingClientRect();
      setTutorDropdownPos({ top: rect.bottom + 4, left: rect.left, width: rect.width });
    }
    recompute();
    window.addEventListener("scroll", recompute, true);
    window.addEventListener("resize", recompute);
    return () => {
      window.removeEventListener("scroll", recompute, true);
      window.removeEventListener("resize", recompute);
    };
  }, [tutorOpen]);

  useEffect(() => {
    if (!tutorHiddenRef.current) return;
    tutorHiddenRef.current.dispatchEvent(new Event("change", { bubbles: true }));
  }, [selectedTutorId]);

  function pickTutor(tutor: Tutor) {
    setSelectedTutorId(tutor.id);
    setTutorQuery(tutor.name);
    setTutorOpen(false);
    setSelectedPetIds((current) =>
      current.filter((petId) => pets.some((pet) => pet.id === petId && pet.tutor.id === tutor.id)),
    );
  }

  function clearTutor() {
    setSelectedTutorId("");
    setTutorQuery("");
    setSelectedPetIds([]);
  }

  return (
    <>
      <input
        type="hidden"
        name="tutorId"
        value={selectedTutorId}
        ref={tutorHiddenRef}
        required
      />

      <div className="field" ref={tutorBoxRef} style={{ position: "relative" }}>
        <span className="field__label">Tutor</span>
        <span ref={tutorRowRef} className="row" style={{ position: "relative", alignItems: "center" }}>
          <Search style={{ position: "absolute", left: 10, width: 16, height: 16, color: "var(--muted)" }} />
          <input
            className="input"
            type="search"
            placeholder="Buscar tutor por nome, telefone ou e-mail"
            value={tutorQuery}
            onChange={(event) => {
              setTutorQuery(event.target.value);
              setTutorOpen(true);
            }}
            onFocus={() => setTutorOpen(true)}
            style={{ paddingLeft: 32, width: "100%" }}
            aria-required
          />
          {selectedTutorId ? (
            <button
              type="button"
              className="btn btn--ghost btn--icon"
              aria-label="Limpar tutor"
              onClick={clearTutor}
              style={{ position: "absolute", right: 4 }}
            >
              <X style={{ width: 14, height: 14 }} />
            </button>
          ) : null}
        </span>
        {tutorOpen && tutorDropdownPos && typeof document !== "undefined"
          ? createPortal(
              <ul
                ref={tutorDropdownRef}
                role="listbox"
                style={{
                  position: "fixed",
                  top: tutorDropdownPos.top,
                  left: tutorDropdownPos.left,
                  width: tutorDropdownPos.width,
                  zIndex: 1000,
                  background: "var(--surface)",
                  border: "1px solid var(--border)",
                  borderRadius: 8,
                  maxHeight: 260,
                  overflowY: "auto",
                  listStyle: "none",
                  padding: 4,
                  margin: 0,
                  boxShadow: "0 12px 32px rgba(15, 23, 42, 0.18)",
                }}
              >
                {filteredTutors.length === 0 ? (
                  <li className="muted" style={{ padding: "8px 10px", fontSize: 12 }}>
                    Nenhum tutor encontrado.
                  </li>
                ) : (
                  filteredTutors.map((tutor) => (
                    <li key={tutor.id}>
                      <button
                        type="button"
                        onClick={() => pickTutor(tutor)}
                        style={{
                          width: "100%",
                          textAlign: "left",
                          background: tutor.id === selectedTutorId ? "var(--surface-2, #f5f7fb)" : "transparent",
                          border: 0,
                          padding: "8px 10px",
                          borderRadius: 6,
                          cursor: "pointer",
                          fontSize: 13,
                        }}
                      >
                        <strong>{tutor.name}</strong>
                        {tutor.phone || tutor.email ? (
                          <div className="subtle" style={{ fontSize: 11 }}>
                            {[tutor.phone, tutor.email].filter(Boolean).join(" · ")}
                          </div>
                        ) : null}
                      </button>
                    </li>
                  ))
                )}
              </ul>,
              document.body,
            )
          : null}
      </div>

      <fieldset
        className="field"
        style={{
          gridColumn: "1 / -1",
          border: 0,
          margin: 0,
          padding: 0,
        }}
      >
        <legend className="field__label">
          Pets da reserva
          {selectedTutor ? <span className="subtle"> · {selectedTutor.name}</span> : null}
        </legend>
        {selectedTutorId && tutorPetsCount > 5 ? (
          <span className="row" style={{ position: "relative", alignItems: "center", marginBottom: 6 }}>
            <Search style={{ position: "absolute", left: 10, width: 14, height: 14, color: "var(--muted)" }} />
            <input
              className="input"
              type="search"
              placeholder="Filtrar pets pelo nome"
              value={petQuery}
              onChange={(event) => setPetQuery(event.target.value)}
              style={{ paddingLeft: 32, width: "100%" }}
            />
          </span>
        ) : null}
        <div
          style={{
            display: "grid",
            gridTemplateColumns: "repeat(auto-fit, minmax(180px, 1fr))",
            gap: 8,
          }}
        >
          {!selectedTutorId ? (
            <p className="muted" style={{ gridColumn: "1 / -1", margin: 0 }}>
              Selecione um tutor para ver os pets.
            </p>
          ) : filteredPets.length === 0 ? (
            <p className="muted" style={{ gridColumn: "1 / -1", margin: 0 }}>
              {petQuery ? "Nenhum pet com este nome." : "Tutor sem pets cadastrados."}
            </p>
          ) : (
            filteredPets.map((pet) => (
              <label
                className="check"
                key={pet.id}
                style={{
                  minHeight: 38,
                  border: "1px solid var(--border)",
                  borderRadius: 8,
                  padding: "9px 10px",
                  color: "var(--text)",
                }}
              >
                <input
                  type="checkbox"
                  name="petIds"
                  value={pet.id}
                  checked={selectedPetIds.includes(pet.id)}
                  onChange={(event) => {
                    const checked = event.target.checked;
                    setSelectedPetIds((current) => {
                      if (checked) return current.includes(pet.id) ? current : [...current, pet.id];
                      return current.filter((id) => id !== pet.id);
                    });
                  }}
                />
                {pet.name}
              </label>
            ))
          )}
        </div>
        {selectedPetIds.length ? (
          <p className="subtle" style={{ margin: "6px 0 0", fontSize: 11 }}>
            {selectedPetIds.length} {selectedPetIds.length === 1 ? "pet selecionado" : "pets selecionados"} para esta reserva.
          </p>
        ) : null}
      </fieldset>
    </>
  );
}
