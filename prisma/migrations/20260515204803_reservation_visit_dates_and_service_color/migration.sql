-- AlterTable
ALTER TABLE "ServiceType" ADD COLUMN     "color" TEXT DEFAULT '#3f8e88';

-- CreateTable
CREATE TABLE "ReservationVisitDate" (
    "id" TEXT NOT NULL,
    "reservationId" TEXT NOT NULL,
    "date" DATE NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ReservationVisitDate_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "ReservationVisitDate_reservationId_idx" ON "ReservationVisitDate"("reservationId");

-- CreateIndex
CREATE INDEX "ReservationVisitDate_date_idx" ON "ReservationVisitDate"("date");

-- CreateIndex
CREATE UNIQUE INDEX "ReservationVisitDate_reservationId_date_key" ON "ReservationVisitDate"("reservationId", "date");

-- AddForeignKey
ALTER TABLE "ReservationVisitDate" ADD CONSTRAINT "ReservationVisitDate_reservationId_fkey" FOREIGN KEY ("reservationId") REFERENCES "Reservation"("id") ON DELETE CASCADE ON UPDATE CASCADE;
