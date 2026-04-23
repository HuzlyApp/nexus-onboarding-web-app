alter table if exists public.zoho_sign_requests
  add column if not exists onboarding_id text null,
  add column if not exists action_id text null,
  add column if not exists sign_url text null;

create index if not exists zoho_sign_requests_action_id_idx
  on public.zoho_sign_requests (action_id);

create index if not exists zoho_sign_requests_onboarding_id_idx
  on public.zoho_sign_requests (onboarding_id);
