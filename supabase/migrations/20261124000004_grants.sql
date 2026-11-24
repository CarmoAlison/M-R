-- =====================================================================
-- Permissões de tabela para a API (PostgREST)
-- Projetos Supabase recentes não concedem acesso automático às tabelas
-- criadas por SQL. O RLS continua decidindo QUAIS linhas cada um vê.
-- =====================================================================
grant usage on schema public to anon, authenticated, service_role;

grant select, insert, update, delete on
  public.profiles,
  public.households,
  public.household_members,
  public.household_invites,
  public.accounts,
  public.credit_cards,
  public.categories,
  public.recurring_rules,
  public.transactions,
  public.budgets,
  public.push_subscriptions
to authenticated;

grant select on public.monthly_totals, public.category_monthly_totals to authenticated;

-- log de notificações: só a Edge Function (service role)
revoke all on public.notification_log from anon, authenticated;

grant all on all tables in schema public to service_role;
grant execute on function public.month_summary(uuid, date) to authenticated;
grant execute on function public.is_member(uuid), public.is_admin(uuid), public.shares_household(uuid) to authenticated;
