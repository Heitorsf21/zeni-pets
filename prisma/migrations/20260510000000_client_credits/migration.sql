-- Add a dedicated client credit ledger. Credits are not operational revenue
-- until they are used to pay a reservation.
ALTER TYPE "PaymentMethod" ADD VALUE IF NOT EXISTS 'CREDIT';

CREATE TYPE "TutorCreditTransactionType" AS ENUM ('CREDIT_ADDED', 'CREDIT_USED', 'ADJUSTMENT', 'REFUND');

CREATE TABLE "TutorCreditTransaction" (
    "id" TEXT NOT NULL,
    "tutorId" TEXT NOT NULL,
    "reservationId" TEXT,
    "importRecordId" TEXT,
    "type" "TutorCreditTransactionType" NOT NULL,
    "amountCents" INTEGER NOT NULL,
    "description" TEXT,
    "entryDate" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "sourcePayload" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "TutorCreditTransaction_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "TutorCreditTransaction_tutorId_entryDate_idx" ON "TutorCreditTransaction"("tutorId", "entryDate");
CREATE INDEX "TutorCreditTransaction_reservationId_idx" ON "TutorCreditTransaction"("reservationId");
CREATE INDEX "TutorCreditTransaction_importRecordId_idx" ON "TutorCreditTransaction"("importRecordId");

ALTER TABLE "TutorCreditTransaction" ADD CONSTRAINT "TutorCreditTransaction_tutorId_fkey" FOREIGN KEY ("tutorId") REFERENCES "Tutor"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "TutorCreditTransaction" ADD CONSTRAINT "TutorCreditTransaction_reservationId_fkey" FOREIGN KEY ("reservationId") REFERENCES "Reservation"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "TutorCreditTransaction" ADD CONSTRAINT "TutorCreditTransaction_importRecordId_fkey" FOREIGN KEY ("importRecordId") REFERENCES "ImportRecord"("id") ON DELETE SET NULL ON UPDATE CASCADE;
