-- Sprint de Hardening — fechamento pós-H1 (achado da auditoria pós-H1,
-- docs/hardening-plan.md).
--
-- Dois gaps confirmados por leitura direta do estado no Postgres remoto
-- (não exploráveis hoje, mas divergentes do que a migration 0014 promete):
--
-- 1. `revoke all ... from public` não remove o grant de EXECUTE que o
--    Supabase concede por padrão a `anon`/`authenticated`/`service_role` no
--    schema `public` — `anon` continuava com permissão de chamar a função.
-- 2. `if p_user_id != auth.uid()` retorna NULL (não TRUE) quando os dois
--    lados são NULL — uma chamada anônima com p_user_id = null não era
--    barrada por essa checagem (a chamada ainda falhava adiante, por
--    organization_members.user_id ser NOT NULL, mas o guard em si não se
--    comportava como o comentário da função promete).

create or replace function public.ensure_initial_provisioning(
  p_user_id uuid,
  p_organization_name text,
  p_base_slug text
)
returns table (already_provisioned boolean, organization_id uuid)
language plpgsql
security definer
set search_path = public
as $$
declare
  v_org_id uuid;
  v_slug text;
  v_attempt int := 0;
begin
  -- Só o próprio usuário autenticado pode provisionar a si mesmo. IS DISTINCT
  -- FROM (em vez de !=) garante que p_user_id/auth.uid() nulos também sejam
  -- barrados, em vez de a comparação resultar em NULL e não disparar o RAISE.
  if p_user_id is distinct from auth.uid() then
    raise exception 'não autorizado' using errcode = '42501';
  end if;

  perform pg_advisory_xact_lock(hashtext(p_user_id::text));

  select m.organization_id into v_org_id
  from public.organization_members m
  where m.user_id = p_user_id and m.deleted_at is null
  limit 1;

  if v_org_id is not null then
    return query select true, v_org_id;
    return;
  end if;

  v_slug := p_base_slug;
  loop
    begin
      insert into public.organizations (name, slug, created_by)
      values (p_organization_name, v_slug, p_user_id)
      returning id into v_org_id;
      exit;
    exception when unique_violation then
      v_attempt := v_attempt + 1;
      if v_attempt > 5 then
        raise exception 'não foi possível gerar um slug único para a organização após % tentativas', v_attempt;
      end if;
      v_slug := p_base_slug || '-' || substr(md5(random()::text), 1, 6);
    end;
  end loop;

  insert into public.organization_members (organization_id, user_id, role, created_by)
  values (v_org_id, p_user_id, 'owner', p_user_id);

  insert into public.brands (organization_id, name, created_by)
  values (v_org_id, p_organization_name, p_user_id);

  insert into public.user_profiles (user_id)
  values (p_user_id)
  on conflict (user_id) do nothing;

  insert into public.audit_logs (organization_id, actor_user_id, action, entity_type, entity_id)
  values (v_org_id, p_user_id, 'organization.provisioned', 'organization', v_org_id);

  return query select false, v_org_id;
end;
$$;

-- Explícito e completo desta vez: revoga de PUBLIC e de anon nomeadamente
-- (o grant default do Supabase para anon não é afetado por "from public"),
-- concede só a authenticated (chamada real, via sessão logada) e
-- service_role (scripts administrativos/manutenção).
revoke all on function public.ensure_initial_provisioning(uuid, text, text) from public;
revoke execute on function public.ensure_initial_provisioning(uuid, text, text) from anon;
grant execute on function public.ensure_initial_provisioning(uuid, text, text) to authenticated;
grant execute on function public.ensure_initial_provisioning(uuid, text, text) to service_role;
