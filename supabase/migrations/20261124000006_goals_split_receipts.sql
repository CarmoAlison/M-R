-- =====================================================================
-- Objetivos (caixinhas), divisão entre membros, comprovantes e
-- paleta de categorias mais suave.
-- =====================================================================

-- ---------------------------------------------------------------------
-- Objetivos / caixinhas
-- ---------------------------------------------------------------------
create table public.goals (
  id            uuid primary key default gen_random_uuid(),
  household_id  uuid not null references public.households (id) on delete cascade,
  name          text not null check (char_length(name) between 1 and 60),
  target_amount numeric(12,2) not null check (target_amount > 0),
  target_date   date,
  icon          text not null default 'piggy-bank',
  color         text not null default '#A48374',
  archived      boolean not null default false,
  created_by    uuid default auth.uid() references public.profiles (id) on delete set null,
  created_at    timestamptz not null default now()
);
create index goals_household_idx on public.goals (household_id);

-- movimentações da caixinha: valor positivo = guardou, negativo = retirou
create table public.goal_entries (
  id           uuid primary key default gen_random_uuid(),
  household_id uuid not null references public.households (id) on delete cascade,
  goal_id      uuid not null references public.goals (id) on delete cascade,
  user_id      uuid default auth.uid() references public.profiles (id) on delete set null,
  amount       numeric(12,2) not null check (amount <> 0),
  date         date not null default current_date,
  note         text not null default '',
  created_at   timestamptz not null default now()
);
create index goal_entries_goal_idx on public.goal_entries (goal_id, date);
create index goal_entries_household_idx on public.goal_entries (household_id);

-- ---------------------------------------------------------------------
-- Divisão de gastos entre os membros
-- ---------------------------------------------------------------------
alter table public.transactions
  add column paid_by      uuid references public.profiles (id) on delete set null,
  add column shared       boolean not null default true,  -- dividido igualmente entre os membros
  add column receipt_path text;                            -- comprovante no bucket "receipts"

alter table public.transactions alter column paid_by set default auth.uid();
update public.transactions set paid_by = user_id where paid_by is null;

-- acertos: "from_user pagou to_user"
create table public.settlements (
  id           uuid primary key default gen_random_uuid(),
  household_id uuid not null references public.households (id) on delete cascade,
  from_user    uuid not null references public.profiles (id) on delete cascade,
  to_user      uuid not null references public.profiles (id) on delete cascade,
  amount       numeric(12,2) not null check (amount > 0),
  date         date not null default current_date,
  note         text not null default '',
  created_by   uuid default auth.uid() references public.profiles (id) on delete set null,
  created_at   timestamptz not null default now(),
  check (from_user <> to_user)
);
create index settlements_household_idx on public.settlements (household_id, date);

-- ---------------------------------------------------------------------
-- RLS + permissões + realtime das tabelas novas
-- ---------------------------------------------------------------------
alter table public.goals        enable row level security;
alter table public.goal_entries enable row level security;
alter table public.settlements  enable row level security;

do $$
declare t text;
begin
  foreach t in array array['goals', 'goal_entries', 'settlements']
  loop
    execute format('create policy %1$s_select on public.%1$s for select using (public.is_member(household_id))', t);
    execute format('create policy %1$s_insert on public.%1$s for insert with check (public.is_member(household_id))', t);
    execute format('create policy %1$s_update on public.%1$s for update using (public.is_member(household_id)) with check (public.is_member(household_id))', t);
    execute format('create policy %1$s_delete on public.%1$s for delete using (public.is_member(household_id))', t);
    execute format('grant select, insert, update, delete on public.%1$s to authenticated', t);
    execute format('grant all on public.%1$s to service_role', t);
    execute format('alter table public.%1$s replica identity full', t);
  end loop;
end $$;

alter publication supabase_realtime add table public.goals, public.goal_entries, public.settlements;

-- ---------------------------------------------------------------------
-- Comprovantes (bucket privado): receipts/<household_id>/<arquivo>
-- ---------------------------------------------------------------------
create or replace function public.is_member_folder(p_folder text)
returns boolean language plpgsql stable security definer set search_path = public as $$
begin
  return public.is_member(p_folder::uuid);
exception when others then
  return false;
end $$;
grant execute on function public.is_member_folder(text) to authenticated;

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('receipts', 'receipts', false, 5242880, array['image/jpeg', 'image/png', 'image/webp', 'application/pdf'])
on conflict (id) do update
  set public = false,
      file_size_limit = excluded.file_size_limit,
      allowed_mime_types = excluded.allowed_mime_types;

create policy receipts_select on storage.objects for select to authenticated
  using (bucket_id = 'receipts' and public.is_member_folder((storage.foldername(name))[1]));
create policy receipts_insert on storage.objects for insert to authenticated
  with check (bucket_id = 'receipts' and public.is_member_folder((storage.foldername(name))[1]));
create policy receipts_update on storage.objects for update to authenticated
  using (bucket_id = 'receipts' and public.is_member_folder((storage.foldername(name))[1]));
create policy receipts_delete on storage.objects for delete to authenticated
  using (bucket_id = 'receipts' and public.is_member_folder((storage.foldername(name))[1]));

-- ---------------------------------------------------------------------
-- Paleta de categorias mais suave (tons da marca)
-- ---------------------------------------------------------------------
update public.categories set color = case color
    when '#6F8F72' then '#7E8F6F'
    when '#C9A15B' then '#C29A5B'
    when '#8C7AA8' then '#8E7A8A'
    when '#5E8A9A' then '#6F8584'
    when '#C7835E' then '#C08A6B'
    when '#8E8580' then '#A39B92'
    else color end;

create or replace function public.create_household(p_name text)
returns uuid language plpgsql security definer set search_path = public as $$
declare v_id uuid;
begin
  if auth.uid() is null then
    raise exception 'Faça login para criar uma casa' using errcode = '42501';
  end if;

  insert into public.profiles (id) values (auth.uid()) on conflict (id) do nothing;

  insert into public.households (name, created_by) values (trim(p_name), auth.uid())
  returning id into v_id;

  insert into public.household_members (household_id, user_id, role)
  values (v_id, auth.uid(), 'admin');

  insert into public.categories (household_id, name, type, icon, color) values
    (v_id, 'Moradia',       'expense', 'house',           '#A48374'),
    (v_id, 'Mercado',       'expense', 'shopping-cart',   '#7E8F6F'),
    (v_id, 'Transporte',    'expense', 'car',             '#C29A5B'),
    (v_id, 'Saúde',         'expense', 'heart-pulse',     '#B5675B'),
    (v_id, 'Lazer',         'expense', 'gamepad-2',       '#8E7A8A'),
    (v_id, 'Educação',      'expense', 'graduation-cap',  '#6F8584'),
    (v_id, 'Restaurantes',  'expense', 'utensils',        '#C08A6B'),
    (v_id, 'Assinaturas',   'expense', 'tv',              '#9A7B6C'),
    (v_id, 'Outros',        'expense', 'ellipsis',        '#A39B92'),
    (v_id, 'Salário',       'income',  'briefcase',       '#7E8F6F'),
    (v_id, 'Extra',         'income',  'sparkles',        '#C29A5B'),
    (v_id, 'Investimentos', 'income',  'trending-up',     '#6F8584'),
    (v_id, 'Outros',        'income',  'ellipsis',        '#A39B92');

  return v_id;
end $$;
