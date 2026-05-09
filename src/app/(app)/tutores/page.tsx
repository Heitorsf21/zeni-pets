import { Users } from "lucide-react";
import { Topbar } from "@/components/layout/topbar";
import { FlashMessage } from "@/components/ui/flash-message";
import { getTutorsData } from "@/lib/app-data";
import { NovoTutorModal } from "./novo-tutor-modal";
import { TutoresListClient } from "./tutores-list-client";

type SP = Promise<{ error?: string; deleted?: string; saved?: string; merged?: string }>;

export default async function TutoresPage({ searchParams }: { searchParams?: SP }) {
  const params = (await searchParams) ?? {};
  const tutors = await getTutorsData();

  return (
    <>
      <Topbar
        title="Tutores"
        subtitle="Clientes, contatos e historico de reservas"
        actions={<NovoTutorModal />}
      />
      <div className="content stack">
        <FlashMessage error={params.error} deleted={params.deleted} saved={params.saved} merged={params.merged} />
        <section className="card">
          <div className="card__header">
            <div>
              <div className="card__title"><Users /> Lista de tutores</div>
              <div className="card__subtitle">{tutors.length} {tutors.length === 1 ? "tutor cadastrado" : "tutores cadastrados"}</div>
            </div>
          </div>
          <TutoresListClient tutors={tutors} />
        </section>
      </div>
    </>
  );
}
