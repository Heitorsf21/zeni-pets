"use client";

import { useMemo, useState } from "react";

type Tutor = { id: string; name: string };
type Pet = { id: string; name: string; tutor: { id: string; name: string } };

type Props = {
  tutors: Tutor[];
  pets: Pet[];
  defaultTutorId?: string;
  defaultPetId?: string;
};

export function ReservationPetFields({ tutors, pets, defaultTutorId, defaultPetId }: Props) {
  const [selectedTutorId, setSelectedTutorId] = useState(defaultTutorId ?? "");
  const [selectedPetIds, setSelectedPetIds] = useState<string[]>(defaultPetId ? [defaultPetId] : []);

  const filteredPets = useMemo(
    () => (selectedTutorId ? pets.filter((pet) => pet.tutor.id === selectedTutorId) : []),
    [pets, selectedTutorId],
  );
  const selectedPets = filteredPets.filter((pet) => selectedPetIds.includes(pet.id));

  function changeTutor(tutorId: string) {
    setSelectedTutorId(tutorId);
    setSelectedPetIds((current) =>
      current.filter((petId) => pets.some((pet) => pet.id === petId && pet.tutor.id === tutorId)),
    );
  }

  function togglePet(petId: string, checked: boolean) {
    setSelectedPetIds((current) => {
      if (checked) return current.includes(petId) ? current : [...current, petId];
      return current.filter((id) => id !== petId);
    });
  }

  return (
    <>
      <label className="field">
        <span className="field__label">Tutor</span>
        <select
          className="select"
          name="tutorId"
          required
          value={selectedTutorId}
          onChange={(event) => changeTutor(event.target.value)}
        >
          <option value="">Selecione</option>
          {tutors.map((tutor) => (
            <option key={tutor.id} value={tutor.id}>{tutor.name}</option>
          ))}
        </select>
      </label>

      <fieldset
        className="field"
        style={{
          gridColumn: "1 / -1",
          border: 0,
          margin: 0,
          padding: 0,
        }}
      >
        <legend className="field__label">Pets da reserva</legend>
        <div
          style={{
            display: "grid",
            gridTemplateColumns: "repeat(auto-fit, minmax(180px, 1fr))",
            gap: 8,
          }}
        >
          {filteredPets.length ? filteredPets.map((pet) => (
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
                onChange={(event) => togglePet(pet.id, event.target.checked)}
              />
              {pet.name}
            </label>
          )) : (
            <p className="muted" style={{ gridColumn: "1 / -1", margin: 0 }}>
              Selecione um tutor para ver os pets.
            </p>
          )}
        </div>
        {selectedPets.length ? (
          <p className="subtle" style={{ margin: 0, fontSize: 11 }}>
            {selectedPets.length} {selectedPets.length === 1 ? "pet selecionado" : "pets selecionados"} para esta reserva.
          </p>
        ) : null}
      </fieldset>
    </>
  );
}
