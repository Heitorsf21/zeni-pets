-- AlterTable
ALTER TABLE "Reservation" ADD COLUMN     "manualDailyCents" INTEGER,
ADD COLUMN     "manualTotalCents" INTEGER,
ADD COLUMN     "pricingMode" TEXT;
