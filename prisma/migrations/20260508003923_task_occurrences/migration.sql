-- AlterTable
ALTER TABLE "Task" ADD COLUMN     "endsAt" TIMESTAMP(3);

-- CreateTable
CREATE TABLE "TaskOccurrence" (
    "id" TEXT NOT NULL,
    "taskId" TEXT NOT NULL,
    "occurrenceDate" TIMESTAMP(3) NOT NULL,
    "status" "TaskStatus" NOT NULL DEFAULT 'PENDING',
    "completedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "TaskOccurrence_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "TaskOccurrence_occurrenceDate_status_idx" ON "TaskOccurrence"("occurrenceDate", "status");

-- CreateIndex
CREATE UNIQUE INDEX "TaskOccurrence_taskId_occurrenceDate_key" ON "TaskOccurrence"("taskId", "occurrenceDate");

-- AddForeignKey
ALTER TABLE "TaskOccurrence" ADD CONSTRAINT "TaskOccurrence_taskId_fkey" FOREIGN KEY ("taskId") REFERENCES "Task"("id") ON DELETE CASCADE ON UPDATE CASCADE;
