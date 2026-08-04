-- Seed local-only (Missão H2, CONVENTIONS.md §10) — roda automaticamente em
-- `supabase start`/`supabase db reset`, NUNCA em `supabase db push` (nunca
-- toca o projeto remoto).
--
-- Achado durante a implementação do H2: o projeto Supabase remoto concede
-- privilégios completos (select/insert/update/delete) em toda tabela de
-- `public` para anon/authenticated/service_role — configuração feita pela
-- própria plataforma hospedada ao provisionar o projeto, nunca parte de
-- nenhuma migration deste repositório. Um Postgres local puro, criado só a
-- partir das nossas migrations (que rodam como o role `postgres`, dono
-- diferente de `supabase_admin`), não replica esse default automaticamente
-- — a ACL padrão do CLI para objetos futuros do role `postgres` no schema
-- `public` concede só truncate/references/trigger/maintain, sem
-- select/insert/update/delete. Sem este grant, todo teste de RLS/
-- concorrência contra `supabase start` falha com "permission denied for
-- table X" mesmo usando a service_role key (que deveria ignorar RLS, mas
-- primeiro precisa do grant de tabela — RLS e GRANT são camadas
-- independentes no Postgres).
grant all on all tables in schema public to anon, authenticated, service_role;
grant all on all sequences in schema public to anon, authenticated, service_role;
grant all on all functions in schema public to anon, authenticated, service_role;

-- Cobre qualquer tabela/sequência/função de uma migration futura, mesma
-- lacuna do parágrafo acima, mas para objetos ainda não criados.
alter default privileges for role postgres in schema public
  grant all on tables to anon, authenticated, service_role;
alter default privileges for role postgres in schema public
  grant all on sequences to anon, authenticated, service_role;
alter default privileges for role postgres in schema public
  grant all on functions to anon, authenticated, service_role;
