-- Enforce the global invariant that at most one parish is designated as Mother Parish.
CREATE UNIQUE INDEX "parishes_single_mother_parish_idx"
ON "parishes" ("is_mother_parish")
WHERE "is_mother_parish" = true;
