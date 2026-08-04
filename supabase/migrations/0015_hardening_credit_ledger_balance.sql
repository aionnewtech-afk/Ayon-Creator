-- Sprint de Hardening — Missão H1 (item 1.2/5.4, docs/hardening-plan.md).
-- O portão de crédito (ensureSufficientCredits → operação → recordConsumption)
-- é check-then-act sem transação/lock: duas requisições concorrentes da
-- mesma organização, perto do limite de saldo, podiam ambas passar na
-- checagem otimista antes de qualquer uma debitar, permitindo gasto além do
-- saldo real.
--
-- Trigger before insert em credit_ledger vira a garantia real e atômica:
-- trava a linha da organização (serializa gravações concorrentes da MESMA
-- organização, sem afetar outras organizações) e recalcula o saldo antes de
-- aceitar a gravação. A checagem otimista em ensureSufficientCredits
-- continua existindo só para UX rápida (evita chamar a IA à toa quando o
-- saldo já está obviamente insuficiente) — este trigger é quem de fato
-- impede saldo negativo.

create or replace function public.enforce_credit_ledger_balance()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_balance integer;
begin
  -- Trava a linha da organização — serializa inserts concorrentes na MESMA
  -- organização (outras organizações não são afetadas).
  perform 1 from public.organizations where id = new.organization_id for update;

  select coalesce(sum(amount), 0) into v_balance
  from public.credit_ledger
  where organization_id = new.organization_id;

  if v_balance + new.amount < 0 then
    raise exception 'insufficient_credit_balance' using errcode = 'P0001';
  end if;

  return new;
end;
$$;

create trigger enforce_credit_ledger_balance_trigger
  before insert on public.credit_ledger
  for each row execute function public.enforce_credit_ledger_balance();
