-- ★ Achado real (pedido direto do usuário — "então a api pra múltiplos
-- criadores você resolve né?", depois de esbarrar ao vivo no teto real da
-- HeyGen "limit of 1 verified avatar group slots"): o app inteiro usava 1
-- única `HEYGEN_API_KEY` global — nenhuma 2ª organização conseguiria
-- treinar um avatar próprio, sempre bateria no mesmo teto de 1 grupo por
-- conta. Modelo escolhido (o criador paga a Ayon direto, o custo da HeyGen
-- fica embutido no plano — nunca "traga sua própria chave"): a Ayon mantém
-- um POOL de contas HeyGen reais (cada uma com seu próprio teto de 1 avatar
-- group), e atribui 1 conta por organização que ativar o avatar, na hora.
-- Nunca automatizável via API da HeyGen (não existe "criar conta" — alguém
-- da Ayon cria a conta de verdade, recarrega a carteira, e insere a chave
-- aqui manualmente conforme a demanda cresce).
create table public.heygen_account_pool (
  id uuid primary key default gen_random_uuid(),
  api_key text not null,
  -- Nota interna livre pra identificar a conta (ex.: e-mail usado no cadastro) — nunca lida por código, só pra humano administrando o pool.
  label text,
  organization_id uuid references public.organizations(id),
  assigned_at timestamptz,
  created_at timestamptz not null default now(),
  constraint heygen_account_pool_organization_id_key unique (organization_id)
);

-- RLS ligado, sem NENHUMA policy — esta tabela guarda chaves de API reais,
-- nunca deve ser alcançável por `authenticated`/`anon` via PostgREST, só
-- pelo client de service role (que ignora RLS) ou pela função abaixo.
alter table public.heygen_account_pool enable row level security;

-- ★ Atômica (achado real já resolvido uma vez neste projeto — ver
-- `ensure_initial_provisioning`, 0014 — para o mesmo tipo de risco:
-- 2 organizações pedindo avatar ao mesmo tempo não podem receber a MESMA
-- conta do pool). `for update skip locked` pula qualquer linha já sendo
-- reivindicada por outra transação concorrente, nunca trava esperando.
create or replace function public.claim_heygen_account(p_organization_id uuid)
returns text
language plpgsql
security definer
set search_path = public
as $$
declare
  v_api_key text;
begin
  select api_key into v_api_key
  from public.heygen_account_pool
  where organization_id = p_organization_id;

  if v_api_key is not null then
    return v_api_key;
  end if;

  update public.heygen_account_pool
  set organization_id = p_organization_id, assigned_at = now()
  where id = (
    select id from public.heygen_account_pool
    where organization_id is null
    order by created_at
    for update skip locked
    limit 1
  )
  returning api_key into v_api_key;

  -- `null` quando o pool está sem conta disponível — o chamador
  -- (`resolveAvatarProvider`) decide o que fazer (nunca decidido aqui).
  return v_api_key;
end;
$$;

-- Nunca concedida a authenticated/anon — só service_role chama isto
-- (`createServiceRoleClient`, sempre server-side), a mesma cautela de nunca
-- deixar uma chave de API real alcançável, nem indiretamente, por um
-- usuário comum.
revoke all on function public.claim_heygen_account(uuid) from public;
