-- AlterTable
ALTER TABLE "ReservationPet" ADD COLUMN     "baseAmountCents" INTEGER NOT NULL DEFAULT 0,
ADD COLUMN     "manualDailyCents" INTEGER,
ADD COLUMN     "manualTotalCents" INTEGER,
ADD COLUMN     "priceRuleId" TEXT,
ADD COLUMN     "pricingMode" TEXT,
ADD COLUMN     "serviceTypeId" TEXT;

-- CreateIndex
CREATE INDEX "ReservationPet_serviceTypeId_idx" ON "ReservationPet"("serviceTypeId");

-- CreateIndex
CREATE INDEX "ReservationPet_priceRuleId_idx" ON "ReservationPet"("priceRuleId");

-- AddForeignKey
ALTER TABLE "ReservationPet" ADD CONSTRAINT "ReservationPet_serviceTypeId_fkey" FOREIGN KEY ("serviceTypeId") REFERENCES "ServiceType"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ReservationPet" ADD CONSTRAINT "ReservationPet_priceRuleId_fkey" FOREIGN KEY ("priceRuleId") REFERENCES "ServicePriceRule"("id") ON DELETE SET NULL ON UPDATE CASCADE;
