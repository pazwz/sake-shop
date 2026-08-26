-- AlterTable
ALTER TABLE "public"."admin_users" ADD COLUMN     "username" TEXT;

-- CreateIndex
CREATE UNIQUE INDEX "admin_users_username_key" ON "public"."admin_users"("username");
