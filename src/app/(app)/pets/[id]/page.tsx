import {
  AlertCircle,
  ArrowLeft,
  CalendarDays,
  CheckCircle2,
  HeartPulse,
  PawPrint,
  Soup,
  Stethoscope,
  Trash2,
  UserRound,
} from "lucide-react";
import Link from "next/link";
import { notFound } from "next/navigation";
import { Topbar } from "@/components/layout/topbar";
import { PetAvatar } from "@/components/ui/pet-avatar";
import { StatusBadge } from "@/components/ui/status-badge";
import { FlashMessage } from "@/components/ui/flash-message";
import { ConfirmForm } from "@/components/ui/confirm-form";
import { Tabs } from "@/components/ui/tabs";
import { getPetDetailData, getPetTasksData, getReservationFormData } from "@/lib/app-data";
import { formatDateShort, formatReservationPeriod } from "@/lib/date";
import { displayPetAge } from "@/lib/pet-age";
import { toReservationSeasonOptions, toReservationServiceOptions } from "@/lib/reservation-form-options";
import { calculateChargeableStayUnits } from "@/lib/rules";
import { deletePetAction, updatePetAction } from "../actions";
import { deleteTaskAction, toggleTaskOccurrenceAction } from "@/app/(app)/dashboard/actions";
import { NovaTarefaModal } from "@/app/(app)/dashboard/nova-tarefa-modal";
import { NovaReservaModal } from "@/app/(app)/reservas/nova-reserva-modal";
import { EditarPetModal } from "./editar-pet-modal";

const VALID_TABS = ["ficha", "saude", "alimentacao", "comportamento", "historico"] as const;
type PetTab = (typeof VALID_TABS)[number];

function longDate(date?: Date | null) {
  if (!date) return "-";
  return formatDateShort(date);
}

export default async function PetDetailPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams?: Promise<{ error?: string; saved?: string; deleted?: string; tab?: string }>;
}) {
  const { id } = await params;
  const sp = (await searchParams) ?? {};
  const [pet, petTasks, formData] = await Promise.all([
    getPetDetailData(id),
    getPetTasksData(id),
    getReservationFormData(),
  ]);

  if (!pet) notFound();

  const tab: PetTab = (VALID_TABS as readonly string[]).includes(sp.tab ?? "")
    ? (sp.tab as PetTab)
    : "ficha";

  const updatePet = updatePetAction.bind(null, pet.id);
  const deletePet = deletePetAction.bind(null, pet.id);
  const reservations = pet.reservationPets.map((item) => item.reservation);
  const canDelete = pet.reservationPets.length === 0;
  const activeReservation = reservations.find((reservation) =>
    ["CONFIRMED", "IN_PROGRESS"].includes(reservation.status),
  );
  const totalNights = reservations.reduce(
    (sum, reservation) => sum + calculateChargeableStayUnits(reservation.startsAt, reservation.endsAt),
    0,
  );

  const tabHref = (id: string) => `/pets/${pet.id}${id === "ficha" ? "" : `?tab=${id}`}`;
  const tabItems = [
    { id: "ficha", label: "Ficha", href: tabHref("ficha") },
    { id: "saude", label: "Saúde", href: tabHref("saude") },
    { id: "alimentacao", label: "Alimentação", href: tabHref("alimentacao") },
    { id: "comportamento", label: "Comportamento", href: tabHref("comportamento") },
    { id: "historico", label: "Histórico", href: tabHref("historico") },
  ];

  const ageDisplay = displayPetAge({
    ageLabel: pet.ageLabel,
    ageReferenceYear: pet.ageReferenceYear,
    birthDate: pet.birthDate,
  });
  const editPetModal = (
    <EditarPetModal
      pet={{
        id: pet.id,
        name: pet.name,
        species: pet.species,
        breed: pet.breed,
        ageLabel: pet.ageLabel,
        ageReferenceYear: pet.ageReferenceYear,
        birthDate: pet.birthDate,
        isNeutered: pet.isNeutered,
        isSociable: pet.isSociable,
        foodNotes: pet.foodNotes,
        foodRestrictions: pet.foodRestrictions,
        foodTreats: pet.foodTreats,
        healthNotes: pet.healthNotes,
        behaviorNotes: pet.behaviorNotes,
        historyNotes: pet.historyNotes,
        attentionNotes: pet.attentionNotes,
        vetName: pet.vetName,
        vetPhone: pet.vetPhone,
        deliveredItems: pet.deliveredItems,
      }}
      canDelete={canDelete}
      updateAction={updatePet}
      deleteAction={deletePet}
    />
  );

  return (
    <>
      <Topbar
        title={
          <>
            <span style={{ color: "var(--text-subtle)", fontWeight: 500 }}>Pets / </span>
            {pet.name}
          </>
        }
        subtitle={`${pet.breed || "Raça pendente"} - ${ageDisplay} - Tutor: ${pet.tutor.name}`}
        actions={
          <>
            <Link className="btn" href="/pets"><ArrowLeft /> Voltar</Link>
            {editPetModal}
            <NovaReservaModal
              tutors={formData.tutors.map((t) => ({ id: t.id, name: t.name, phone: t.phone, email: t.email }))}
              pets={formData.pets.map((p) => ({ id: p.id, name: p.name, tutor: { id: p.tutor.id, name: p.tutor.name } }))}
              serviceTypes={toReservationServiceOptions(formData.serviceTypes)}
              seasonPeriods={toReservationSeasonOptions(formData.seasonPeriods)}
              depositPercent={formData.settings?.depositPercent ?? 50}
              defaultTutorId={pet.tutor.id}
              defaultPetId={pet.id}
            />
          </>
        }
      />
      <div className="content">
        <div style={{ marginBottom: 12 }}>
          <FlashMessage error={sp.error} saved={sp.saved} deleted={sp.deleted} />
        </div>
        <div className="detail-grid">
          <main className="col">
            <section className="card">
              <div className="card__body pet-profile">
                <PetAvatar name={pet.name} size="xl" />
                <div style={{ flex: 1 }}>
                  <div className="pet-profile__title">
                    <h2>{pet.name}</h2>
                    {activeReservation ? (
                      <StatusBadge status={activeReservation.status} />
                    ) : (
                      <span className="badge">Em casa</span>
                    )}
                  </div>
                  <div className="muted" style={{ fontSize: 13, marginTop: 4 }}>
                    {pet.breed || "Raça pendente"} - {ageDisplay}
                  </div>
                  <div className="row" style={{ gap: 6, marginTop: 10, flexWrap: "wrap" }}>
                    <span className="badge badge--ativo">{pet.isNeutered ? "Castrado" : "Não castrado"}</span>
                    <span className="badge badge--ativo">{pet.isSociable ? "Sociável" : "Reservado"}</span>
                    <span className="badge">{pet.species === "cat" ? "Gato" : pet.species === "other" ? "Outro" : "Cachorro"}</span>
                  </div>
                </div>
              </div>
            </section>

            <section className="card">
              <div className="card__body" style={{ paddingTop: 0 }}>
                <Tabs items={tabItems} activeId={tab} />
              </div>
            </section>

            {tab === "ficha" ? (
              <>
                <section className="card">
                  <div className="card__header">
                    <div>
                      <div className="card__title"><CheckCircle2 /> Tarefas do pet</div>
                      <div className="card__subtitle">{petTasks.length} tarefas vinculadas</div>
                    </div>
                    <NovaTarefaModal triggerLabel="Adicionar tarefa" petId={pet.id} petLabel={pet.name} />
                  </div>
                  <div className="card__body card__body--flush">
                    <table className="table">
                      <thead>
                        <tr>
                          <th>Tarefa</th>
                          <th>Período</th>
                          <th>Próximas</th>
                          <th aria-label="Ações" />
                        </tr>
                      </thead>
                      <tbody>
                        {petTasks.length ? petTasks.map((task) => (
                          <tr key={task.id}>
                            <td>
                              <strong>{task.title}</strong>
                              {task.description ? <div className="subtle" style={{ fontSize: 11 }}>{task.description}</div> : null}
                            </td>
                            <td className="mono" style={{ fontSize: 12 }}>
                              {formatDateShort(task.taskDate)}
                              {task.endsAt ? ` até ${formatDateShort(task.endsAt)}` : ""}
                            </td>
                            <td>
                              {task.occurrences.length ? (
                                <div className="row" style={{ flexWrap: "wrap", gap: 4 }}>
                                  {task.occurrences.slice(0, 5).map((occurrence) => (
                                    <form key={occurrence.id} action={toggleTaskOccurrenceAction.bind(null, occurrence.id)}>
                                      <button
                                        type="submit"
                                        className={`badge ${occurrence.done ? "badge--ativo" : "badge--pendente"}`}
                                        style={{ border: "none", cursor: "pointer", padding: "4px 8px" }}
                                      >
                                        {formatDateShort(occurrence.date)} {occurrence.done ? "OK" : ""}
                                      </button>
                                    </form>
                                  ))}
                                </div>
                              ) : (
                                <span className="muted" style={{ fontSize: 12 }}>nenhuma próxima</span>
                              )}
                            </td>
                            <td>
                              <ConfirmForm
                                action={deleteTaskAction.bind(null, task.id)}
                                message={`Excluir a tarefa "${task.title}"?`}
                              >
                                <button className="btn btn--ghost btn--icon" type="submit" aria-label={`Excluir ${task.title}`} title="Excluir">
                                  <Trash2 />
                                </button>
                              </ConfirmForm>
                            </td>
                          </tr>
                        )) : (
                          <tr>
                            <td colSpan={4} className="muted">Nenhuma tarefa vinculada a este pet ainda.</td>
                          </tr>
                        )}
                      </tbody>
                    </table>
                  </div>
                </section>

                <section className="card">
                  <div className="card__header">
                    <div className="card__title">Itens entregues</div>
                  </div>
                  <div className="card__body muted" style={{ fontSize: 13, lineHeight: 1.55 }}>
                    {pet.deliveredItems || "Nenhum item registrado."}
                  </div>
                </section>
              </>
            ) : null}

            {tab === "alimentacao" ? (
              <section className="card">
                <div className="card__header">
                  <div className="card__title"><Soup /> Alimentação</div>
                  {editPetModal}
                </div>
                <div className="card__body">
                  <dl className="kv" style={{ gridTemplateColumns: "130px 1fr", rowGap: 10 }}>
                    <dt>Rotina</dt>
                    <dd style={{ whiteSpace: "pre-wrap" }}>{pet.foodNotes || <span className="muted">Sem rotina cadastrada.</span>}</dd>
                    <dt>Restrições</dt>
                    <dd style={{ whiteSpace: "pre-wrap" }}>{pet.foodRestrictions || <span className="muted">Nenhuma restrição registrada.</span>}</dd>
                    <dt>Petiscos</dt>
                    <dd style={{ whiteSpace: "pre-wrap" }}>{pet.foodTreats || <span className="muted">Conferir com o tutor antes de liberar.</span>}</dd>
                  </dl>
                </div>
              </section>
            ) : null}

            {tab === "saude" ? (
              <section className="card">
                <div className="card__header">
                  <div className="card__title"><HeartPulse /> Saúde</div>
                </div>
                <div className="card__body">
                  <dl className="kv" style={{ gridTemplateColumns: "110px 1fr" }}>
                    <dt>Saúde geral</dt><dd>{pet.healthNotes || "Sem observações de saúde."}</dd>
                    <dt>Veterinário</dt><dd>{pet.vetName || "Não informado"}</dd>
                    <dt>Contato vet</dt><dd className="mono">{pet.vetPhone || "-"}</dd>
                  </dl>
                </div>
              </section>
            ) : null}

            {tab === "comportamento" ? (
              <section className="card">
                <div className="card__header">
                  <div className="card__title"><Stethoscope /> Comportamento e observações</div>
                </div>
                <div className="card__body" style={{ fontSize: 13, color: "var(--text-muted)", lineHeight: 1.55 }}>
                  {pet.behaviorNotes || "Sem observações comportamentais cadastradas."}
                </div>
              </section>
            ) : null}

            {tab === "historico" ? (
              <>
                {pet.historyNotes ? (
                  <section className="card">
                    <div className="card__header">
                      <div className="card__title">Observações livres</div>
                      {editPetModal}
                    </div>
                    <div className="card__body" style={{ whiteSpace: "pre-wrap", lineHeight: 1.55 }}>
                      {pet.historyNotes}
                    </div>
                  </section>
                ) : null}
                <section className="card">
                  <div className="card__header">
                    <div>
                      <div className="card__title"><CalendarDays /> Estadias recentes</div>
                      <div className="card__subtitle">{reservations.length} reservas vinculadas</div>
                    </div>
                  </div>
                  <div className="card__body card__body--flush">
                    <table className="table">
                      <thead>
                        <tr>
                          <th>Data</th>
                          <th>Tipo</th>
                          <th>Diárias</th>
                          <th>Status</th>
                        </tr>
                      </thead>
                      <tbody>
                        {reservations.length ? reservations.slice(0, 6).map((reservation) => (
                          <tr key={reservation.id}>
                            <td className="mono" style={{ fontSize: 12 }}>
                              {formatReservationPeriod(reservation.startsAt, reservation.endsAt)}
                            </td>
                            <td><Link href={`/reservas/${reservation.id}`}>{reservation.serviceType.name}</Link></td>
                            <td className="mono">{calculateChargeableStayUnits(reservation.startsAt, reservation.endsAt)}</td>
                            <td><StatusBadge status={reservation.status} /></td>
                          </tr>
                        )) : (
                          <tr>
                            <td colSpan={4} className="muted">Nenhuma reserva vinculada ainda.</td>
                          </tr>
                        )}
                      </tbody>
                    </table>
                  </div>
                </section>
              </>
            ) : null}

          </main>

          <aside className="col">
            <section className="card">
              <div className="card__header">
                <div className="card__title"><UserRound /> Tutor</div>
              </div>
              <div className="card__body">
                <div className="row" style={{ gap: 12, paddingBottom: 12, borderBottom: "1px solid var(--border)", marginBottom: 12 }}>
                  <div className="avatar avatar--lg avatar--lilac">
                    {pet.tutor.name.split(" ").slice(0, 2).map((part) => part[0]).join("").toUpperCase()}
                  </div>
                  <div>
                    <div style={{ fontSize: 14, fontWeight: 600 }}>{pet.tutor.name}</div>
                    <div className="subtle" style={{ fontSize: 11 }}>Cliente desde {formatDateShort(pet.tutor.createdAt)}</div>
                  </div>
                </div>
                <dl className="kv" style={{ gridTemplateColumns: "110px 1fr", fontSize: 12 }}>
                  <dt>Telefone</dt><dd className="mono">{pet.tutor.phone || "-"}</dd>
                  <dt>E-mail</dt><dd>{pet.tutor.email || "-"}</dd>
                  <dt>Documento</dt><dd className="mono">{pet.tutor.document || "-"}</dd>
                  <dt>Endereço</dt><dd>{pet.tutor.address || "-"}</dd>
                </dl>
                <Link className="btn" href={`/tutores/${pet.tutor.id}/ficha`} style={{ marginTop: 14, width: "100%" }}>
                  Ver ficha do tutor
                </Link>
              </div>
            </section>

            <section className="card">
              <div className="card__header">
                <div className="card__title"><AlertCircle /> Atenção</div>
              </div>
              <div className="card__body" style={{ fontSize: 12, color: "var(--text-muted)" }}>
                {pet.attentionNotes ? (
                  <p style={{ margin: 0, whiteSpace: "pre-wrap", lineHeight: 1.6 }}>{pet.attentionNotes}</p>
                ) : (
                  <ul style={{ margin: 0, paddingLeft: 18, lineHeight: 1.7 }}>
                    <li>{pet.healthNotes ? "Conferir observações de saúde" : "Saúde sem alertas cadastrados"}</li>
                    <li>{pet.behaviorNotes ? "Ler comportamento antes do manejo" : "Comportamento sem alertas cadastrados"}</li>
                    <li>{pet.deliveredItems ? "Conferir itens na entrada e saída" : "Nenhum item entregue registrado"}</li>
                  </ul>
                )}
              </div>
            </section>

            <section className="card">
              <div className="card__header">
                <div className="card__title">Estatísticas</div>
              </div>
              <div className="card__body">
                <dl className="kv">
                  <dt>Total estadias</dt><dd className="mono">{reservations.length}</dd>
                  <dt>Total noites</dt><dd className="mono">{totalNights}</dd>
                  <dt>Cadastro</dt><dd>{longDate(pet.createdAt)}</dd>
                  <dt>Última reserva</dt><dd>{reservations[0] ? formatDateShort(reservations[0].startsAt) : "-"}</dd>
                </dl>
              </div>
            </section>

            <section className="card">
              <div className="card__header">
                <div className="card__title"><PawPrint /> Atalhos</div>
              </div>
              <div className="card__body stack" style={{ gap: 8 }}>
                <NovaReservaModal
                  tutors={formData.tutors.map((t) => ({ id: t.id, name: t.name, phone: t.phone, email: t.email }))}
                  pets={formData.pets.map((p) => ({ id: p.id, name: p.name, tutor: { id: p.tutor.id, name: p.tutor.name } }))}
                  serviceTypes={toReservationServiceOptions(formData.serviceTypes)}
                  seasonPeriods={toReservationSeasonOptions(formData.seasonPeriods)}
                  depositPercent={formData.settings?.depositPercent ?? 50}
                  defaultTutorId={pet.tutor.id}
                  defaultPetId={pet.id}
                  triggerVariant="default"
                />
                <Link className="btn" href="/agenda"><CalendarDays /> Ver agenda</Link>
                {editPetModal}
              </div>
            </section>
          </aside>
        </div>
      </div>
    </>
  );
}
