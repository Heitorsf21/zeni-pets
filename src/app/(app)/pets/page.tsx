import { PawPrint } from "lucide-react";
import Link from "next/link";
import { Topbar } from "@/components/layout/topbar";
import { PetAvatar } from "@/components/ui/pet-avatar";
import { FlashMessage } from "@/components/ui/flash-message";
import { getPetsData, getReservationFormData } from "@/lib/app-data";
import { NovoPetModal } from "./novo-pet-modal";

export default async function PetsPage({
  searchParams,
}: {
  searchParams?: Promise<{ error?: string; deleted?: string; saved?: string }>;
}) {
  const sp = (await searchParams) ?? {};
  const [pets, formData] = await Promise.all([getPetsData(), getReservationFormData()]);
  const tutorOptions = formData.tutors.map((tutor) => ({ id: tutor.id, name: tutor.name }));

  return (
    <>
      <Topbar
        title="Pets"
        subtitle="Ficha, saude, alimentacao e comportamento"
        actions={<NovoPetModal tutors={tutorOptions} />}
      />
      <div className="content stack">
        <FlashMessage error={sp.error} deleted={sp.deleted} saved={sp.saved} />
        <section className="card">
          <div className="card__header">
            <div>
              <div className="card__title"><PawPrint /> Pets cadastrados</div>
              <div className="card__subtitle">{pets.length} {pets.length === 1 ? "pet cadastrado" : "pets cadastrados"}</div>
            </div>
          </div>
          <div className="card__body" style={{ display: "grid", gridTemplateColumns: "repeat(3, minmax(0, 1fr))", gap: 14 }}>
            {pets.map((pet) => (
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
                    {pet.breed} - {pet.age}
                  </div>
                  <div className="row">
                    <span className="badge badge--ativo">{pet.neutered ? "Castrado" : "Nao castrado"}</span>
                    <span className="badge">{pet.sociable ? "Sociavel" : "Reservado"}</span>
                  </div>
                  <Link className="btn" href={`/pets/${pet.id}/ficha`}>Ver ficha</Link>
                </div>
              </article>
            ))}
          </div>
        </section>

      </div>
    </>
  );
}
