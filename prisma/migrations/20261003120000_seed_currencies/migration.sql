-- The app needs these rows: sign-up gives new users DKK, and saved flights
-- look their currency up by code. They used to be inserted by the
-- add_currency_table migration in the older api/src/db/migrations folder,
-- which the baseline migration replaced without carrying the rows over.
INSERT INTO "public"."currencies" ("code", "name", "symbol")
VALUES
    ('DKK', 'Danish Krone', 'kr'),
    ('EUR', 'Euro', 'EUR'),
    ('USD', 'US Dollar', '$'),
    ('GBP', 'British Pound', 'GBP')
ON CONFLICT ("code") DO NOTHING;
