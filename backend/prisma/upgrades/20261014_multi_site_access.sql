-- Additive and repeatable. Existing primary sites and credentials are retained.
ALTER TABLE "User" ADD COLUMN IF NOT EXISTS "siteIds" TEXT[] NOT NULL DEFAULT ARRAY[]::TEXT[];
ALTER TABLE "User" ADD COLUMN IF NOT EXISTS "regionAccess" TEXT[] NOT NULL DEFAULT ARRAY[]::TEXT[];
ALTER TABLE "User" ADD COLUMN IF NOT EXISTS "allSites" BOOLEAN NOT NULL DEFAULT false;
UPDATE "User" SET "siteIds" = ARRAY["branchId"] WHERE "branchId" IS NOT NULL AND cardinality("siteIds") = 0 AND NOT "allSites";
UPDATE "User" u SET "regionAccess" = ARRAY[b.zone] FROM "Branch" b
WHERE u."branchId" = b.id AND u.role = 'BRANCH_MANAGER' AND cardinality(u."regionAccess") = 0;
