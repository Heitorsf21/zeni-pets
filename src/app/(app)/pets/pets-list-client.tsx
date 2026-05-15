"use client";

import { Search } from "lucide-react";
import Link from "next/link";
import { useDeferredValue, useMemo, useState } from "react";
import { PetAvatar } from "@/components/ui/pet-avatar";
import { displayPetAge } from "@/lib/pet-age";

export type PetRow = {
  id: string;
  name: string;
  tutor: string;
  breed: string;
  ageLabel: string | null;
  ageReferenceYear: number | null;
  neutered: boolean;
  sociable: boolean;
};

export function PetsListClient({ pets }: { pets: PetRow[] }) {
  const [searchQuery, setSearchQuery] = useState("");
  const deferredQuery = useDeferredValue(searchQuery);

  const filteredPets = useMemo(() => {
    const q = deferredQuery.trim().toLowerCase();
    if (!q) return pets;
    return pets.filter((pet) =>
      [pet.name, pet.tutor, pet.breed]
        .some((field) => field && field.toLowerCase().includes(q))
    );
  }, [pets, deferredQuery]);

  return (
    <>
      <div className="row" style={{ gap: 8, alignItems: "center", padding: "0 0 12px", flexWrap: "wrap" }}>
        <label className="field" style={{ flex: 1, minWidth: 240, margin: 0 }}>
          <span className="row" style={{ position: "relative", alignItems: "center" }}>
            <Search style={{ position: "absolute", left: 10, width: 16, height: 16, color: "var(--muted)" }} />
            <input
              className="input"
              type="search"
              placeholder="Buscar por nome do pet, tutor ou raça"
              value={searchQuery}
              onChange={(event) => setSearchQuery(event.target.value)}
              style={{ paddingLeft: 32, width: "100%" }}
            />
          </span>
        </label>
        <span className="subtle" style={{ fontSize: 12 }}>
          {filteredPets.length} de {pets.length} {pets.length === 1 ? "pet" : "pets"}
        </span>
      </div>

      <div style={{ display: "grid", gridTemplateColumns: "repeat(3, minmax(0, 1fr))", gap: 14 }}>
        {filteredPets.length === 0 ? (
          <div className="muted" style={{ gridColumn: "1 / -1", padding: 24, textAlign: "center" }}>
            Nenhum pet encontrado.
          </div>
        ) : null}
        {filteredPets.map((pet) => (
          <article className="card" key={pet.id} style={{ borderRadius: "var(--r-md)" }}>
            <div className="card__body stack" style={{ gap: 12 }}>
              <div className="row">
                <PetAvatar name={pet.name} size="lg" />
                <div>
                  <strong>{pet.name}</strong>
                  <div className="subtle" style={{ fontSize: 12 }}>{pet.tutor}</div>
                </div>
              </div>
              <div className="subtle" style={{ fontSize: 12 }}>
                {pet.breed} · {displayPetAge({ ageLabel: pet.ageLabel, ageReferenceYear: pet.ageReferenceYear })}
              </div>
              <div className="row">
                <span className="badge badge--ativo">{pet.neutered ? "Castrado" : "Não castrado"}</span>
                <span className="badge">{pet.sociable ? "Sociável" : "Reservado"}</span>
              </div>
              <Link className="btn" href={`/pets/${pet.id}/ficha`}>Ver ficha</Link>
            </div>
          </article>
        ))}
      </div>
    </>
  );
}
