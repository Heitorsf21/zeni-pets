-- CreateEnum
CREATE TYPE "UserRole" AS ENUM ('OWNER', 'STAFF');

-- CreateEnum
CREATE TYPE "TutorStatus" AS ENUM ('ACTIVE', 'INACTIVE');

-- CreateEnum
CREATE TYPE "ServiceKind" AS ENUM ('BOARDING', 'DAYCARE', 'PET_SITTING', 'DOG_WALKER', 'TAXI_PET', 'ADAPTATION', 'OTHER');

-- CreateEnum
CREATE TYPE "ReservationStatus" AS ENUM ('REQUESTED', 'CONFIRMED', 'IN_PROGRESS', 'COMPLETED', 'CANCELLED');

-- CreateEnum
CREATE TYPE "PaymentStatus" AS ENUM ('PENDING', 'PARTIAL', 'PAID', 'CANCELLED');

-- CreateEnum
CREATE TYPE "PaymentMethod" AS ENUM ('PIX', 'CASH', 'CARD', 'TRANSFER', 'OTHER');

-- CreateEnum
CREATE TYPE "PickupMode" AS ENUM ('TUTOR_DROPS_OFF', 'ZENI_PICKUP');

-- CreateEnum
CREATE TYPE "FinancialEntryKind" AS ENUM ('INCOME', 'EXPENSE');

-- CreateEnum
CREATE TYPE "ImportBatchStatus" AS ENUM ('PENDING_REVIEW', 'REVIEWING', 'APPROVED', 'REJECTED');

-- CreateEnum
CREATE TYPE "ImportRecordStatus" AS ENUM ('PENDING_REVIEW', 'NEEDS_REVIEW', 'APPROVED', 'REJECTED', 'IMPORTED');

-- CreateEnum
CREATE TYPE "ImportSourceKind" AS ENUM ('PRICE_SHEET', 'CLIENTS_2025', 'CLIENTS_2026', 'CLIENT_FORM_DOCX', 'UNKNOWN');

-- CreateEnum
CREATE TYPE "ImportDetectedType" AS ENUM ('SERVICE_PRICE', 'TAXI_RULE', 'HISTORICAL_RESERVATION', 'DAYCARE_RESERVATION', 'FINANCIAL_ENTRY', 'FINANCIAL_SUMMARY', 'CLIENT_FORM', 'UNKNOWN');

-- CreateEnum
CREATE TYPE "ImportConflictType" AS ENUM ('DUPLICATE_TUTOR', 'DUPLICATE_PET', 'FIELD_MISMATCH', 'GOOGLE_EVENT', 'DIVERGENT_SOURCE', 'UNKNOWN');

-- CreateEnum
CREATE TYPE "ImportConflictStatus" AS ENUM ('OPEN', 'RESOLVED', 'IGNORED');

-- CreateEnum
CREATE TYPE "ImportResolutionAction" AS ENUM ('APPROVE', 'REJECT', 'MERGE_TUTOR', 'MERGE_PET', 'CORRECT_FIELD', 'IMPORT_RECORD', 'IGNORE');

-- CreateEnum
CREATE TYPE "FinancialSummaryKind" AS ENUM ('MONTHLY_CLOSING', 'OPERATIONAL_TOTAL');

-- CreateEnum
CREATE TYPE "TaskStatus" AS ENUM ('PENDING', 'DONE', 'CANCELLED');

-- CreateEnum
CREATE TYPE "TaskSource" AS ENUM ('MANUAL', 'RESERVATION_DAILY');

-- CreateTable
CREATE TABLE "User" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "passwordHash" TEXT NOT NULL,
    "role" "UserRole" NOT NULL DEFAULT 'OWNER',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "User_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Tutor" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "email" TEXT,
    "phone" TEXT,
    "document" TEXT,
    "birthDate" TIMESTAMP(3),
    "address" TEXT,
    "cep" TEXT,
    "notes" TEXT,
    "status" "TutorStatus" NOT NULL DEFAULT 'ACTIVE',
    "importRecordId" TEXT,
    "sourceFileName" TEXT,
    "sourceSheet" TEXT,
    "sourceRow" INTEGER,
    "sourceBlock" INTEGER,
    "sourcePayload" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Tutor_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Pet" (
    "id" TEXT NOT NULL,
    "tutorId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "species" TEXT NOT NULL DEFAULT 'dog',
    "breed" TEXT,
    "ageLabel" TEXT,
    "birthDate" TIMESTAMP(3),
    "weightKg" DOUBLE PRECISION,
    "isNeutered" BOOLEAN,
    "isSociable" BOOLEAN,
    "foodNotes" TEXT,
    "healthNotes" TEXT,
    "behaviorNotes" TEXT,
    "vetName" TEXT,
    "vetPhone" TEXT,
    "deliveredItems" TEXT,
    "importRecordId" TEXT,
    "sourceFileName" TEXT,
    "sourceSheet" TEXT,
    "sourceRow" INTEGER,
    "sourceBlock" INTEGER,
    "sourcePayload" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Pet_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ServiceType" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "kind" "ServiceKind" NOT NULL,
    "description" TEXT,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ServiceType_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ServicePriceRule" (
    "id" TEXT NOT NULL,
    "serviceTypeId" TEXT NOT NULL,
    "label" TEXT NOT NULL,
    "paymentMethod" "PaymentMethod" NOT NULL,
    "firstPetCents" INTEGER NOT NULL,
    "additionalPetCents" INTEGER,
    "highSeasonFirstPetCents" INTEGER,
    "highSeasonAdditionalCents" INTEGER,
    "fixedFeeCents" INTEGER,
    "perKmCents" INTEGER,
    "hygieneFeeCents" INTEGER,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "importRecordId" TEXT,
    "sourceFileName" TEXT,
    "sourceSheet" TEXT,
    "sourceRow" INTEGER,
    "sourceBlock" INTEGER,
    "sourcePayload" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ServicePriceRule_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "SeasonPeriod" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "startsAt" TIMESTAMP(3) NOT NULL,
    "endsAt" TIMESTAMP(3) NOT NULL,
    "notes" TEXT,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "SeasonPeriod_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Reservation" (
    "id" TEXT NOT NULL,
    "tutorId" TEXT NOT NULL,
    "serviceTypeId" TEXT NOT NULL,
    "status" "ReservationStatus" NOT NULL DEFAULT 'REQUESTED',
    "paymentStatus" "PaymentStatus" NOT NULL DEFAULT 'PENDING',
    "pickupMode" "PickupMode" NOT NULL DEFAULT 'TUTOR_DROPS_OFF',
    "startsAt" TIMESTAMP(3) NOT NULL,
    "endsAt" TIMESTAMP(3) NOT NULL,
    "actualEndedAt" TIMESTAMP(3),
    "notes" TEXT,
    "privateNotes" TEXT,
    "inviteTutor" BOOLEAN NOT NULL DEFAULT false,
    "baseAmountCents" INTEGER NOT NULL DEFAULT 0,
    "discountCents" INTEGER NOT NULL DEFAULT 0,
    "additionalCents" INTEGER NOT NULL DEFAULT 0,
    "taxiPetCents" INTEGER NOT NULL DEFAULT 0,
    "lateFeeCents" INTEGER NOT NULL DEFAULT 0,
    "totalCents" INTEGER NOT NULL DEFAULT 0,
    "depositSuggestedCents" INTEGER NOT NULL DEFAULT 0,
    "depositDueCents" INTEGER NOT NULL DEFAULT 0,
    "balanceDueCents" INTEGER NOT NULL DEFAULT 0,
    "googleCalendarId" TEXT,
    "googleEventId" TEXT,
    "googleEventEtag" TEXT,
    "googleLastSyncedAt" TIMESTAMP(3),
    "syncConflict" BOOLEAN NOT NULL DEFAULT false,
    "syncConflictReason" TEXT,
    "importRecordId" TEXT,
    "sourceFileName" TEXT,
    "sourceSheet" TEXT,
    "sourceRow" INTEGER,
    "sourceBlock" INTEGER,
    "sourcePayload" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Reservation_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ReservationPet" (
    "id" TEXT NOT NULL,
    "reservationId" TEXT NOT NULL,
    "petId" TEXT NOT NULL,
    "priceRole" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ReservationPet_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Payment" (
    "id" TEXT NOT NULL,
    "reservationId" TEXT NOT NULL,
    "amountCents" INTEGER NOT NULL,
    "method" "PaymentMethod" NOT NULL,
    "status" "PaymentStatus" NOT NULL DEFAULT 'PAID',
    "paidAt" TIMESTAMP(3),
    "notes" TEXT,
    "importRecordId" TEXT,
    "sourceFileName" TEXT,
    "sourceSheet" TEXT,
    "sourceRow" INTEGER,
    "sourceBlock" INTEGER,
    "sourcePayload" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Payment_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "FinancialEntry" (
    "id" TEXT NOT NULL,
    "reservationId" TEXT,
    "kind" "FinancialEntryKind" NOT NULL,
    "category" TEXT NOT NULL,
    "description" TEXT,
    "entryDate" TIMESTAMP(3) NOT NULL,
    "amountCents" INTEGER NOT NULL,
    "method" "PaymentMethod",
    "isManual" BOOLEAN NOT NULL DEFAULT false,
    "importRecordId" TEXT,
    "sourceFileName" TEXT,
    "sourceSheet" TEXT,
    "sourceRow" INTEGER,
    "sourceBlock" INTEGER,
    "sourcePayload" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "FinancialEntry_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "FinancialSummary" (
    "id" TEXT NOT NULL,
    "kind" "FinancialSummaryKind" NOT NULL DEFAULT 'MONTHLY_CLOSING',
    "year" INTEGER NOT NULL,
    "month" INTEGER NOT NULL,
    "label" TEXT NOT NULL,
    "totalCents" INTEGER NOT NULL,
    "notes" TEXT,
    "importRecordId" TEXT,
    "sourceFileName" TEXT,
    "sourceSheet" TEXT,
    "sourceRow" INTEGER,
    "sourceBlock" INTEGER,
    "sourcePayload" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "FinancialSummary_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Task" (
    "id" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "description" TEXT,
    "taskDate" TIMESTAMP(3) NOT NULL,
    "status" "TaskStatus" NOT NULL DEFAULT 'PENDING',
    "source" "TaskSource" NOT NULL DEFAULT 'MANUAL',
    "reservationId" TEXT,
    "tutorId" TEXT,
    "petId" TEXT,
    "completedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Task_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "BusinessSettings" (
    "id" TEXT NOT NULL,
    "singletonKey" TEXT NOT NULL DEFAULT 'default',
    "businessName" TEXT NOT NULL DEFAULT 'Zeni Pets',
    "ownerName" TEXT NOT NULL DEFAULT 'Fernanda Zeni',
    "phone" TEXT,
    "instagram" TEXT,
    "address" TEXT,
    "boardingCapacity" INTEGER NOT NULL DEFAULT 10,
    "daycareCapacity" INTEGER NOT NULL DEFAULT 8,
    "defaultCheckInTime" TEXT NOT NULL DEFAULT '10:00',
    "defaultCheckOutTime" TEXT NOT NULL DEFAULT '18:00',
    "lateFeeOnePetCents" INTEGER NOT NULL DEFAULT 1000,
    "lateFeeManyPetsCents" INTEGER NOT NULL DEFAULT 1500,
    "depositPercent" INTEGER NOT NULL DEFAULT 50,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "BusinessSettings_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "GoogleCalendarConnection" (
    "id" TEXT NOT NULL,
    "providerAccountEmail" TEXT,
    "accessTokenCipher" TEXT,
    "refreshTokenCipher" TEXT,
    "scopes" TEXT,
    "googleCalendarId" TEXT,
    "googleSyncToken" TEXT,
    "googleChannelId" TEXT,
    "googleResourceId" TEXT,
    "googleChannelExpiresAt" TIMESTAMP(3),
    "connectedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "GoogleCalendarConnection_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ImportBatch" (
    "id" TEXT NOT NULL,
    "fileName" TEXT NOT NULL,
    "sourceKind" "ImportSourceKind" NOT NULL DEFAULT 'UNKNOWN',
    "status" "ImportBatchStatus" NOT NULL DEFAULT 'PENDING_REVIEW',
    "notes" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ImportBatch_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ImportRecord" (
    "id" TEXT NOT NULL,
    "batchId" TEXT NOT NULL,
    "sourceSheet" TEXT,
    "sourceRow" INTEGER,
    "sourceBlock" INTEGER,
    "rawPayload" JSONB NOT NULL,
    "normalizedPayload" JSONB,
    "detectedType" "ImportDetectedType" NOT NULL DEFAULT 'UNKNOWN',
    "confidence" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "status" "ImportRecordStatus" NOT NULL DEFAULT 'PENDING_REVIEW',
    "reviewNotes" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ImportRecord_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ImportConflict" (
    "id" TEXT NOT NULL,
    "batchId" TEXT,
    "sourceRecordId" TEXT,
    "type" "ImportConflictType" NOT NULL DEFAULT 'UNKNOWN',
    "status" "ImportConflictStatus" NOT NULL DEFAULT 'OPEN',
    "title" TEXT NOT NULL,
    "description" TEXT,
    "payload" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ImportConflict_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ImportResolution" (
    "id" TEXT NOT NULL,
    "batchId" TEXT,
    "conflictId" TEXT,
    "sourceRecordId" TEXT,
    "action" "ImportResolutionAction" NOT NULL,
    "targetModel" TEXT,
    "targetId" TEXT,
    "payload" JSONB,
    "notes" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ImportResolution_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "User_email_key" ON "User"("email");

-- CreateIndex
CREATE UNIQUE INDEX "ServicePriceRule_serviceTypeId_label_paymentMethod_key" ON "ServicePriceRule"("serviceTypeId", "label", "paymentMethod");

-- CreateIndex
CREATE UNIQUE INDEX "SeasonPeriod_name_startsAt_endsAt_key" ON "SeasonPeriod"("name", "startsAt", "endsAt");

-- CreateIndex
CREATE UNIQUE INDEX "ReservationPet_reservationId_petId_key" ON "ReservationPet"("reservationId", "petId");

-- CreateIndex
CREATE UNIQUE INDEX "FinancialSummary_kind_year_month_label_key" ON "FinancialSummary"("kind", "year", "month", "label");

-- CreateIndex
CREATE INDEX "Task_taskDate_status_idx" ON "Task"("taskDate", "status");

-- CreateIndex
CREATE UNIQUE INDEX "BusinessSettings_singletonKey_key" ON "BusinessSettings"("singletonKey");

-- CreateIndex
CREATE UNIQUE INDEX "ImportBatch_fileName_sourceKind_key" ON "ImportBatch"("fileName", "sourceKind");

-- CreateIndex
CREATE INDEX "ImportConflict_status_type_idx" ON "ImportConflict"("status", "type");

-- AddForeignKey
ALTER TABLE "Tutor" ADD CONSTRAINT "Tutor_importRecordId_fkey" FOREIGN KEY ("importRecordId") REFERENCES "ImportRecord"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Pet" ADD CONSTRAINT "Pet_tutorId_fkey" FOREIGN KEY ("tutorId") REFERENCES "Tutor"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Pet" ADD CONSTRAINT "Pet_importRecordId_fkey" FOREIGN KEY ("importRecordId") REFERENCES "ImportRecord"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ServicePriceRule" ADD CONSTRAINT "ServicePriceRule_serviceTypeId_fkey" FOREIGN KEY ("serviceTypeId") REFERENCES "ServiceType"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ServicePriceRule" ADD CONSTRAINT "ServicePriceRule_importRecordId_fkey" FOREIGN KEY ("importRecordId") REFERENCES "ImportRecord"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Reservation" ADD CONSTRAINT "Reservation_tutorId_fkey" FOREIGN KEY ("tutorId") REFERENCES "Tutor"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Reservation" ADD CONSTRAINT "Reservation_serviceTypeId_fkey" FOREIGN KEY ("serviceTypeId") REFERENCES "ServiceType"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Reservation" ADD CONSTRAINT "Reservation_importRecordId_fkey" FOREIGN KEY ("importRecordId") REFERENCES "ImportRecord"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ReservationPet" ADD CONSTRAINT "ReservationPet_reservationId_fkey" FOREIGN KEY ("reservationId") REFERENCES "Reservation"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ReservationPet" ADD CONSTRAINT "ReservationPet_petId_fkey" FOREIGN KEY ("petId") REFERENCES "Pet"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Payment" ADD CONSTRAINT "Payment_reservationId_fkey" FOREIGN KEY ("reservationId") REFERENCES "Reservation"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Payment" ADD CONSTRAINT "Payment_importRecordId_fkey" FOREIGN KEY ("importRecordId") REFERENCES "ImportRecord"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "FinancialEntry" ADD CONSTRAINT "FinancialEntry_reservationId_fkey" FOREIGN KEY ("reservationId") REFERENCES "Reservation"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "FinancialEntry" ADD CONSTRAINT "FinancialEntry_importRecordId_fkey" FOREIGN KEY ("importRecordId") REFERENCES "ImportRecord"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "FinancialSummary" ADD CONSTRAINT "FinancialSummary_importRecordId_fkey" FOREIGN KEY ("importRecordId") REFERENCES "ImportRecord"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Task" ADD CONSTRAINT "Task_reservationId_fkey" FOREIGN KEY ("reservationId") REFERENCES "Reservation"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Task" ADD CONSTRAINT "Task_tutorId_fkey" FOREIGN KEY ("tutorId") REFERENCES "Tutor"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Task" ADD CONSTRAINT "Task_petId_fkey" FOREIGN KEY ("petId") REFERENCES "Pet"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ImportRecord" ADD CONSTRAINT "ImportRecord_batchId_fkey" FOREIGN KEY ("batchId") REFERENCES "ImportBatch"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ImportConflict" ADD CONSTRAINT "ImportConflict_batchId_fkey" FOREIGN KEY ("batchId") REFERENCES "ImportBatch"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ImportConflict" ADD CONSTRAINT "ImportConflict_sourceRecordId_fkey" FOREIGN KEY ("sourceRecordId") REFERENCES "ImportRecord"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ImportResolution" ADD CONSTRAINT "ImportResolution_batchId_fkey" FOREIGN KEY ("batchId") REFERENCES "ImportBatch"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ImportResolution" ADD CONSTRAINT "ImportResolution_conflictId_fkey" FOREIGN KEY ("conflictId") REFERENCES "ImportConflict"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ImportResolution" ADD CONSTRAINT "ImportResolution_sourceRecordId_fkey" FOREIGN KEY ("sourceRecordId") REFERENCES "ImportRecord"("id") ON DELETE SET NULL ON UPDATE CASCADE;
