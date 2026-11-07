-- Result email (Phase 4): the language the candidate applied in; existing applications are Vietnamese
ALTER TABLE "applications" ADD COLUMN "locale" VARCHAR(5) NOT NULL DEFAULT 'vi';
ALTER TABLE "applications" ADD CONSTRAINT "applications_locale_check" CHECK ("locale" IN ('vi', 'en'));
