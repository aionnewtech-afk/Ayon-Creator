-- ★ Achado real (pedido direto do usuário — "se eu usar um avatar ele
-- precisa ser a voz do clone e ele narrar todo o vídeo"): `defaultVoiceId`
-- já vinha de volta na criação do "digital twin" (HeyGen clona a voz junto
-- do treinamento do rosto) mas nunca era persistido — a narração completa
-- (ElevenLabs) e o avatar (HeyGen) usavam vozes de fornecedores diferentes,
-- nunca a mesma. Guarda o `voice_id` clonado pra reaproveitar como
-- narração da peça inteira sempre que uma cena vira avatar
-- (`video-pipeline-scene-edit.ts`).
alter table public.brands
  add column avatar_voice_id text;
