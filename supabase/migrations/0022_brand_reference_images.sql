-- ★ Achado real (pedido direto do usuário — "acho que no treino da IA era
-- bom anexar umas artes pra ele entender a identidade visual da empresa"):
-- validado real que o gerador de imagem (Gemini) respeita paleta/tom de uma
-- imagem de referência anexada junto do prompt de texto. `brand_media_assets`
-- ("Biblioteca de Média") segue documentada mas deliberadamente nunca
-- migrada (decisão repetida em 3 sprints anteriores) — em vez de reativá-la
-- inteira (categorização, múltiplos tipos, tela de biblioteca), esta coluna
-- cobre só o necessário: até N imagens de referência por marca, reaproveitando
-- o bucket `brand-media` já existente (mesma policy de RLS da logo, sem
-- migration de storage). Nullable/array vazio por padrão — marca sem
-- referência gera conteúdo normalmente, nunca bloqueia (mesmo espírito
-- adaptativo de `logo_storage_path` etc., migration 0019).
alter table public.brands
  add column reference_image_paths text[] not null default '{}'::text[];
