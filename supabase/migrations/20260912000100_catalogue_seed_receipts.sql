-- A seed identity is introduced once. Receipts deliberately have no coaster FK:
-- deleting or merging a catalogue entry must not allow a later seed to restore it.
create table private.catalogue_seed_receipts (
  coaster_id uuid primary key,
  applied_at timestamptz not null default now()
);
alter table private.catalogue_seed_receipts enable row level security;
revoke all on private.catalogue_seed_receipts from public, anon, authenticated;

-- Upgrade existing databases without undoing earlier administrative corrections.
-- Audit history includes identities that were deleted or merged before this migration.
insert into private.catalogue_seed_receipts(coaster_id)
select id from public.coasters
union
select coaster_id from private.catalogue_audit
union
select related_coaster_id from private.catalogue_audit where related_coaster_id is not null;
