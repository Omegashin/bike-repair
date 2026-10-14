-- AlterTable
ALTER TABLE "Ticket" ALTER COLUMN "problem" DROP NOT NULL;

-- CreateIndex
CREATE UNIQUE INDEX "Customer_phone_key" ON "Customer"("phone");

