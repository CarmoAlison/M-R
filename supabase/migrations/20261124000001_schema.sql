-- =====================================================================
-- Controle Financeiro Familiar — esquema principal
-- =====================================================================
create extension if not exists pgcrypto;

-- ---------------------------------------------------------------------
-- Perfis (1:1 com auth.users)
-- ---------------------------------------------------------------------
create table public.profiles (
  id          uuid primary key references auth.users (id) on delete cascade,
  name        text not null default '',
  avatar_url  text,
  created_at  timestamptz not null default now()
);

-- cria o perfil automaticamente no cadastro
create or replace function public.handle_new_user()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  insert into public.profiles (id, name)
  values (new.id, coalesce(new.raw_user_meta_data ->> 'name', split_part(new.email, '@', 1)))
  on conflict (id) do nothing;
  return new;
end $$;

create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

-- ---------------------------------------------------------------------
-- Casa (household) e membros
-- ---------------------------------------------------------------------
create table public.households (
  id          uuid primary key default gen_random_uuid(),
  name        text not null check (char_length(name) between 1 and 80),
  created_by  uuid not null references public.profiles (id),
  created_at  timestamptz not null default now()
);

create table public.household_members (
  household_id uuid not null references public.households (id) on delete cascade,
  user_id      uuid not null references public.profiles (id) on delete cascade,
  role         text not null default 'member' check (role in ('admin', 'member')),
  joined_at    timestamptz not null default now(),
  primary key (household_id, user_id)
);
create index household_members_user_idx on public.household_members (user_id);

create table public.household_invites (
  id           uuid primary key default gen_random_uuid(),
  household_id uuid not null references public.households (id) on delete cascade,
  code         text not null unique default upper(substr(md5(gen_random_uuid()::text), 1, 6)),
  email        text,
  status       text not null default 'pending' check (status in ('pending', 'accepted', 'revoked')),
  expires_at   timestamptz not null default now() + interval '7 days',
  created_by   uuid not null default auth.uid() references public.profiles (id),
  created_at   timestamptz not null default now()
);
create index household_invites_household_idx on public.household_invites (household_id);
create index household_invites_email_idx on public.household_invites (lower(email));

-- ---------------------------------------------------------------------
-- Contas, cartões, categorias
-- ---------------------------------------------------------------------
create table public.accounts (
  id              uuid primary key default gen_random_uuid(),
  household_id    uuid not null references public.households (id) on delete cascade,
  name            text not null,
  type            text not null default 'checking' check (type in ('checking', 'savings', 'wallet')),
  initial_balance numeric(12,2) not null default 0,
  color           text not null default '#A48374',
  created_at      timestamptz not null default now()
);
create index accounts_household_idx on public.accounts (household_id);

create table public.credit_cards (
  id                 uuid primary key default gen_random_uuid(),
  household_id       uuid not null references public.households (id) on delete cascade,
  name               text not null,
  credit_limit       numeric(12,2) not null default 0 check (credit_limit >= 0),
  closing_day        smallint not null check (closing_day between 1 and 31),
  due_day            smallint not null check (due_day between 1 and 31),
  payment_account_id uuid references public.accounts (id) on delete set null,
  color              text not null default '#7A6A62',
  created_at         timestamptz not null default now()
);
create index credit_cards_household_idx on public.credit_cards (household_id);

create table public.categories (
  id           uuid primary key default gen_random_uuid(),
  household_id uuid not null references public.households (id) on delete cascade,
  name         text not null,
  type         text not null check (type in ('income', 'expense')),
  icon         text not null default 'ellipsis',
  color        text not null default '#A48374',
  archived     boolean not null default false,
  created_at   timestamptz not null default now()
);
create index categories_household_idx on public.categories (household_id);

-- ---------------------------------------------------------------------
-- Regras recorrentes (fixos)
-- ---------------------------------------------------------------------
create table public.recurring_rules (
  id             uuid primary key default gen_random_uuid(),
  household_id   uuid not null references public.households (id) on delete cascade,
  created_by     uuid default auth.uid() references public.profiles (id) on delete set null,
  type           text not null check (type in ('income', 'expense')),
  amount         numeric(12,2) not null check (amount > 0),
  description    text not null default '',
  category_id    uuid references public.categories (id) on delete set null,
  account_id     uuid references public.accounts (id) on delete set null,
  card_id        uuid references public.credit_cards (id) on delete set null,
  day_of_month   smallint not null check (day_of_month between 1 and 31),
  active         boolean not null default true,
  start_date     date not null default current_date,
  end_date       date,
  last_generated date,            -- 1º dia do último mês já gerado
  created_at     timestamptz not null default now()
);
create index recurring_rules_household_idx on public.recurring_rules (household_id);

-- ---------------------------------------------------------------------
-- Lançamentos
-- ---------------------------------------------------------------------
create table public.transactions (
  id                   uuid primary key default gen_random_uuid(),
  household_id         uuid not null references public.households (id) on delete cascade,
  user_id              uuid default auth.uid() references public.profiles (id) on delete set null,
  type                 text not null check (type in ('income', 'expense')),
  -- 'invoice_payment' = pagamento de fatura (sai da conta, mas não conta como gasto de categoria)
  kind                 text not null default 'normal' check (kind in ('normal', 'invoice_payment')),
  amount               numeric(12,2) not null check (amount > 0),
  description          text not null default '',
  date                 date not null default current_date,
  category_id          uuid references public.categories (id) on delete set null,
  account_id           uuid references public.accounts (id) on delete restrict,
  card_id              uuid references public.credit_cards (id) on delete restrict,
  paid                 boolean not null default true,
  recurring_id         uuid references public.recurring_rules (id) on delete set null,
  installment_group_id uuid,
  installment_number   smallint,
  installment_total    smallint,
  invoice_month        date,      -- 1º dia do mês de fechamento da fatura (somente cartão)
  created_at           timestamptz not null default now(),
  updated_at           timestamptz not null default now(),
  constraint installment_ok check (
    (installment_group_id is null and installment_number is null and installment_total is null)
    or (installment_number between 1 and installment_total)
  )
);
create index transactions_household_date_idx on public.transactions (household_id, date);
create index transactions_card_invoice_idx on public.transactions (card_id, invoice_month) where card_id is not null;
create index transactions_installment_idx on public.transactions (installment_group_id) where installment_group_id is not null;
create index transactions_recurring_idx on public.transactions (recurring_id) where recurring_id is not null;
-- impede duplicar a mesma recorrência no mesmo mês
create unique index transactions_recurring_month_uidx
  on public.transactions (recurring_id, (date_trunc('month', date::timestamp)))
  where recurring_id is not null;

-- ---------------------------------------------------------------------
-- Metas (orçamento por categoria)
-- ---------------------------------------------------------------------
create table public.budgets (
  id            uuid primary key default gen_random_uuid(),
  household_id  uuid not null references public.households (id) on delete cascade,
  category_id   uuid not null references public.categories (id) on delete cascade,
  monthly_limit numeric(12,2) not null check (monthly_limit > 0),
  created_at    timestamptz not null default now(),
  unique (household_id, category_id)
);

-- ---------------------------------------------------------------------
-- Push
-- ---------------------------------------------------------------------
create table public.push_subscriptions (
  id           uuid primary key default gen_random_uuid(),
  user_id      uuid not null default auth.uid() references public.profiles (id) on delete cascade,
  household_id uuid references public.households (id) on delete cascade,
  endpoint     text not null unique,
  keys         jsonb not null,               -- { p256dh, auth }
  preferences  jsonb not null default
    '{"bills": true, "invoices": true, "budgets": true, "daily": false, "hour": 9}'::jsonb,
  timezone     text not null default 'America/Sao_Paulo',
  created_at   timestamptz not null default now()
);
create index push_subscriptions_user_idx on public.push_subscriptions (user_id);

-- evita enviar a mesma notificação duas vezes (usada só pela Edge Function)
create table public.notification_log (
  subscription_id uuid not null references public.push_subscriptions (id) on delete cascade,
  key             text not null,
  sent_at         timestamptz not null default now(),
  primary key (subscription_id, key)
);
