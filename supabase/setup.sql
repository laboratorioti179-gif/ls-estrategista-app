-- Executar no SQL Editor do Supabase da LS Content AI.
create table if not exists public.ai_app_members (
 profile_key text not null,
 user_id uuid not null references auth.users(id) on delete cascade,
 primary key(profile_key,user_id)
);
create table if not exists public.ai_app_events (
 id uuid primary key default gen_random_uuid(),
 profile_key text not null,
 event_type text not null,
 message text not null default '',
 actions_json text not null default '[]',
 created_at timestamptz not null default now(),
 read_at timestamptz
);
create index if not exists ai_app_events_profile_created_idx on public.ai_app_events(profile_key,created_at desc);
alter table public.ai_app_members enable row level security;
alter table public.ai_app_events enable row level security;
create policy "read own membership" on public.ai_app_members for select to authenticated using (user_id = auth.uid());
create policy "read own app events" on public.ai_app_events for select to authenticated
 using (exists (select 1 from public.ai_app_members m where m.profile_key=ai_app_events.profile_key and m.user_id=auth.uid()));
create policy "mark own events read" on public.ai_app_events for update to authenticated
 using (exists (select 1 from public.ai_app_members m where m.profile_key=ai_app_events.profile_key and m.user_id=auth.uid()))
 with check (exists (select 1 from public.ai_app_members m where m.profile_key=ai_app_events.profile_key and m.user_id=auth.uid()));
-- Após criar o usuário na aplicação, associar a conta autenticada ao perfil:
-- insert into public.ai_app_members(profile_key,user_id) values ('jonathan_ceo_ls','UUID_DO_USUARIO');
-- Restrinja atualizações read_at por uma Edge Function se outros campos não puderem ser alterados pelo cliente.
