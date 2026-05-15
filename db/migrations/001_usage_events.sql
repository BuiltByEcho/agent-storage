create table if not exists vaultline_usage_events (
  event_id uuid primary key,
  timestamp timestamptz not null,
  method text not null,
  path text not null,
  endpoint text not null,
  status_code integer not null,
  duration_ms integer not null,
  user_id text not null,
  user_kind text not null,
  auth_wallet text,
  api_key_hash text,
  payment_header_hash text,
  payment_response_hash text,
  payment_status text not null,
  payer text,
  payment_network text,
  payment_transaction text,
  operation text,
  resource_key text,
  tier text,
  request_bytes bigint not null default 0,
  response_bytes bigint not null default 0,
  storage_bytes_added bigint not null default 0,
  storage_bytes_deleted bigint not null default 0,
  storage_bytes_delta bigint not null default 0,
  storage_bytes_total_after bigint,
  billable_amount numeric(18, 6) not null default 0,
  revenue_usd numeric(18, 6) not null default 0,
  user_agent text,
  ip_hash text,
  raw_event jsonb not null
);

create index if not exists vaultline_usage_events_timestamp_idx on vaultline_usage_events (timestamp desc);
create index if not exists vaultline_usage_events_user_id_idx on vaultline_usage_events (user_id);
create index if not exists vaultline_usage_events_endpoint_idx on vaultline_usage_events (endpoint);
create index if not exists vaultline_usage_events_payment_status_idx on vaultline_usage_events (payment_status);
