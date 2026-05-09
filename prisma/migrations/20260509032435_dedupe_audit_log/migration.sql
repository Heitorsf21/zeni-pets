-- AlterTable
ALTER TABLE "Pet" ADD COLUMN     "mergedFromIds" TEXT[] DEFAULT ARRAY[]::TEXT[],
ADD COLUMN     "mergedSourcePayloads" JSONB;

-- AlterTable
ALTER TABLE "Tutor" ADD COLUMN     "mergedFromIds" TEXT[] DEFAULT ARRAY[]::TEXT[],
ADD COLUMN     "mergedSourcePayloads" JSONB;

-- CreateTable
CREATE TABLE "DedupeCandidate" (
    "id" TEXT NOT NULL,
    "type" TEXT NOT NULL,
    "groupKey" TEXT NOT NULL,
    "confidence" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "status" TEXT NOT NULL DEFAULT 'OPEN',
    "canonicalId" TEXT,
    "candidateIds" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "summary" JSONB NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "DedupeCandidate_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "DedupeAuditLog" (
    "id" TEXT NOT NULL,
    "type" TEXT NOT NULL,
    "canonicalId" TEXT NOT NULL,
    "mergedIds" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "performedBy" TEXT,
    "summary" JSONB NOT NULL,
    "performedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "DedupeAuditLog_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "DedupeCandidate_type_status_idx" ON "DedupeCandidate"("type", "status");

-- CreateIndex
CREATE INDEX "DedupeCandidate_groupKey_idx" ON "DedupeCandidate"("groupKey");

-- CreateIndex
CREATE INDEX "DedupeAuditLog_type_performedAt_idx" ON "DedupeAuditLog"("type", "performedAt");

-- CreateIndex
CREATE INDEX "DedupeAuditLog_canonicalId_idx" ON "DedupeAuditLog"("canonicalId");
