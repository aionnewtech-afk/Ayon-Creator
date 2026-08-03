-- Missão 6 — remove organizations.plan (Sprint 1, 0001_init.sql), duplicado
-- pela nova subscriptions.plan (0008_billing.sql), fonte única da verdade
-- para o plano de uma organização a partir de agora. Confirmado sem nenhum
-- uso em código antes de remover (nenhuma repository/Server Action lê ou
-- escreve organizations.plan) — não havia mecanismo de billing real até esta
-- missão, então a coluna nunca chegou a significar nada em produção.
alter table public.organizations drop column plan;
