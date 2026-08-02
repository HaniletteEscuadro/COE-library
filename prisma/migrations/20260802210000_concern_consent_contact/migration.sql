-- Consent, and a private reply address.
--
-- Both nullable, so existing rows stay valid without a backfill. A concern
-- raised before consent was asked for has `consentAt` NULL, which reads as
-- "not consented" — the honest answer, rather than a default timestamp that
-- would claim an agreement nobody made.
ALTER TABLE "Concern" ADD COLUMN "consentAt" DATETIME;
ALTER TABLE "Concern" ADD COLUMN "contactEmail" TEXT;
