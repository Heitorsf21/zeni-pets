import {
  ArrowLeft,
  CalendarDays,
  ChevronRight,
  Clock,
  Mail,
  MapPin,
  PawPrint,
  Phone,
  Wallet,
} from "lucide-react";
import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { getPrisma } from "@/lib/db";
import { Topbar } from "@/components/layout/topbar";
import { PetAvatar } from "@/components/ui/pet-avatar";
import { StatusBadge } from "@/components/ui/status-badge";
import { FlashMessage } from "@/components/ui/flash-message";
import { getReservationFormData, getTutorDetailData } from "@/lib/app-data";
import { formatDateShort, formatReservationPeriod } from "@/lib/date";
import { brl } from "@/lib/money";
import { toReservationSeasonOptions, toReservationServiceOptions } from "@/lib/reservation-form-options";
import { adjustTutorCreditAction, deleteTutorAction, toggleTutorStatusAction, updateTutorAction } from "../actions";
import { NovoPetModal } from "@/app/(app)/pets/novo-pet-modal";
import { NovaReservaModal } from "@/app/(app)/reservas/nova-reserva-modal";
import { sumCreditBalance } from "@/lib/credits";
import { CreditoTutorModal } from "./credito-tutor-modal";
import { EditarTutorModal } from "./editar-tutor-modal";

function initials(name: string) {
  return name
    .split(" ")
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0])
    .join("")
    .toUpperCase();
}

function longDate(date?: Date | null) {
  if (!date) return "-";
  return formatDateShort(date);
}

function phoneLinks(phone?: string | null) {
  const digits = phone?.replace(/\D/g, "") ?? "";
  return {
    tel: digits ? `tel:${digits}` : "#",
    whatsapp: digits ? `https://wa.me/55${digits.replace(/^55/, "")}` : "#",
  };
}

export default async function TutorDetailPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams?: Promise<{ error?: string; saved?: string; deleted?: string; mergedFrom?: string }>;
}) {
  const { id } = await params;
  const sp = (await searchParams) ?? {};
  const [tutor, formData] = await Promise.all([
    getTutorDetailData(id),
    getReservationFormData(),
  ]);

  if (!tutor) {
    const merged = await getPrisma()
      .tutor.findFirst({ where: { mergedFromIds: { has: id } }, select: { id: true } })
      .catch(() => null);
    if (merged) redirect(`/tutores/${merged.id}/ficha?mergedFrom=${id}`);
    notFound();
  }

  const toggleStatus = toggleTutorStatusAction.bind(null, tutor.id, tutor.status);
  const updateTutor = updateTutorAction.bind(null, tutor.id);
  const deleteTutor = deleteTutorAction.bind(null, tutor.id);
  const adjustCredit = adjustTutorCreditAction.bind(null, tutor.id);
  const canDelete = tutor.reservations.length === 0;
  const totalCents = tutor.reservations.reduce((sum, reservation) => sum + reservation.totalCents, 0);
  const ticketCents = tutor.reservations.length ? Math.round(totalCents / tutor.reservations.length) : 0;
  const creditBalanceCents = sumCreditBalance(tutor.creditTransactions);
  const recentReservations = tutor.reservations.slice(0, 6);
  const links = phoneLinks(tutor.phone);
  const secondaryLinks = phoneLinks(tutor.secondaryPhone);

  return (
    <>
      <Topbar
        title={
          <>
            <span style={{ color: "var(--text-subtle)", fontWeight: 500 }}>Tutores / </span>
            {tutor.name}
          </>
        }
        subtitle={`Ficha do tutor - ${tutor.clientSinceIsSystemOnly ? "cadastro no sistema em" : "cliente desde"} ${formatDateShort(tutor.clientSince)} - ${tutor.reservations.length} reservas`}
        actions={
          <>
            <Link className="btn" href="/tutores"><ArrowLeft /> Voltar</Link>
            <EditarTutorModal
              tutor={{
                id: tutor.id,
                name: tutor.name,
                email: tutor.email,
                phone: tutor.phone,
                secondaryPhone: tutor.secondaryPhone,
                secondaryPhoneNote: tutor.secondaryPhoneNote,
                document: tutor.document,
                cep: tutor.cep,
                birthDate: tutor.birthDate,
                address: tutor.address,
                notes: tutor.notes,
                status: tutor.status,
              }}
              canDelete={canDelete}
              updateAction={updateTutor}
              toggleStatusAction={toggleStatus}
              deleteAction={deleteTutor}
            />
            <NovaReservaModal
              tutors={formData.tutors.map((t) => ({ id: t.id, name: t.name, phone: t.phone, email: t.email }))}
              pets={formData.pets.map((p) => ({ id: p.id, name: p.name, tutor: { id: p.tutor.id, name: p.tutor.name } }))}
              serviceTypes={toReservationServiceOptions(formData.serviceTypes)}
              seasonPeriods={toReservationSeasonOptions(formData.seasonPeriods)}
              depositPercent={formData.settings?.depositPercent ?? 50}
              defaultTutorId={tutor.id}
            />
          </>
        }
      />
      <div className="content">
        <div style={{ marginBottom: 12 }}>
          <FlashMessage error={sp.error} saved={sp.saved} deleted={sp.deleted} mergedFrom={sp.mergedFrom} />
        </div>
        <div className="detail-grid">
          <main className="col">
            <section className="card">
              <div className="card__header">
                <div>
                  <div className="card__title"><PawPrint /> Pets - {tutor.pets.length}</div>
                  <div className="card__subtitle">Fichas vinculadas a este tutor</div>
                </div>
                <NovoPetModal fixedTutorId={tutor.id} triggerLabel="Adicionar pet" />
              </div>
              <div className="card__body stack" style={{ gap: 12 }}>
                {tutor.pets.length ? tutor.pets.map((pet) => (
                  <article
                    className="row row--between"
                    key={pet.id}
                    style={{
                      alignItems: "center",
                      border: "1px solid var(--border)",
                      borderRadius: "var(--r-md)",
                      padding: 12,
                    }}
                  >
                    <div className="row" style={{ gap: 14 }}>
                      <PetAvatar name={pet.name} size="lg" />
                      <div>
                        <div style={{ fontSize: 15, fontWeight: 600 }}>{pet.name}</div>
                        <div className="muted" style={{ fontSize: 12, marginTop: 2 }}>
                          {pet.breed || "Raça pendente"} - {pet.ageLabel || "idade pendente"}
                        </div>
                        <div className="row" style={{ gap: 6, marginTop: 8, flexWrap: "wrap" }}>
                    <span className="badge badge--ativo">{pet.isNeutered ? "Castrado" : "Não castrado"}</span>
                          <span className="badge badge--parcial">{pet.isSociable ? "Sociável" : "Reservado"}</span>
                        </div>
                      </div>
                    </div>
                    <Link className="btn btn--ghost btn--icon" aria-label={`Abrir ficha de ${pet.name}`} href={`/pets/${pet.id}/ficha`}>
                      <ChevronRight />
                    </Link>
                  </article>
                )) : (
                  <p className="muted">Nenhum pet cadastrado para este tutor.</p>
                )}
              </div>
            </section>

            <section className="card">
              <div className="card__header">
                <div>
                  <div className="card__title"><Clock /> Histórico de reservas</div>
                  <div className="card__subtitle">{tutor.reservations.length} reservas no total</div>
                </div>
              </div>
              <div className="card__body card__body--flush">
                <table className="table">
                  <thead>
                    <tr>
                      <th>Data</th>
                      <th>Serviço</th>
                      <th>Status</th>
                      <th>Pagamento</th>
                      <th className="table__num">Valor</th>
                    </tr>
                  </thead>
                  <tbody>
                    {recentReservations.length ? recentReservations.map((reservation) => (
                      <tr key={reservation.id}>
                        <td className="mono" style={{ fontSize: 12 }}>
                          {formatReservationPeriod(reservation.startsAt, reservation.endsAt, reservation.serviceType.kind)}
                        </td>
                        <td>
                          <Link href={`/reservas/${reservation.id}`}>
                            {reservation.serviceType.name}
                          </Link>
                        </td>
                        <td><StatusBadge status={reservation.status} /></td>
                        <td><StatusBadge status={reservation.paymentStatus} /></td>
                        <td className="table__num mono">{brl(reservation.totalCents)}</td>
                      </tr>
                    )) : (
                      <tr>
                        <td colSpan={5} className="muted">Nenhuma reserva vinculada ainda.</td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </div>
            </section>

            <section className="card">
              <div className="card__header">
                <div className="card__title">Observações</div>
              </div>
              <div className="card__body" style={{ fontSize: 13, color: "var(--text-muted)", lineHeight: 1.55 }}>
                {tutor.notes || "Sem observacoes cadastradas para este tutor."}
              </div>
            </section>

            <section className="card">
              <div className="card__header">
                <div>
                  <div className="card__title"><Wallet /> Extrato de crédito</div>
                  <div className="card__subtitle">Saldo atual {brl(creditBalanceCents)}</div>
                </div>
                <CreditoTutorModal balance={brl(creditBalanceCents)} action={adjustCredit} />
              </div>
              <div className="card__body card__body--flush">
                <table className="table">
                  <thead>
                    <tr>
                      <th>Data</th>
                      <th>Tipo</th>
                      <th>Descrição</th>
                      <th className="table__num">Valor</th>
                    </tr>
                  </thead>
                  <tbody>
                    {tutor.creditTransactions.length ? tutor.creditTransactions.map((transaction) => (
                      <tr key={transaction.id}>
                        <td className="mono">{formatDateShort(transaction.entryDate)}</td>
                        <td>{transaction.type === "CREDIT_ADDED" ? "Credito" : transaction.type === "CREDIT_USED" ? "Uso" : "Ajuste"}</td>
                        <td className="muted">{transaction.description || "-"}</td>
                        <td className="table__num mono">{brl(transaction.amountCents)}</td>
                      </tr>
                    )) : (
                      <tr>
                        <td colSpan={4} className="muted">Nenhum crédito registrado para este cliente.</td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </div>
            </section>

          </main>

          <aside className="col">
            <section className="card">
              <div className="card__body">
                <div className="profile-card">
                  <div className="avatar avatar--xl avatar--lilac">{initials(tutor.name)}</div>
                  <div style={{ fontSize: 16, fontWeight: 600 }}>{tutor.name}</div>
                  <StatusBadge status={tutor.status} />
                </div>
                <dl className="kv">
                  <dt>Telefone</dt><dd className="mono">{tutor.phone || "-"}</dd>
                  <dt>Segundo telefone</dt>
                  <dd>
                    <span className="mono">{tutor.secondaryPhone || "-"}</span>
                    {tutor.secondaryPhoneNote ? <><br /><span className="subtle">{tutor.secondaryPhoneNote}</span></> : null}
                  </dd>
                  <dt>E-mail</dt><dd>{tutor.email || "-"}</dd>
                  <dt>CPF/RG</dt><dd className="mono">{tutor.document || "-"}</dd>
                  <dt>Nascimento</dt><dd>{longDate(tutor.birthDate)}</dd>
                  <dt>Endereço</dt><dd>{tutor.address || "-"}{tutor.cep ? <><br /><span className="mono subtle">CEP {tutor.cep}</span></> : null}</dd>
                  <dt>{tutor.clientSinceIsSystemOnly ? "Cadastro no sistema" : "Cliente desde"}</dt><dd>{longDate(tutor.clientSince)}</dd>
                  <dt>Total gasto</dt><dd className="mono">{brl(totalCents)}</dd>
                  <dt>Ticket medio</dt><dd className="mono">{brl(ticketCents)}</dd>
                  <dt>Credito disponivel</dt><dd className="mono">{brl(creditBalanceCents)}</dd>
                </dl>
                <div className="row" style={{ gap: 6, marginTop: 14 }}>
                  <a className="btn btn--sm" href={links.tel} style={{ flex: 1 }}><Phone /> Ligar</a>
                  <a className="btn btn--sm" href={links.whatsapp} target="_blank" rel="noreferrer" style={{ flex: 1 }}><Mail /> WhatsApp</a>
                </div>
                {tutor.secondaryPhone ? (
                  <div className="row" style={{ gap: 6, marginTop: 8 }}>
                    <a className="btn btn--sm" href={secondaryLinks.tel} style={{ flex: 1 }}><Phone /> Ligar 2</a>
                    <a className="btn btn--sm" href={secondaryLinks.whatsapp} target="_blank" rel="noreferrer" style={{ flex: 1 }}><Mail /> WhatsApp 2</a>
                  </div>
                ) : null}
              </div>
            </section>

            <section className="card">
              <div className="card__header">
                <div className="card__title"><Wallet /> Resumo</div>
              </div>
              <div className="card__body">
                <dl className="kv">
                  <dt>Pets</dt><dd className="mono">{tutor.pets.length}</dd>
                  <dt>Reservas</dt><dd className="mono">{tutor.reservations.length}</dd>
                  <dt>Ultima visita</dt><dd>{recentReservations[0] ? formatDateShort(recentReservations[0].startsAt) : "-"}</dd>
                  <dt>Credito aberto</dt><dd className="mono">{brl(creditBalanceCents)}</dd>
                </dl>
              </div>
            </section>

            <section className="card">
              <div className="card__header">
                <div className="card__title"><MapPin /> Endereço rápido</div>
              </div>
              <div className="card__body muted" style={{ fontSize: 13, lineHeight: 1.55 }}>
                {tutor.address || "Endereço não informado."}
              </div>
            </section>

            <section className="card">
              <div className="card__header">
                <div className="card__title"><CalendarDays /> Atalhos</div>
              </div>
              <div className="card__body stack" style={{ gap: 8 }}>
                <NovaReservaModal
                  tutors={formData.tutors.map((t) => ({ id: t.id, name: t.name, phone: t.phone, email: t.email }))}
                  pets={formData.pets.map((p) => ({ id: p.id, name: p.name, tutor: { id: p.tutor.id, name: p.tutor.name } }))}
                  serviceTypes={toReservationServiceOptions(formData.serviceTypes)}
                  seasonPeriods={toReservationSeasonOptions(formData.seasonPeriods)}
                  depositPercent={formData.settings?.depositPercent ?? 50}
                  defaultTutorId={tutor.id}
                  triggerVariant="default"
                />
                <Link className="btn" href="/agenda"><CalendarDays /> Ver agenda</Link>
                <EditarTutorModal
                  tutor={{
                    id: tutor.id,
                    name: tutor.name,
                    email: tutor.email,
                    phone: tutor.phone,
                    secondaryPhone: tutor.secondaryPhone,
                    secondaryPhoneNote: tutor.secondaryPhoneNote,
                    document: tutor.document,
                    cep: tutor.cep,
                    birthDate: tutor.birthDate,
                    address: tutor.address,
                    notes: tutor.notes,
                    status: tutor.status,
                  }}
                  canDelete={canDelete}
                  updateAction={updateTutor}
                  toggleStatusAction={toggleStatus}
                  deleteAction={deleteTutor}
                  triggerLabel="Editar cadastro"
                />
              </div>
            </section>
          </aside>
        </div>
      </div>
    </>
  );
}
