import { getPrisma } from "@/lib/db";
import type { Prisma } from "@/generated/prisma/client";
import { getRuntimeSecretStatus } from "@/lib/crypto";
import { brl } from "@/lib/money";
import { getGoogleEnvStatus, listGoogleCalendars } from "@/lib/google/calendar";
import {
  endOfDay,
  endOfMonth,
  formatDateShort,
  formatDateTimeShort,
  startOfDay,
  startOfMonth,
} from "@/lib/date";

const ACTIVE_RESERVATION_STATUSES = ["CONFIRMED", "IN_PROGRESS"] as const;
const MONTH_LABELS = ["jan", "fev", "mar", "abr", "mai", "jun", "jul", "ago", "set", "out", "nov", "dez"];
const IMPORT_RECORD_STATUSES = ["PENDING_REVIEW", "NEEDS_REVIEW", "APPROVED", "REJECTED", "IMPORTED"] as const;
const IMPORT_DETECTED_TYPES = [
  "SERVICE_PRICE",
  "TAXI_RULE",
  "HISTORICAL_RESERVATION",
  "DAYCARE_RESERVATION",
  "FINANCIAL_ENTRY",
  "FINANCIAL_SUMMARY",
  "CLIENT_FORM",
  "UNKNOWN",
] as const;

function dbUnavailable(scope: string, error: unknown) {
  if (process.env.NODE_ENV !== "development") return;
  console.error(`Database unavailable while loading ${scope}. Returning empty real state.`, error);
}

function emptyMonthlyRevenue(referenceDate = new Date()) {
  return Array.from({ length: 6 }, (_, index) => {
    const date = new Date(referenceDate.getFullYear(), referenceDate.getMonth() - (5 - index), 1);
    return {
      month: MONTH_LABELS[date.getMonth()],
      current: 0,
      previous: 0,
    };
  });
}

export async function getBusinessSettingsData() {
  try {
    const settings = await getPrisma().businessSettings.findUnique({
      where: { singletonKey: "default" },
    });
    return settings;
  } catch (error) {
    dbUnavailable("business settings", error);
    return null;
  }
}

export async function getTutorsData() {
  try {
    const tutors = await getPrisma().tutor.findMany({
      orderBy: { createdAt: "desc" },
      include: { pets: true, reservations: true },
    });

    return tutors.map((tutor) => ({
      id: tutor.id,
      name: tutor.name,
      phone: tutor.phone ?? "",
      email: tutor.email ?? "",
      pets: tutor.pets.map((pet) => pet.name).join(", ") || "-",
      reservations: tutor.reservations.length,
      since: formatDateShort(tutor.createdAt),
      lastVisit:
        tutor.reservations
          .sort((a, b) => b.startsAt.getTime() - a.startsAt.getTime())[0]
          ?.startsAt
          ? formatDateShort(
              tutor.reservations.sort(
                (a, b) => b.startsAt.getTime() - a.startsAt.getTime(),
              )[0].startsAt,
            )
          : "-",
      status: tutor.status,
    }));
  } catch (error) {
    dbUnavailable("tutors", error);
    return [];
  }
}

export async function getTutorDetailData(id: string) {
  try {
    const tutor = await getPrisma().tutor.findUnique({
      where: { id },
      include: {
        pets: true,
        reservations: {
          orderBy: { startsAt: "desc" },
          include: { serviceType: true, payments: true },
        },
      },
    });
    if (!tutor) return null;

    const firstReservation = tutor.reservations.length
      ? tutor.reservations[tutor.reservations.length - 1]
      : null;
    const candidates: Array<Date | null> = [
      firstReservation?.startsAt ?? null,
      readSourcePayloadDate(tutor.sourcePayload, "firstSeenAt"),
      readSourcePayloadDate(tutor.sourcePayload, "createdAt"),
    ];
    const realSignals = candidates.filter((d): d is Date => d instanceof Date && !Number.isNaN(d.getTime()));
    const clientSince = realSignals.length
      ? realSignals.reduce((min, d) => (d < min ? d : min), realSignals[0])
      : tutor.createdAt;
    const clientSinceIsSystemOnly = realSignals.length === 0;

    return Object.assign(tutor, { clientSince, clientSinceIsSystemOnly });
  } catch (error) {
    dbUnavailable("tutor detail", error);
    return null;
  }
}

function readSourcePayloadDate(payload: unknown, key: string): Date | null {
  if (!payload || typeof payload !== "object") return null;
  const value = (payload as Record<string, unknown>)[key];
  if (!value) return null;
  const date = new Date(value as string | number);
  return Number.isNaN(date.getTime()) ? null : date;
}

export async function getPetsData() {
  try {
    const pets = await getPrisma().pet.findMany({
      orderBy: { createdAt: "desc" },
      include: { tutor: true, reservationPets: { include: { reservation: true } } },
    });

    return pets.map((pet) => ({
      id: pet.id,
      name: pet.name,
      tutor: pet.tutor.name,
      breed: pet.breed ?? "Sem raca definida",
      age: pet.ageLabel ?? "-",
      neutered: Boolean(pet.isNeutered),
      sociable: Boolean(pet.isSociable),
      status:
        pet.reservationPets.some((item) =>
          ACTIVE_RESERVATION_STATUSES.includes(
            item.reservation.status as (typeof ACTIVE_RESERVATION_STATUSES)[number],
          ),
        )
          ? "Hospedado agora"
          : "Sem reserva ativa",
    }));
  } catch (error) {
    dbUnavailable("pets", error);
    return [];
  }
}

export async function getPetDetailData(id: string) {
  try {
    return await getPrisma().pet.findUnique({
      where: { id },
      include: {
        tutor: true,
        reservationPets: {
          include: { reservation: { include: { serviceType: true } } },
          orderBy: { createdAt: "desc" },
        },
      },
    });
  } catch (error) {
    dbUnavailable("pet detail", error);
    return null;
  }
}

export async function getReservationFormData() {
  try {
    const [tutors, pets, serviceTypes, settings] = await Promise.all([
      getPrisma().tutor.findMany({ orderBy: { name: "asc" } }),
      getPrisma().pet.findMany({ include: { tutor: true }, orderBy: { name: "asc" } }),
      getPrisma().serviceType.findMany({
        where: { isActive: true },
        include: { priceRules: { where: { isActive: true } } },
        orderBy: { name: "asc" },
      }),
      getBusinessSettingsData(),
    ]);

    return { tutors, pets, serviceTypes, settings };
  } catch (error) {
    dbUnavailable("reservation form", error);
    return { tutors: [], pets: [], serviceTypes: [], settings: null };
  }
}

export async function getReservationsByMonthData(year: number, month: number) {
  const start = new Date(year, month, 1, 0, 0, 0);
  const end = new Date(year, month + 1, 1, 0, 0, 0);
  try {
    const reservations = await getPrisma().reservation.findMany({
      where: {
        OR: [
          { startsAt: { gte: start, lt: end } },
          { endsAt: { gt: start, lte: end } },
          { AND: [{ startsAt: { lt: start } }, { endsAt: { gt: end } }] },
        ],
      },
      orderBy: { startsAt: "asc" },
      include: {
        tutor: true,
        serviceType: true,
        reservationPets: { include: { pet: true } },
        payments: true,
      },
    });
    return reservations.map((reservation) => ({
      id: reservation.id,
      tutor: reservation.tutor.name,
      type: reservation.serviceType.name,
      pets: reservation.reservationPets.map((item) => item.pet.name).join(", "),
      period: `${formatDateTimeShort(reservation.startsAt)} - ${formatDateTimeShort(reservation.endsAt)}`,
      status: reservation.status,
      payment: reservation.paymentStatus,
      value: brl(reservation.totalCents),
      startsAt: reservation.startsAt,
      endsAt: reservation.endsAt,
    }));
  } catch (error) {
    dbUnavailable("reservations by month", error);
    return [];
  }
}

export async function getUpcomingReservationsData(daysAhead = 14) {
  const now = new Date();
  const horizon = new Date(now.getTime() + daysAhead * 86_400_000);
  try {
    const reservations = await getPrisma().reservation.findMany({
      where: { startsAt: { gte: now, lte: horizon } },
      orderBy: { startsAt: "asc" },
      include: {
        tutor: true,
        serviceType: true,
        reservationPets: { include: { pet: true } },
        payments: true,
      },
    });
    return reservations.map((reservation) => ({
      id: reservation.id,
      tutor: reservation.tutor.name,
      type: reservation.serviceType.name,
      pets: reservation.reservationPets.map((item) => item.pet.name).join(", "),
      period: `${formatDateTimeShort(reservation.startsAt)} - ${formatDateTimeShort(reservation.endsAt)}`,
      status: reservation.status,
      payment: reservation.paymentStatus,
      value: brl(reservation.totalCents),
      startsAt: reservation.startsAt,
      endsAt: reservation.endsAt,
    }));
  } catch (error) {
    dbUnavailable("upcoming reservations", error);
    return [];
  }
}

export type ReservationListFilters = {
  status?: string[];
  paymentStatus?: string[];
  serviceTypeId?: string;
  tutorId?: string;
  from?: string;
  to?: string;
  q?: string;
  page?: number;
};

const RESERVATION_STATUSES = [
  "REQUESTED",
  "CONFIRMED",
  "IN_PROGRESS",
  "COMPLETED",
  "CANCELLED",
] as const;
const RESERVATION_PAYMENT_STATUSES = ["PENDING", "PARTIAL", "PAID", "CANCELLED"] as const;

const ACTIVE_STATUS_DEFAULT = ["CONFIRMED", "IN_PROGRESS"];

export async function getReservationsListData(filters: ReservationListFilters = {}) {
  const pageSize = 20;
  const page = Math.max(filters.page ?? 1, 1);
  const statusFilter = (filters.status ?? ACTIVE_STATUS_DEFAULT).filter((value) =>
    (RESERVATION_STATUSES as readonly string[]).includes(value),
  );
  const paymentFilter = (filters.paymentStatus ?? []).filter((value) =>
    (RESERVATION_PAYMENT_STATUSES as readonly string[]).includes(value),
  );
  const fromDate = filters.from ? new Date(filters.from) : null;
  const toDate = filters.to ? new Date(filters.to) : null;
  const query = (filters.q ?? "").trim();

  try {
    const where: Record<string, unknown> = {};
    if (statusFilter.length) where.status = { in: statusFilter };
    if (paymentFilter.length) where.paymentStatus = { in: paymentFilter };
    if (filters.serviceTypeId) where.serviceTypeId = filters.serviceTypeId;
    if (filters.tutorId) where.tutorId = filters.tutorId;
    if (fromDate && !Number.isNaN(fromDate.getTime())) where.startsAt = { gte: fromDate };
    if (toDate && !Number.isNaN(toDate.getTime())) {
      where.endsAt = { ...(where.endsAt as object ?? {}), lte: toDate };
    }
    if (query) {
      where.OR = [
        { tutor: { name: { contains: query, mode: "insensitive" } } },
        { reservationPets: { some: { pet: { name: { contains: query, mode: "insensitive" } } } } },
      ];
    }

    const [total, reservations, tutors, serviceTypes] = await Promise.all([
      getPrisma().reservation.count({ where }),
      getPrisma().reservation.findMany({
        where,
        include: {
          tutor: true,
          serviceType: true,
          reservationPets: { include: { pet: true } },
        },
        orderBy: [{ startsAt: "asc" }, { createdAt: "asc" }],
        skip: (page - 1) * pageSize,
        take: pageSize,
      }),
      getPrisma().tutor.findMany({ orderBy: { name: "asc" }, select: { id: true, name: true } }),
      getPrisma().serviceType.findMany({ orderBy: { name: "asc" }, select: { id: true, name: true } }),
    ]);

    const totalPages = Math.max(Math.ceil(total / pageSize), 1);

    return {
      reservations: reservations.map((reservation) => ({
        id: reservation.id,
        tutor: reservation.tutor.name,
        tutorId: reservation.tutor.id,
        type: reservation.serviceType.name,
        pets: reservation.reservationPets.map((item) => item.pet.name).join(", "),
        period: `${formatDateTimeShort(reservation.startsAt)} - ${formatDateTimeShort(reservation.endsAt)}`,
        status: reservation.status,
        payment: reservation.paymentStatus,
        value: brl(reservation.totalCents),
      })),
      tutors,
      serviceTypes,
      pageSize,
      page,
      totalPages,
      total,
      filters: {
        status: statusFilter,
        paymentStatus: paymentFilter,
        serviceTypeId: filters.serviceTypeId ?? "",
        tutorId: filters.tutorId ?? "",
        from: filters.from ?? "",
        to: filters.to ?? "",
        q: filters.q ?? "",
      },
      statusOptions: RESERVATION_STATUSES,
      paymentStatusOptions: RESERVATION_PAYMENT_STATUSES,
    };
  } catch (error) {
    dbUnavailable("reservations list", error);
    return {
      reservations: [],
      tutors: [],
      serviceTypes: [],
      pageSize,
      page: 1,
      totalPages: 1,
      total: 0,
      filters: {
        status: statusFilter,
        paymentStatus: paymentFilter,
        serviceTypeId: filters.serviceTypeId ?? "",
        tutorId: filters.tutorId ?? "",
        from: filters.from ?? "",
        to: filters.to ?? "",
        q: filters.q ?? "",
      },
      statusOptions: RESERVATION_STATUSES,
      paymentStatusOptions: RESERVATION_PAYMENT_STATUSES,
    };
  }
}

export async function getReservationDetailData(id: string) {
  try {
    return await getPrisma().reservation.findUnique({
      where: { id },
      include: {
        tutor: true,
        serviceType: true,
        reservationPets: { include: { pet: true } },
        payments: { orderBy: { createdAt: "desc" } },
        financialEntries: { orderBy: { entryDate: "desc" } },
      },
    });
  } catch (error) {
    dbUnavailable("reservation detail", error);
    return null;
  }
}

async function getMonthlyRevenueData(referenceDate = new Date()) {
  const months = Array.from({ length: 6 }, (_, index) =>
    new Date(referenceDate.getFullYear(), referenceDate.getMonth() - (5 - index), 1),
  );
  const firstMonth = months[0];
  const lastMonth = months[months.length - 1];
  const entries = await getPrisma().financialEntry.findMany({
    where: {
      kind: "INCOME",
      entryDate: {
        gte: new Date(firstMonth.getFullYear() - 1, firstMonth.getMonth(), 1),
        lte: endOfMonth(lastMonth),
      },
    },
  });

  return months.map((monthDate) => {
    const currentYear = monthDate.getFullYear();
    const previousYear = currentYear - 1;
    const month = monthDate.getMonth();
    const sumFor = (year: number) =>
      entries
        .filter((entry) => entry.entryDate.getFullYear() === year && entry.entryDate.getMonth() === month)
        .reduce((sum, entry) => sum + entry.amountCents, 0);

    return {
      month: MONTH_LABELS[month],
      current: Math.round(sumFor(currentYear) / 100),
      previous: Math.round(sumFor(previousYear) / 100),
    };
  });
}

async function getTodayTasksData(today = new Date()) {
  const dayStart = startOfDay(today);
  const dayEnd = endOfDay(today);
  const occurrences = await getPrisma().taskOccurrence.findMany({
    where: {
      occurrenceDate: { gte: dayStart, lte: dayEnd },
      task: { status: { not: "CANCELLED" } },
    },
    include: { task: true },
    orderBy: [{ status: "asc" }, { occurrenceDate: "asc" }],
    take: 24,
  });

  return occurrences.map((occurrence) => ({
    id: occurrence.id,
    taskId: occurrence.task.id,
    label: occurrence.task.title,
    description: occurrence.task.description,
    done: occurrence.status === "DONE",
    rangeLabel: occurrence.task.endsAt
      ? `Ate ${formatDateShort(occurrence.task.endsAt)}`
      : null,
  }));
}

async function getUpcomingPetSitterVisitsData() {
  const now = new Date();
  const reservations = await getPrisma().reservation.findMany({
    where: {
      status: { in: ["REQUESTED", "CONFIRMED", "IN_PROGRESS"] },
      startsAt: { gte: now },
      serviceType: { kind: "PET_SITTING" },
    },
    include: {
      tutor: true,
      reservationPets: { include: { pet: true } },
    },
    orderBy: { startsAt: "asc" },
    take: 5,
  });

  return reservations.map((reservation) => ({
    id: reservation.id,
    pet: reservation.reservationPets.map((item) => item.pet.name).join(", ") || "Sem pet vinculado",
    tutor: reservation.tutor.name,
    time: formatDateTimeShort(reservation.startsAt),
  }));
}

export async function getDashboardData() {
  const today = new Date();
  const dayStart = startOfDay(today);
  const dayEnd = endOfDay(today);
  const monthStart = startOfMonth(today);
  const monthEnd = endOfMonth(today);

  try {
    const [
      settings,
      activeReservations,
      daycareToday,
      monthIncome,
      pendingReservations,
      monthlyRevenue,
      tasks,
      petSitterVisits,
    ] =
      await Promise.all([
        getPrisma().businessSettings.findUnique({ where: { singletonKey: "default" } }),
        getPrisma().reservation.findMany({
          where: {
            status: { in: [...ACTIVE_RESERVATION_STATUSES] },
            startsAt: { lte: dayEnd },
            endsAt: { gte: dayStart },
          },
          include: {
            tutor: true,
            serviceType: true,
            reservationPets: { include: { pet: true } },
          },
        }),
        getPrisma().reservation.count({
          where: {
            serviceType: { kind: "DAYCARE" },
            startsAt: { lte: dayEnd },
            endsAt: { gte: dayStart },
          },
        }),
        getPrisma().financialEntry.aggregate({
          where: { kind: "INCOME", entryDate: { gte: monthStart, lte: monthEnd } },
          _sum: { amountCents: true },
        }),
        getPrisma().reservation.findMany({
          where: { paymentStatus: { in: ["PENDING", "PARTIAL"] } },
          include: { payments: true },
        }),
        getMonthlyRevenueData(today),
        getTodayTasksData(today),
        getUpcomingPetSitterVisitsData(),
      ]);

    const hostedPets = activeReservations
      .flatMap((reservation) =>
        reservation.reservationPets.map((item) => ({
          reservationPetId: item.id,
          pet: item.pet.name,
          breed: item.pet.breed ?? item.pet.ageLabel ?? "Ficha pendente",
          tutor: reservation.tutor.name,
          checkIn: formatDateShort(reservation.startsAt),
          checkOut: formatDateShort(reservation.endsAt),
          status: reservation.status,
          id: reservation.id,
        })),
      )
      .slice(0, 6);

    const pendingCents = pendingReservations.reduce((sum, reservation) => {
      const paid = reservation.payments.reduce((total, payment) => total + payment.amountCents, 0);
      return sum + Math.max(reservation.totalCents - paid, 0);
    }, 0);

    const capacity = settings?.boardingCapacity ?? 12;
    const hostedCount = hostedPets.length;
    const upcoming = await getUpcomingServicesData();

    return {
      metrics: [
        {
          label: "Hospedados hoje",
          value: String(hostedCount),
          hint: `${capacity - hostedCount} vagas livres`,
          icon: "Bed",
        },
        {
          label: "Daycare hoje",
          value: String(daycareToday),
          hint: "reservas de creche no dia",
          icon: "Sun",
        },
        {
          label: "Faturamento mes",
          value: brl(monthIncome._sum.amountCents ?? 0),
          hint: "lancamentos pagos",
          icon: "Wallet",
          positive: true,
        },
        {
          label: "A receber",
          value: brl(pendingCents),
          hint: `${pendingReservations.length} reservas pendentes`,
          icon: "AlertCircle",
        },
      ],
      hostedPets,
      upcoming,
      capacity,
      hostedCount,
      monthlyRevenue,
      tasks,
      petSitterVisits,
    };
  } catch (error) {
    dbUnavailable("dashboard", error);
    return {
      metrics: [
        { label: "Hospedados hoje", value: "0", hint: "banco indisponivel", icon: "Bed" },
        { label: "Daycare hoje", value: "0", hint: "banco indisponivel", icon: "Sun" },
        {
          label: "Faturamento mes",
          value: brl(0),
          hint: "banco indisponivel",
          positive: true,
          icon: "Wallet",
        },
        {
          label: "A receber",
          value: brl(0),
          hint: "banco indisponivel",
          icon: "AlertCircle",
        },
      ],
      hostedPets: [],
      upcoming: [],
      capacity: 12,
      hostedCount: 0,
      monthlyRevenue: emptyMonthlyRevenue(today),
      tasks: [],
      petSitterVisits: [],
    };
  }
}

export async function getUpcomingServicesData() {
  const now = new Date();
  const inTwoDays = new Date(now.getTime() + 48 * 60 * 60 * 1000);
  try {
    const reservations = await getPrisma().reservation.findMany({
      where: {
        status: { in: ["REQUESTED", "CONFIRMED", "IN_PROGRESS"] },
        OR: [
          { startsAt: { gte: now, lte: inTwoDays } },
          { endsAt: { gte: now, lte: inTwoDays } },
        ],
      },
      include: { tutor: true, serviceType: true, reservationPets: { include: { pet: true } } },
      orderBy: { startsAt: "asc" },
      take: 8,
    });

    return reservations.map((reservation) => ({
      id: reservation.id,
      time: formatDateTimeShort(reservation.startsAt),
      label: `${reservation.serviceType.name} - ${reservation.reservationPets.map((item) => item.pet.name).join(", ")}`,
      sub: `${reservation.tutor.name} - ${brl(reservation.totalCents)}`,
      kind: reservation.serviceType.kind === "DAYCARE" ? "day" : "in",
      color: reservation.serviceType.kind === "DAYCARE" ? "warm" : "teal",
    }));
  } catch (error) {
    dbUnavailable("upcoming services", error);
    return [];
  }
}

export async function getFinanceData(tab: "income" | "expense" | "all" = "all") {
  const today = new Date();
  const monthStart = startOfMonth(today);
  const monthEnd = endOfMonth(today);

  try {
    const [entries, pendingReservations] = await Promise.all([
      getPrisma().financialEntry.findMany({
        where: {
          entryDate: { gte: monthStart, lte: monthEnd },
          ...(tab === "income" ? { kind: "INCOME" } : tab === "expense" ? { kind: "EXPENSE" } : {}),
        },
        orderBy: { entryDate: "desc" },
      }),
      getPrisma().reservation.findMany({
        where: { paymentStatus: { in: ["PENDING", "PARTIAL"] } },
        include: { tutor: true, payments: true },
      }),
    ]);

    // Compute month metrics from full set (independent of tab filter)
    const monthEntries = await getPrisma().financialEntry.findMany({
      where: { entryDate: { gte: monthStart, lte: monthEnd } },
      select: { kind: true, amountCents: true },
    });
    const income = monthEntries
      .filter((entry) => entry.kind === "INCOME")
      .reduce((sum, entry) => sum + entry.amountCents, 0);
    const expenses = monthEntries
      .filter((entry) => entry.kind === "EXPENSE")
      .reduce((sum, entry) => sum + entry.amountCents, 0);
    const pending = pendingReservations.reduce((sum, reservation) => {
      const paid = reservation.payments.reduce((total, payment) => total + payment.amountCents, 0);
      return sum + Math.max(reservation.totalCents - paid, 0);
    }, 0);

    return {
      tab,
      monthLabel: formatMonthLabel(today),
      monthEntriesCount: monthEntries.length,
      metrics: { income, pending, expenses, profit: income - expenses },
      entries: entries.map((entry) => ({
        id: entry.id,
        date: formatDateShort(entry.entryDate),
        description: entry.description ?? entry.category,
        tutor: entry.kind === "EXPENSE" ? "-" : "Zeni Pets",
        method: entry.method ?? "-",
        status: "PAID",
        amount: brl(entry.amountCents),
        kind: entry.kind,
        isManual: entry.isManual,
      })),
      pendingReservations,
    };
  } catch (error) {
    dbUnavailable("finance", error);
    return {
      tab,
      monthLabel: formatMonthLabel(new Date()),
      monthEntriesCount: 0,
      metrics: { income: 0, pending: 0, expenses: 0, profit: 0 },
      entries: [],
      pendingReservations: [],
    };
  }
}

function formatMonthLabel(date: Date) {
  const months = ["Janeiro", "Fevereiro", "Marco", "Abril", "Maio", "Junho", "Julho", "Agosto", "Setembro", "Outubro", "Novembro", "Dezembro"];
  return `${months[date.getMonth()]} ${date.getFullYear()}`;
}

export async function getConfigData() {
  try {
    const prisma = getPrisma();
    const [settings, serviceTypes, seasons, googleConnection, importBatches] =
      await Promise.all([
        getBusinessSettingsData(),
        prisma.serviceType.findMany({
          include: { priceRules: true },
          orderBy: { name: "asc" },
        }),
        prisma.seasonPeriod.findMany({ orderBy: { startsAt: "asc" } }),
        prisma.googleCalendarConnection.findFirst({ orderBy: { connectedAt: "desc" } }),
        prisma.importBatch.findMany({
          include: { _count: { select: { records: true } } },
          orderBy: { createdAt: "desc" },
        }),
      ]);

    const [googleConflicts, calendarResult] = await Promise.all([
      prisma.reservation.findMany({
        where: { syncConflict: true },
        include: { tutor: true, serviceType: true },
        orderBy: { googleLastSyncedAt: "desc" },
        take: 5,
      }),
      googleConnection
        ? listGoogleCalendars(googleConnection)
            .then((calendars) => ({ calendars, error: null as string | null }))
            .catch((error: unknown) => ({
              calendars: [],
              error: error instanceof Error ? error.message : "Falha ao listar calendarios",
            }))
        : Promise.resolve({ calendars: [], error: null as string | null }),
    ]);

    return {
      settings,
      serviceTypes,
      seasons,
      googleConnection,
      googleCalendars: calendarResult.calendars.map((calendar) => ({
        id: calendar.id ?? "",
        summary: calendar.summary ?? calendar.id ?? "Calendario sem nome",
        primary: Boolean(calendar.primary),
        accessRole: calendar.accessRole ?? "",
      })).filter((calendar) => calendar.id),
      googleCalendarError: calendarResult.error,
      googleEnvStatus: getGoogleEnvStatus(),
      runtimeSecretStatus: getRuntimeSecretStatus(),
      googleConflicts: googleConflicts.map((reservation) => ({
        id: reservation.id,
        label: `${reservation.serviceType.name} - ${reservation.tutor.name}`,
        reason: reservation.syncConflictReason ?? "Conflito pendente",
      })),
      importBatches,
    };
  } catch (error) {
    dbUnavailable("config", error);
    return {
      settings: null,
      serviceTypes: [],
      seasons: [],
      googleConnection: null,
      googleCalendars: [],
      googleCalendarError: null,
      googleEnvStatus: getGoogleEnvStatus(),
      runtimeSecretStatus: getRuntimeSecretStatus(),
      googleConflicts: [],
      importBatches: [],
    };
  }
}

export async function getServicePriceRows() {
  try {
    const serviceTypes = await getPrisma().serviceType.findMany({
      include: { priceRules: true },
      orderBy: { name: "asc" },
    });

    return serviceTypes.flatMap((service) =>
      service.priceRules.map((rule) => ({
        id: rule.id,
        name: service.name,
        detail: rule.label,
        pix: rule.paymentMethod === "PIX" ? brl(rule.firstPetCents) : "-",
        card: rule.paymentMethod === "CARD" ? brl(rule.firstPetCents) : "-",
      })),
    );
  } catch (error) {
    dbUnavailable("service prices", error);
    return [];
  }
}

export async function getImportBatchesData() {
  try {
    return await getPrisma().importBatch.findMany({
      include: {
        _count: { select: { records: true } },
        records: {
          take: 8,
          orderBy: { createdAt: "asc" },
        },
      },
      orderBy: { createdAt: "desc" },
    });
  } catch (error) {
    dbUnavailable("import batches", error);
    return [];
  }
}

export type ImportReviewParams = {
  batchId?: string;
  status?: string;
  type?: string;
  q?: string;
  page?: string;
};

function countBy<T extends string>(items: T[]) {
  return items.reduce<Record<string, number>>((acc, item) => {
    acc[item] = (acc[item] ?? 0) + 1;
    return acc;
  }, {});
}

function payloadText(value: Prisma.JsonValue | null | undefined) {
  if (value == null) return "";
  return JSON.stringify(value).toLowerCase();
}

function cleanImportFilter(value?: string) {
  return value && value !== "ALL" ? value : undefined;
}

export async function getImportReviewData(params: ImportReviewParams = {}) {
  const pageSize = 20;
  const selectedBatchId = cleanImportFilter(params.batchId);
  const selectedStatus = cleanImportFilter(params.status);
  const selectedType = cleanImportFilter(params.type);
  const query = (params.q ?? "").trim().toLowerCase();
  const page = Math.max(Number(params.page ?? 1) || 1, 1);

  try {
    const [batches, records] = await Promise.all([
      getPrisma().importBatch.findMany({
        include: { records: { select: { status: true, detectedType: true } } },
        orderBy: { createdAt: "desc" },
      }),
      getPrisma().importRecord.findMany({
        include: {
          batch: true,
          resolutions: { orderBy: { createdAt: "desc" }, take: 4 },
        },
        orderBy: [
          { batch: { fileName: "asc" } },
          { sourceSheet: "asc" },
          { sourceRow: "asc" },
          { sourceBlock: "asc" },
          { createdAt: "asc" },
        ],
      }),
    ]);

    const filtered = records.filter((record) => {
      if (selectedBatchId && record.batchId !== selectedBatchId) return false;
      if (selectedStatus && record.status !== selectedStatus) return false;
      if (selectedType && record.detectedType !== selectedType) return false;
      if (!query) return true;
      return [
        record.batch.fileName,
        record.batch.sourceKind,
        record.sourceSheet,
        record.reviewNotes,
        record.detectedType,
        payloadText(record.normalizedPayload),
        payloadText(record.rawPayload),
      ]
        .filter(Boolean)
        .some((value) => String(value).toLowerCase().includes(query));
    });

    const totalPages = Math.max(Math.ceil(filtered.length / pageSize), 1);
    const safePage = Math.min(page, totalPages);
    const pageRecords = filtered.slice((safePage - 1) * pageSize, safePage * pageSize);
    const allStatuses = records.map((record) => record.status);
    const allTypes = records.map((record) => record.detectedType);

    return {
      filters: {
        batchId: selectedBatchId ?? "ALL",
        status: selectedStatus ?? "ALL",
        type: selectedType ?? "ALL",
        q: params.q ?? "",
        page: safePage,
      },
      pageSize,
      totalPages,
      totalFiltered: filtered.length,
      batches: batches.map((batch) => ({
        id: batch.id,
        fileName: batch.fileName,
        sourceKind: batch.sourceKind,
        status: batch.status,
        totalRecords: batch.records.length,
        statusCounts: countBy(batch.records.map((record) => record.status)),
        typeCounts: countBy(batch.records.map((record) => record.detectedType)),
      })),
      records: pageRecords,
      metrics: {
        total: records.length,
        filtered: filtered.length,
        pending: allStatuses.filter((status) => status === "PENDING_REVIEW").length,
        needsReview: allStatuses.filter((status) => status === "NEEDS_REVIEW").length,
        approved: allStatuses.filter((status) => status === "APPROVED").length,
        rejected: allStatuses.filter((status) => status === "REJECTED").length,
        imported: allStatuses.filter((status) => status === "IMPORTED").length,
      },
      statusOptions: IMPORT_RECORD_STATUSES,
      typeOptions: IMPORT_DETECTED_TYPES.filter((type) => allTypes.includes(type)),
    };
  } catch (error) {
    dbUnavailable("import review", error);
    return {
      filters: {
        batchId: "ALL",
        status: "ALL",
        type: "ALL",
        q: params.q ?? "",
        page: 1,
      },
      pageSize,
      totalPages: 1,
      totalFiltered: 0,
      batches: [],
      records: [],
      metrics: {
        total: 0,
        filtered: 0,
        pending: 0,
        needsReview: 0,
        approved: 0,
        rejected: 0,
        imported: 0,
      },
      statusOptions: IMPORT_RECORD_STATUSES,
      typeOptions: IMPORT_DETECTED_TYPES,
    };
  }
}

export async function getPetTasksData(petId: string, today = new Date()) {
  try {
    const dayStart = startOfDay(today);
    const tasks = await getPrisma().task.findMany({
      where: { petId, status: { not: "CANCELLED" } },
      include: {
        occurrences: {
          where: { occurrenceDate: { gte: dayStart } },
          orderBy: { occurrenceDate: "asc" },
          take: 14,
        },
      },
      orderBy: [{ taskDate: "desc" }],
      take: 30,
    });

    return tasks.map((task) => ({
      id: task.id,
      title: task.title,
      description: task.description,
      taskDate: task.taskDate,
      endsAt: task.endsAt,
      occurrences: task.occurrences.map((occurrence) => ({
        id: occurrence.id,
        date: occurrence.occurrenceDate,
        done: occurrence.status === "DONE",
      })),
    }));
  } catch (error) {
    dbUnavailable("pet tasks", error);
    return [];
  }
}

export async function getCurrentUserData(userId: string) {
  try {
    const user = await getPrisma().user.findUnique({
      where: { id: userId },
      select: { name: true, email: true, role: true },
    });
    return user;
  } catch (error) {
    dbUnavailable("current user", error);
    return null;
  }
}

export async function getShellCountsData() {
  try {
    const now = new Date();
    const activeWhere = {
      status: { in: ["CONFIRMED", "IN_PROGRESS"] as Array<"CONFIRMED" | "IN_PROGRESS"> },
      endsAt: { gte: now },
    };
    const [agenda, reservas, tutores, pets] = await Promise.all([
      getPrisma().reservation.count({
        where: {
          status: { in: ["REQUESTED", "CONFIRMED", "IN_PROGRESS"] },
          endsAt: { gte: now },
        },
      }),
      getPrisma().reservation.count({ where: activeWhere }),
      getPrisma().tutor.count(),
      getPrisma().pet.count(),
    ]);

    return { agenda, reservas, tutores, pets };
  } catch (error) {
    dbUnavailable("navigation counts", error);
    return { agenda: 0, reservas: 0, tutores: 0, pets: 0 };
  }
}
