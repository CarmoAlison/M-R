-- =====================================================================
-- Row Level Security
-- =====================================================================

-- Funções auxiliares (security definer evita recursão de RLS em household_members)
create or replace function public.is_member(p_household uuid)
returns boolean language sql stable security definer set search_path = public as $$
  select exists (
    select 1 from public.household_members
    where household_id = p_household and user_id = auth.uid()
  );
$$;

create or replace function public.is_admin(p_household uuid)
returns boolean language sql stable security definer set search_path = public as $$
  select exists (
    select 1 from public.household_members
    where household_id = p_household and user_id = auth.uid() and role = 'admin'
  );
$$;

-- alguém que divide pelo menos uma casa comigo
create or replace function public.shares_household(p_user uuid)
returns boolean language sql stable security definer set search_path = public as $$
  select exists (
    select 1
    from public.household_members a
    join public.household_members b on b.household_id = a.household_id
    where a.user_id = auth.uid() and b.user_id = p_user
  );
$$;

alter table public.profiles            enable row level security;
alter table public.households          enable row level security;
alter table public.household_members   enable row level security;
alter table public.household_invites   enable row level security;
alter table public.accounts            enable row level security;
alter table public.credit_cards        enable row level security;
alter table public.categories          enable row level security;
alter table public.recurring_rules     enable row level security;
alter table public.transactions        enable row level security;
alter table public.budgets             enable row level security;
alter table public.push_subscriptions  enable row level security;
alter table public.notification_log    enable row level security; -- sem políticas: só service role

-- profiles ------------------------------------------------------------
create policy profiles_select on public.profiles for select
  using (id = auth.uid() or public.shares_household(id));
create policy profiles_update on public.profiles for update
  using (id = auth.uid()) with check (id = auth.uid());
create policy profiles_insert on public.profiles for insert
  with check (id = auth.uid());

-- households ----------------------------------------------------------
-- (criação via RPC create_household)
create policy households_select on public.households for select
  using (public.is_member(id));
create policy households_update on public.households for update
  using (public.is_admin(id)) with check (public.is_admin(id));
create policy households_delete on public.households for delete
  using (public.is_admin(id));

-- household_members ---------------------------------------------------
create policy members_select on public.household_members for select
  using (public.is_member(household_id));
create policy members_insert on public.household_members for insert
  with check (public.is_admin(household_id));
create policy members_update on public.household_members for update
  using (public.is_admin(household_id)) with check (public.is_admin(household_id));
-- admin remove qualquer um; membro pode sair da casa
create policy members_delete on public.household_members for delete
  using (public.is_admin(household_id) or user_id = auth.uid());

-- household_invites (somente admin) -----------------------------------
create policy invites_select on public.household_invites for select
  using (public.is_admin(household_id));
create policy invites_insert on public.household_invites for insert
  with check (public.is_admin(household_id));
create policy invites_update on public.household_invites for update
  using (public.is_admin(household_id)) with check (public.is_admin(household_id));
create policy invites_delete on public.household_invites for delete
  using (public.is_admin(household_id));

-- dados da casa: qualquer membro lê e edita ---------------------------
do $$
declare t text;
begin
  foreach t in array array['accounts', 'credit_cards', 'categories', 'recurring_rules', 'transactions', 'budgets']
  loop
    execute format('create policy %1$s_select on public.%1$s for select using (public.is_member(household_id))', t);
    execute format('create policy %1$s_insert on public.%1$s for insert with check (public.is_member(household_id))', t);
    execute format('create policy %1$s_update on public.%1$s for update using (public.is_member(household_id)) with check (public.is_member(household_id))', t);
    execute format('create policy %1$s_delete on public.%1$s for delete using (public.is_member(household_id))', t);
  end loop;
end $$;

-- push_subscriptions: cada um gerencia as suas ------------------------
create policy push_all on public.push_subscriptions for all
  using (user_id = auth.uid()) with check (user_id = auth.uid());
