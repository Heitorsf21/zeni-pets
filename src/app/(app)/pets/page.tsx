import { PawPrint } from "lucide-react";
import { Topbar } from "@/components/layout/topbar";
import { FlashMessage } from "@/components/ui/flash-message";
import { getPetsData, getReservationFormData } from "@/lib/app-data";
import { NovoPetModal } from "./novo-pet-modal";
import { PetsListClient } from "./pets-list-client";

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
        subtitle="Ficha, saúde, alimentação e comportamento"
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
          <div className="card__body">
            <PetsListClient
              pets={pets.map((pet) => ({
                id: pet.id,
                name: pet.name,
                tutor: pet.tutor,
                breed: pet.breed,
                ageLabel: pet.ageLabel,
                ageReferenceYear: pet.ageReferenceYear,
                neutered: pet.neutered,
                sociable: pet.sociable,
              }))}
            />
          </div>
        </section>
      </div>
    </>
  );
}
