create table if not exists public.terms_sections (
  id uuid primary key default gen_random_uuid(),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  sort_order integer not null default 0,
  title text not null,
  content text not null
);

create index if not exists terms_sections_sort_order_idx
  on public.terms_sections (sort_order, created_at);

insert into public.terms_sections (sort_order, title, content)
values
  (1, '1. Acceptance', 'By using Nexus MedPro Staffing, you agree to these Terms & Conditions.'),
  (2, '2. Eligibility', 'You must provide true details and valid work credentials.'),
  (3, '3. Account Use', 'Keep your login details safe. You are responsible for account activity.'),
  (4, '4. Resume Data', 'You allow us to parse resume details and use them for onboarding.'),
  (5, '5. Background Verification', 'Some roles may require document checks and credential verification.'),
  (6, '6. Communication', 'You agree to receive email/SMS updates for onboarding progress.'),
  (7, '7. Privacy', 'Your personal information is handled according to our privacy policy.'),
  (8, '8. Prohibited Conduct', 'Do not provide fake details or misuse the platform in any way.'),
  (9, '9. Liability', 'Nexus MedPro Staffing is not responsible for indirect or incidental damages.'),
  (10, '10. Governing Law', 'These Terms are governed by applicable local laws.')
on conflict do nothing;

alter table public.terms_sections enable row level security;

do $$
begin
  if not exists (
    select 1
    from pg_policies
    where schemaname = 'public'
      and tablename = 'terms_sections'
      and policyname = 'terms_sections_read'
  ) then
    create policy terms_sections_read
      on public.terms_sections
      for select
      to anon, authenticated
      using (true);
  end if;
end $$;
