-- Separate the business service from the pricing/payment rule used on a reservation.
ALTER TABLE "ServiceType" ADD COLUMN "slug" TEXT;

ALTER TABLE "Reservation"
  ADD COLUMN "priceRuleId" TEXT,
  ADD COLUMN "pricingPaymentMethod" "PaymentMethod";

ALTER TABLE "GoogleCalendarConnection"
  ADD COLUMN "googleChannelTokenCipher" TEXT;

CREATE UNIQUE INDEX "ServiceType_slug_key" ON "ServiceType"("slug");
CREATE INDEX "Reservation_priceRuleId_idx" ON "Reservation"("priceRuleId");

ALTER TABLE "Reservation"
  ADD CONSTRAINT "Reservation_priceRuleId_fkey"
  FOREIGN KEY ("priceRuleId")
  REFERENCES "ServicePriceRule"("id")
  ON DELETE SET NULL
  ON UPDATE CASCADE;
