-- Missão 12 — achado durante a implementação: o portão de crédito ganha um
-- bypass de platform_admin (docs/architecture.md §15.5), mas o webhook de
-- conclusão do n8n (que chama recordConsumption para o pipeline assíncrono
-- de vídeo/foto) roda sem sessão de usuário nenhuma — não tinha como saber
-- quem disparou o pipeline para decidir o bypass. pipeline_runs nunca teve
-- uma coluna de autor (achado de auditoria original da Missão 9, nunca
-- endereçado até agora).
alter table public.pipeline_runs
  add column actor_user_id uuid references auth.users (id);
