-- Sprint de Hardening — Missão H1 (item 1.1, docs/hardening-plan.md).
-- ensureInitialProvisioning (Sprint 1) fazia 5 escritas separadas via
-- PostgREST, sem transação — checagem "check-then-act" sem lock. Duas
-- requisições quase simultâneas do mesmo usuário novo podiam criar 2
-- organizations/brands distintas, ambas com o usuário como owner
-- (reproduzido ao vivo na validação da Missão 4, CHANGELOG.md [0.4.0]).
--
-- Consolidado numa função Postgres única, atômica, com
-- pg_advisory_xact_lock por user_id (serializa concorrência só para o MESMO
-- usuário — não afeta outros usuários provisionando ao mesmo tempo) +
-- checagem dupla de membership após adquirir o lock.

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
  -- Só o próprio usuário autenticado pode provisionar a si mesmo — a função
  -- é SECURITY DEFINER e recebe p_user_id como argumento explícito (não lê
  -- auth.uid() diretamente na query), então sem esta checagem qualquer
  -- authenticated poderia provisionar em nome de um user_id arbitrário.
  if p_user_id != auth.uid() then
    raise exception 'não autorizado' using errcode = '42501';
  end if;

  -- Serializa chamadas concorrentes para o mesmo usuário; libera
  -- automaticamente ao fim da transação (xact_lock).
  perform pg_advisory_xact_lock(hashtext(p_user_id::text));

  -- Checagem dupla: outra transação pode ter terminado o provisionamento
  -- enquanto esta esperava o lock.
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

-- Só authenticated pode chamar — nunca anon (a função sempre assume um
-- usuário já autenticado; explícito em vez de depender do grant default do
-- Postgres para PUBLIC).
revoke all on function public.ensure_initial_provisioning(uuid, text, text) from public;
grant execute on function public.ensure_initial_provisioning(uuid, text, text) to authenticated;
