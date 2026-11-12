-- Nullable, additive storage only. Existing names and identities remain untouched.
ALTER TABLE "users"
ADD COLUMN "first_name" VARCHAR(150),
ADD COLUMN "middle_name" VARCHAR(150),
ADD COLUMN "last_name" VARCHAR(150),
ADD COLUMN "suffix" VARCHAR(150);
