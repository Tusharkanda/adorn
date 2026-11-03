-- Jobs record which occasion/look of the chosen model was used, so a model
-- can offer multiple styled looks (bridal, festive, daily, ...) without
-- needing a separate model_library row per look. Nullable: existing models
-- that only have a single flat (non-occasion) image set don't set this.
alter table jobs add column if not exists occasion text;
