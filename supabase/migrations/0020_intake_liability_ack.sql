alter table public.client_intakes
  add column if not exists liability_acknowledged boolean not null default false,
  add column if not exists liability_acknowledged_at timestamptz,
  add column if not exists liability_ack_version text;

update public.client_intakes
set liability_acknowledged = true
where liability_acknowledged is distinct from true;
