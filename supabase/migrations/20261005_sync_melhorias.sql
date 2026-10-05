-- =====================================================================
-- Pigo · Melhorias de sincronização (rodar uma vez no SQL Editor do Supabase)
-- Idempotente: pode ser executado novamente sem efeitos colaterais.
-- =====================================================================

-- 1. Horário oficial do servidor em toda gravação --------------------------
-- Evita que relógios diferentes entre computadores façam alterações se perderem.
create or replace function public.pigo_set_server_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at := now();
  return new;
end;
$$;

do $$
declare
  t text;
begin
  foreach t in array array[
    'categories', 'accounts', 'credit_cards', 'imported_statements',
    'transactions', 'goals', 'category_budgets', 'import_rules'
  ]
  loop
    if to_regclass('public.' || t) is not null then
      execute format('drop trigger if exists pigo_server_updated_at on public.%I', t);
      execute format(
        'create trigger pigo_server_updated_at before insert or update on public.%I
         for each row execute function public.pigo_set_server_updated_at()', t);
      execute format('create index if not exists %I on public.%I (user_id, updated_at)', t || '_user_updated_idx', t);
    end if;
  end loop;
end;
$$;

-- 2. Configurações sincronizadas entre computadores ------------------------
create table if not exists public.user_settings (
  user_id uuid primary key references auth.users (id) on delete cascade,
  data jsonb not null default '{}'::jsonb,
  updated_at timestamptz not null default now()
);

alter table public.user_settings enable row level security;

drop policy if exists "user_settings_owner" on public.user_settings;
create policy "user_settings_owner" on public.user_settings
  for all
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

-- 3. Arquivos originais dos extratos (OFX/CSV) -----------------------------
insert into storage.buckets (id, name, public)
values ('statements', 'statements', false)
on conflict (id) do nothing;

-- Cada usuário só acessa a própria pasta: statements/<user_id>/arquivo
drop policy if exists "statements_owner_select" on storage.objects;
create policy "statements_owner_select" on storage.objects
  for select using (bucket_id = 'statements' and (storage.foldername(name))[1] = auth.uid()::text);

drop policy if exists "statements_owner_insert" on storage.objects;
create policy "statements_owner_insert" on storage.objects
  for insert with check (bucket_id = 'statements' and (storage.foldername(name))[1] = auth.uid()::text);

drop policy if exists "statements_owner_update" on storage.objects;
create policy "statements_owner_update" on storage.objects
  for update using (bucket_id = 'statements' and (storage.foldername(name))[1] = auth.uid()::text);

drop policy if exists "statements_owner_delete" on storage.objects;
create policy "statements_owner_delete" on storage.objects
  for delete using (bucket_id = 'statements' and (storage.foldername(name))[1] = auth.uid()::text);
