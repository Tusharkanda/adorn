-- Lets a user describe/override the background/setting for a shoot instead
-- of always inheriting whatever's baked into the chosen model's base photo.
-- Nullable: when not set, generation.py keeps the base photo's background
-- unchanged (the original behavior).
alter table jobs add column if not exists environment text;
