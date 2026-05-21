import { CalendarDays, CalendarRange } from "lucide-react";
import Link from "next/link";
import { Topbar } from "@/components/layout/topbar";
import { FlashMessage } from "@/components/ui/flash-message";
import { getConfigData } from "@/lib/app-data";
import { formatDateShort, formatDateTimeShort } from "@/lib/date";
import {
  disconnectGoogleCalendarAction,
  reactivateGoogleWebhookAction,
  saveGoogleCalendarAction,
  syncFutureReservationsToGoogleAction,
  updateGoogleEventTitlesAction,
  updateBusinessSettingsAction,
} from "./actions";

export default async function ConfiguracoesPage({
  searchParams,
}: {
  searchParams?: Promise<{ error?: string; saved?: string; google?: string; synced?: string; failed?: string }>;
}) {
  const sp = (await searchParams) ?? {};
  const config = await getConfigData();
  const settings = config.settings;

  return (
    <>
      <Topbar title="Configurações" subtitle="Empresa, capacidade, Google Agenda e temporadas" />
      {(sp.error || sp.saved || sp.google) ? (
        <div className="content stack" style={{ paddingBottom: 0 }}>
          <FlashMessage error={sp.error} saved={sp.saved} google={sp.google} />
        </div>
      ) : null}
      <div className="content page-grid">
        <section className="stack">
          <div className="card" id="dados-empresa">
            <div className="card__header">
              <div>
                <div className="card__title">Capacidade e horarios</div>
                <div className="card__subtitle">Configurações usadas em agenda e cálculos</div>
              </div>
            </div>
            <form className="card__body form-grid" action={updateBusinessSettingsAction}>
              <label className="field"><span className="field__label">Nome do negocio</span><input className="input" name="businessName" defaultValue={settings?.businessName ?? "Zeni Pets"} /></label>
              <label className="field"><span className="field__label">Responsavel</span><input className="input" name="ownerName" defaultValue={settings?.ownerName ?? "Fernanda Zeni"} /></label>
              <label className="field"><span className="field__label">Telefone</span><input className="input" name="phone" defaultValue={settings?.phone ?? ""} /></label>
              <label className="field"><span className="field__label">Instagram</span><input className="input" name="instagram" defaultValue={settings?.instagram ?? ""} /></label>
              <label className="field" style={{ gridColumn: "1 / -1" }}><span className="field__label">Endereço</span><input className="input" name="address" defaultValue={settings?.address ?? ""} /></label>
              <label className="field"><span className="field__label">Vagas no hotelzinho</span><input className="input" name="boardingCapacity" defaultValue={settings?.boardingCapacity ?? 12} /></label>
              <label className="field"><span className="field__label">Vagas na creche</span><input className="input" name="daycareCapacity" defaultValue={settings?.daycareCapacity ?? 8} /></label>
              <label className="field"><span className="field__label">Check-in padrao</span><input className="input" name="defaultCheckInTime" defaultValue={settings?.defaultCheckInTime ?? "10:00"} /></label>
              <label className="field"><span className="field__label">Check-out padrao</span><input className="input" name="defaultCheckOutTime" defaultValue={settings?.defaultCheckOutTime ?? "18:00"} /></label>
              <label className="field"><span className="field__label">Atraso 1 pet</span><input className="input" name="lateFeeOnePetCents" defaultValue={((settings?.lateFeeOnePetCents ?? 1000) / 100).toFixed(2).replace(".", ",")} /></label>
              <label className="field"><span className="field__label">Atraso 2+ pets</span><input className="input" name="lateFeeManyPetsCents" defaultValue={((settings?.lateFeeManyPetsCents ?? 1500) / 100).toFixed(2).replace(".", ",")} /></label>
              <label className="field"><span className="field__label">Sinal %</span><input className="input" name="depositPercent" defaultValue={settings?.depositPercent ?? 50} /></label>
              <div className="row" style={{ gridColumn: "1 / -1", justifyContent: "flex-end" }}>
                <button className="btn btn--primary" type="submit">Salvar configuracoes</button>
              </div>
            </form>
          </div>
        </section>

        <aside className="stack">
          <section className="card">
            <div className="card__header">
              <div>
                <div className="card__title"><CalendarDays /> Google Agenda</div>
                <div className="card__subtitle">
                  {config.googleConnection
                    ? config.googleConnection.googleCalendarId
                      ? `Conectado a ${config.googleConnection.googleCalendarId}`
                      : "Conta conectada, sem calendário escolhido"
                    : "Sem conta Google conectada"}
                </div>
              </div>
              <span className={`badge ${config.googleConnection?.googleCalendarId ? "badge--ativo" : "badge--pendente"}`}>
                {config.googleConnection?.googleCalendarId ? "Sincronizado" : "Aguardando"}
              </span>
            </div>
            <div className="card__body stack" style={{ gap: 12 }}>
              <dl className="kv" style={{ gridTemplateColumns: "140px 1fr", fontSize: 12 }}>
                <dt>Conta</dt>
                <dd>{config.googleConnection?.providerAccountEmail ?? "-"}</dd>
                <dt>Conectada em</dt>
                <dd>{config.googleConnection ? formatDateShort(config.googleConnection.connectedAt) : "-"}</dd>
                <dt>Calendar ID</dt>
                <dd className="mono">{config.googleConnection?.googleCalendarId ?? "-"}</dd>
                <dt>Ultimo sync</dt>
                <dd>{config.googleConnection?.lastSyncedAt ? formatDateTimeShort(config.googleConnection.lastSyncedAt) : "-"}</dd>
                <dt>Sync token</dt>
                <dd>{config.googleConnection?.googleSyncToken ? "Ativo" : "Sem token"}</dd>
                <dt>Webhook</dt>
                <dd>{config.googleConnection?.googleChannelId ? "Ativo" : "Inativo"}</dd>
              </dl>
              {sp.google === "sync-complete" ? (
                <div className="alert alert--success" role="status">
                  {sp.synced ?? "0"} reservas sincronizadas, {sp.failed ?? "0"} falhas.
                </div>
              ) : null}
              {sp.google === "title-sync-complete" ? (
                <div className="alert alert--success" role="status">
                  {sp.synced ?? "0"} nomes de eventos atualizados, {sp.failed ?? "0"} falhas.
                </div>
              ) : null}
              {config.googleCalendarError ? (
                <div className="alert alert--danger" role="alert">{config.googleCalendarError}</div>
              ) : null}
              {(!config.googleEnvStatus.clientId || !config.googleEnvStatus.clientSecret || !config.googleEnvStatus.redirectUri) ? (
                <div className="alert alert--danger" role="alert">
                  Configure GOOGLE_CLIENT_ID, GOOGLE_CLIENT_SECRET e GOOGLE_REDIRECT_URI para conectar.
                </div>
              ) : null}
              {(!config.runtimeSecretStatus.authSecretConfigured || !config.runtimeSecretStatus.tokenEncryptionConfigured) ? (
                <div className="alert alert--danger" role="alert">
                  AUTH_SECRET e TOKEN_ENCRYPTION_KEY ainda estao com valores de desenvolvimento.
                </div>
              ) : null}
              <a className="btn btn--primary" href="/api/google/oauth">Conectar Google</a>
              <form className="stack" action={saveGoogleCalendarAction} style={{ gap: 8 }}>
                <label className="field">
                  <span className="field__label">Calendario escolhido</span>
                  <select
                    className="select"
                    name="googleCalendarId"
                    defaultValue={config.googleConnection?.googleCalendarId ?? ""}
                    disabled={!config.googleCalendars.length}
                  >
                    <option value="">Selecione um calendário</option>
                    {config.googleConnection?.googleCalendarId && !config.googleCalendars.some((calendar) => calendar.id === config.googleConnection?.googleCalendarId) ? (
                      <option value={config.googleConnection.googleCalendarId}>{config.googleConnection.googleCalendarId}</option>
                    ) : null}
                    {config.googleCalendars.map((calendar) => (
                      <option value={calendar.id} key={calendar.id}>
                        {calendar.summary}{calendar.primary ? " (principal)" : ""}
                      </option>
                    ))}
                  </select>
                </label>
                <button className="btn" type="submit" disabled={!config.googleCalendars.length}>Salvar calendário</button>
              </form>
              <form action={syncFutureReservationsToGoogleAction}>
                <button className="btn" type="submit" disabled={!config.googleConnection?.googleCalendarId}>
                  Sincronizar reservas futuras
                </button>
              </form>
              <form action={updateGoogleEventTitlesAction}>
                <button className="btn" type="submit" disabled={!config.googleConnection?.googleCalendarId}>
                  Atualizar nomes dos eventos
                </button>
              </form>
              <form action={reactivateGoogleWebhookAction}>
                <button className="btn" type="submit" disabled={!config.googleConnection?.googleCalendarId || !config.googleEnvStatus.webhookUrl}>
                  Reativar webhook
                </button>
              </form>
              <form action={disconnectGoogleCalendarAction}>
                <button className="btn btn--danger" type="submit" disabled={!config.googleConnection}>
                  Desconectar Google
                </button>
              </form>
              {config.googleConflicts.length ? (
                <div className="stack" style={{ gap: 8 }}>
                  <div className="field__label">Conflitos recentes</div>
                  {config.googleConflicts.map((conflict) => (
                    <Link className="review-resolution-item" href={`/reservas/${conflict.id}`} key={conflict.id}>
                      <strong>{conflict.label}</strong>
                      <span className="subtle">{conflict.reason}</span>
                    </Link>
                  ))}
                </div>
              ) : null}
              <p className="subtle" style={{ margin: 0, fontSize: 11 }}>
                Convites ao tutor ficam desativados por padrao em cada reserva.
              </p>
            </div>
          </section>

          <section className="card">
            <div className="card__header">
              <div className="card__title"><CalendarRange /> Temporadas</div>
            </div>
            <div className="card__body stack" style={{ gap: 10 }}>
              <p className="muted" style={{ margin: 0, fontSize: 13 }}>
                Janelas em que preços de alta temporada são aplicados aos serviços.
              </p>
              <Link className="btn" href="/configuracoes/temporadas">Gerenciar temporadas</Link>
            </div>
          </section>

          <section className="card">
            <div className="card__header">
              <div className="card__title">Importação</div>
            </div>
            <div className="card__body stack" style={{ gap: 10 }}>
              <p className="muted" style={{ margin: 0, fontSize: 13 }}>
                Dados antigos entram em staging para revisão antes de qualquer tabela final.
              </p>
              <a className="btn" href="/importacao">Abrir revisão</a>
              <a className="btn" href="/api/import/preview">Ver preview JSON</a>
            </div>
          </section>
        </aside>
      </div>
    </>
  );
}
