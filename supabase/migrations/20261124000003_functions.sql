-- =====================================================================
-- Funções, gatilhos, views e Realtime
-- =====================================================================

-- ---------------------------------------------------------------------
-- Fatura do cartão: mês de fechamento a que a compra pertence
--   compra no dia <= fechamento  -> fatura do mesmo mês
--   compra depois do fechamento  -> fatura do mês seguinte
-- ---------------------------------------------------------------------
create or replace function public.card_invoice_month(p_date date, p_closing int)
returns date language sql immutable as $$
  select case
    when extract(day from p_date)::int >
         least(p_closing, extract(day from (date_trunc('month', p_date) + interval '1 month - 1 day'))::int)
      then (date_trunc('month', p_date) + interval '1 month')::date
    else date_trunc('month', p_date)::date
  end;
$$;

create or replace function public.transactions_before_write()
returns trigger language plpgsql as $$
declare v_closing int;
begin
  if new.kind = 'normal' then
    if new.card_id is not null then
      select closing_day into v_closing from public.credit_cards where id = new.card_id;
      new.invoice_month := public.card_invoice_month(new.date, v_closing);
    else
      new.invoice_month := null;
    end if;
  end if;
  new.updated_at := now();
  return new;
end $$;

create trigger transactions_before_write
  before insert or update on public.transactions
  for each row execute function public.transactions_before_write();

-- ---------------------------------------------------------------------
-- Criar casa (admin + categorias padrão)
-- ---------------------------------------------------------------------
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
    (v_id, 'Mercado',       'expense', 'shopping-cart',   '#6F8F72'),
    (v_id, 'Transporte',    'expense', 'car',             '#C9A15B'),
    (v_id, 'Saúde',         'expense', 'heart-pulse',     '#B5675B'),
    (v_id, 'Lazer',         'expense', 'gamepad-2',       '#8C7AA8'),
    (v_id, 'Educação',      'expense', 'graduation-cap',  '#5E8A9A'),
    (v_id, 'Restaurantes',  'expense', 'utensils',        '#C7835E'),
    (v_id, 'Assinaturas',   'expense', 'tv',              '#9A7B6C'),
    (v_id, 'Outros',        'expense', 'ellipsis',        '#8E8580'),
    (v_id, 'Salário',       'income',  'briefcase',       '#6F8F72'),
    (v_id, 'Extra',         'income',  'sparkles',        '#C9A15B'),
    (v_id, 'Investimentos', 'income',  'trending-up',     '#5E8A9A'),
    (v_id, 'Outros',        'income',  'ellipsis',        '#8E8580');

  return v_id;
end $$;

-- ---------------------------------------------------------------------
-- Convites
-- ---------------------------------------------------------------------
-- convites pendentes para o e-mail do usuário logado
create or replace function public.my_invites()
returns table (code text, household_id uuid, household_name text, expires_at timestamptz)
language sql stable security definer set search_path = public as $$
  select i.code, i.household_id, h.name, i.expires_at
  from public.household_invites i
  join public.households h on h.id = i.household_id
  where i.status = 'pending'
    and i.expires_at > now()
    and i.email is not null
    and lower(i.email) = lower(auth.jwt() ->> 'email')
    and not public.is_member(i.household_id);
$$;

-- aceitar convite por código (convites sem e-mail podem ser usados por várias pessoas até expirar)
create or replace function public.accept_invite(p_code text)
returns uuid language plpgsql security definer set search_path = public as $$
declare v_inv public.household_invites;
begin
  if auth.uid() is null then
    raise exception 'Faça login para entrar na casa' using errcode = '42501';
  end if;

  select * into v_inv from public.household_invites
  where code = upper(trim(p_code)) and status = 'pending' and expires_at > now();

  if not found then
    raise exception 'Convite inválido ou expirado' using errcode = 'P0002';
  end if;

  if v_inv.email is not null and lower(v_inv.email) <> lower(auth.jwt() ->> 'email') then
    raise exception 'Este convite foi enviado para outro e-mail' using errcode = '42501';
  end if;

  insert into public.profiles (id) values (auth.uid()) on conflict (id) do nothing;

  insert into public.household_members (household_id, user_id, role)
  values (v_inv.household_id, auth.uid(), 'member')
  on conflict do nothing;

  if v_inv.email is not null then
    update public.household_invites set status = 'accepted' where id = v_inv.id;
  end if;

  return v_inv.household_id;
end $$;

-- ---------------------------------------------------------------------
-- Gerar lançamentos recorrentes (idempotente)
--   * gera do mês seguinte a last_generated até "p_months_ahead" meses à frente
--   * o índice único (recurring_id, mês) impede duplicatas
--   * p_household null = todas as casas (somente cron/service role)
-- ---------------------------------------------------------------------
create or replace function public.generate_recurring(p_household uuid default null, p_months_ahead int default 1)
returns integer language plpgsql security definer set search_path = public as $$
declare
  r        record;
  m        date;
  first_m  date;
  last_m   date;
  horizon  date;
  d        date;
  inserted int := 0;
  cnt      int;
begin
  -- usuários comuns só podem gerar para casas das quais são membros
  if auth.uid() is not null and (p_household is null or not public.is_member(p_household)) then
    raise exception 'Sem permissão para gerar recorrências' using errcode = '42501';
  end if;

  horizon := (date_trunc('month', current_date) + make_interval(months => greatest(p_months_ahead, 0)))::date;

  for r in
    select * from public.recurring_rules
    where active and (p_household is null or household_id = p_household)
    for update skip locked
  loop
    first_m := greatest(
      date_trunc('month', r.start_date)::date,
      coalesce((r.last_generated + interval '1 month')::date, date_trunc('month', r.start_date)::date)
    );
    last_m := least(horizon, coalesce(date_trunc('month', r.end_date)::date, horizon));

    m := first_m;
    while m <= last_m loop
      d := make_date(
        extract(year from m)::int,
        extract(month from m)::int,
        least(r.day_of_month, extract(day from (m + interval '1 month - 1 day'))::int)
      );
      if d >= r.start_date and (r.end_date is null or d <= r.end_date) then
        insert into public.transactions
          (household_id, user_id, type, amount, description, date, category_id, account_id, card_id, paid, recurring_id)
        values
          (r.household_id, r.created_by, r.type, r.amount, r.description, d, r.category_id, r.account_id, r.card_id, false, r.id)
        on conflict (recurring_id, (date_trunc('month', date::timestamp))) where recurring_id is not null
        do nothing;
        get diagnostics cnt = row_count;
        inserted := inserted + cnt;
      end if;
      m := (m + interval '1 month')::date;
    end loop;

    if last_m >= first_m then
      update public.recurring_rules set last_generated = last_m where id = r.id;
    end if;
  end loop;

  return inserted;
end $$;

-- ---------------------------------------------------------------------
-- Totais (views com security_invoker => respeitam o RLS do usuário)
-- ---------------------------------------------------------------------
create or replace view public.monthly_totals with (security_invoker = true) as
select
  household_id,
  date_trunc('month', date)::date as month,
  coalesce(sum(amount) filter (where type = 'income'), 0)  as income,
  coalesce(sum(amount) filter (where type = 'expense'), 0) as expense,
  coalesce(sum(amount) filter (where type = 'income'), 0)
    - coalesce(sum(amount) filter (where type = 'expense'), 0) as balance
from public.transactions
where kind = 'normal'
group by household_id, date_trunc('month', date);

create or replace view public.category_monthly_totals with (security_invoker = true) as
select
  t.household_id,
  date_trunc('month', t.date)::date as month,
  t.type,
  t.category_id,
  c.name  as category_name,
  c.color as category_color,
  sum(t.amount) as total,
  count(*)      as count
from public.transactions t
left join public.categories c on c.id = t.category_id
where t.kind = 'normal'
group by t.household_id, date_trunc('month', t.date), t.type, t.category_id, c.name, c.color;

create or replace function public.month_summary(p_household uuid, p_month date)
returns table (income numeric, expense numeric, balance numeric, pending numeric)
language sql stable security invoker set search_path = public as $$
  select
    coalesce(sum(amount) filter (where type = 'income'), 0),
    coalesce(sum(amount) filter (where type = 'expense'), 0),
    coalesce(sum(amount) filter (where type = 'income'), 0) - coalesce(sum(amount) filter (where type = 'expense'), 0),
    coalesce(sum(amount) filter (where type = 'expense' and not paid), 0)
  from public.transactions
  where household_id = p_household
    and kind = 'normal'
    and date >= date_trunc('month', p_month)::date
    and date <  (date_trunc('month', p_month) + interval '1 month')::date;
$$;

-- ---------------------------------------------------------------------
-- Permissões das funções
-- ---------------------------------------------------------------------
revoke execute on function public.create_household(text)        from public, anon;
revoke execute on function public.accept_invite(text)           from public, anon;
revoke execute on function public.my_invites()                  from public, anon;
revoke execute on function public.generate_recurring(uuid, int) from public, anon;
grant  execute on function public.create_household(text)        to authenticated;
grant  execute on function public.accept_invite(text)           to authenticated;
grant  execute on function public.my_invites()                  to authenticated;
grant  execute on function public.generate_recurring(uuid, int) to authenticated, service_role;

-- ---------------------------------------------------------------------
-- Realtime
-- ---------------------------------------------------------------------
alter table public.transactions      replica identity full;
alter table public.accounts          replica identity full;
alter table public.credit_cards      replica identity full;
alter table public.categories        replica identity full;
alter table public.budgets           replica identity full;
alter table public.recurring_rules   replica identity full;
alter table public.household_members replica identity full;

alter publication supabase_realtime add table
  public.transactions, public.accounts, public.credit_cards, public.categories,
  public.budgets, public.recurring_rules, public.household_members;
