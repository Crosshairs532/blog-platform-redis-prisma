-- DropIndex
DROP INDEX "User_username_idx";

-- CreateIndex
CREATE INDEX "User_email_idx" ON "User"("email");
