/**
 * Contrato de capacidade `avatar` (architecture.md §5) — "digital twin" de
 * uma pessoa real treinado a partir de vídeo, usado como porta-voz da marca
 * (`production_mode = "ai_avatar"`, previsto desde o design original mas
 * nunca implementado até este achado real — pedido direto do usuário:
 * "iniciar o avatar do porta voz da empresa"). Ver heygen-avatar-provider.ts
 * para a implementação concreta.
 *
 * Fluxo real (validado contra a documentação atual do fornecedor antes de
 * implementar, nunca assumido): criar o avatar a partir de um vídeo já
 * treina a voz clonada junto (`defaultVoiceId`) → pedir consentimento (a
 * HeyGen exige prova de que a pessoa retratada autorizou o clone, bloqueia
 * geração até isso ser aprovado) → esperar a pessoa completar o
 * consentimento pela página hospedada pela HeyGen (fora do nosso controle,
 * pode levar até 24h) → esperar o treinamento do avatar terminar
 * (assíncrono, minutos) → só então gerar vídeos com ele. Cada etapa é um
 * método próprio (nunca um único `createAvatar` bloqueante) porque a espera
 * pelo consentimento humano pode ser bem mais longa que qualquer polling
 * síncrono razoável.
 */
export interface AvatarProvider {
  /**
   * ★ Achado real (visto ao vivo — vídeo real de 46.8MB, dentro do teto do
   * Supabase, ainda assim rejeitado pela HeyGen: "Maximum size for URL
   * inputs... is 32 MB. For larger files, upload via POST
   * /v3/assets/direct-uploads"): `createDigitalTwin` recebendo uma URL
   * pública nunca ia funcionar pra vídeo de treinamento real — a HeyGen
   * BAIXA a URL, com teto próprio de 32MB, bem menor que qualquer vídeo
   * de treinamento decente. O fluxo de asset (3 passos abaixo) existe
   * exatamente pra isso: upload direto dos bytes, sem esse teto.
   */
  createAssetUploadSlot(params: { filename: string; contentType: string; sizeBytes: number }): Promise<CreateAssetUploadSlotResult>;
  /** Confirma que o PUT direto pro `uploadUrl` (passo 2, feito pelo navegador — nunca pelo nosso servidor) terminou; libera o `assetId` pra uso em `createDigitalTwin`. */
  completeAssetUpload(assetId: string): Promise<void>;
  /**
   * Cria o avatar a partir de um asset já enviado (ver
   * `createAssetUploadSlot`/`completeAssetUpload`) — devolve o avatar (voz
   * já clonada) e o grupo (identidade), status inicial sempre
   * "processing"/"pending". ★ Achado real (pedido direto do usuário — "e eu
   * faço isso pelo heygen?", depois de troca de roupa por prompt falhar em
   * preservar identidade real): `groupId` opcional anexa este novo look a
   * um avatar_group JÁ EXISTENTE (em vez de criar uma nova identidade) —
   * único jeito real de dar "outro ângulo/roupa" com o rosto genuíno, sem
   * esbarrar no teto de "1 avatar group" da conta. Devolve `consentStatus`
   * do grupo pra chamador decidir se precisa pedir consentimento de novo
   * (documentado como atributo do GRUPO, não por look — um grupo já
   * consentido não deveria pedir de novo por look adicional).
   */
  createDigitalTwin(params: { name: string; assetId: string; groupId?: string }): Promise<CreateDigitalTwinResult>;
  /** Gera o link (válido ~24h) que a pessoa retratada usa pra gravar o consentimento pela webcam. */
  requestConsent(groupId: string): Promise<{ consentUrl: string }>;
  /** Status do consentimento do grupo (`consentStatus` — valor exato vem direto do fornecedor, nunca reinterpretado aqui). */
  getConsentStatus(groupId: string): Promise<{ consentStatus: string }>;
  /** Status do treinamento do avatar em si (rosto/expressões/movimento) — separado do consentimento, os dois precisam estar prontos antes de gerar vídeo. `defaultVoiceId` (achado real: presente na resposta) cobre marcas cujo avatar foi criado antes de `brands.avatar_voice_id` existir (migration 0027) — nunca a fonte principal, só um fallback. */
  getTrainingStatus(lookId: string): Promise<{ status: string; defaultVoiceId?: string | null }>;
  /** Lista de vozes disponíveis (inclui a clonada do próprio avatar, quando pronta) — pra UI escolher/confirmar qual usar na geração. */
  listVoices(): Promise<AvatarVoice[]>;
  /**
   * Gera um vídeo do avatar falando o roteiro — devolve só o id, geração é
   * assíncrona (ver `getVideoStatus`). ★ Achado real (pedido direto do
   * usuário — "não gostei do cenário e minha voz ficou com um sotaque
   * estranho"): `background` troca o cenário por trás do avatar (cor ou
   * imagem), independente do vídeo de treinamento original — confirmado na
   * documentação da HeyGen, nunca precisa retreinar o avatar pra isso.
   * `voiceLocale` dá uma dica de idioma/sotaque pra síntese de voz — este
   * produto é pt-BR único (achado real de `select-brand-voice.ts`), então o
   * chamador sempre passa `"pt-BR"` por padrão.
   *
   * ★ Achado real (pedido direto do usuário — "a voz clonada do HeyGen não é
   * parecida... inclua minha voz do ElevenLabs"): `audioUrl` substitui
   * `script`/`voiceId`/`voiceLocale` por completo — a HeyGen só faz o
   * lip-sync sobre um áudio já pronto (narração gerada pelo Voice Provider
   * de sempre, ElevenLabs), em vez de sintetizar a fala com a própria voz
   * clonada dela. Documentado (`audio_url`/`audio_asset_id`, mutuamente
   * exclusivo com `script`) — nunca os dois juntos.
   */
  generateAvatarVideo(params: {
    avatarId: string;
    script?: string;
    voiceId?: string;
    voiceLocale?: string;
    audioUrl?: string;
    aspectRatio?: string;
    background?: { type: "color"; value: string } | { type: "image"; url: string };
  }): Promise<{ videoId: string }>;
  /** Status/URL final do vídeo gerado. */
  getVideoStatus(videoId: string): Promise<{ status: string; videoUrl?: string; durationSeconds?: number }>;
  /**
   * ★ Achado real (pedido direto do usuário — "implementa a troca de roupa
   * também, nem que seja com um prompt"): a HeyGen gera um novo "look"
   * (foto) referenciando um avatar/look já existente — mantém o rosto real
   * (identidade), só muda roupa/estilo/pose conforme o prompt. Devolve
   * imediatamente com status "processing"; usa `getTrainingStatus` (mesmo
   * método de sempre, genérico a qualquer tipo de look) pra saber quando o
   * novo look está pronto pra uso em `generateAvatarVideo`.
   */
  createPromptLook(params: { name: string; prompt: string; avatarId: string; groupId: string; aspectRatio?: string }): Promise<{ lookId: string; status: string }>;
  /**
   * ★ Achado real (pedido direto do usuário — "no meu caso que tenho vários
   * avatar no HeyGen, ele liste todos"): lista TODOS os looks já existentes
   * no grupo, direto na HeyGen — nunca só os que o nosso app criou/rastreou
   * (`brand.avatar_looks`, bookkeeping próprio). Achado real: a resposta
   * mistura 2 origens bem diferentes na mesma lista — looks com `avatar_id`
   * (treinados de um vídeo real, rosto genuíno) e looks só com `id` (a
   * própria HeyGen gera variações automáticas a partir de 1 foto,
   * `business_type: "generated"/"uploaded"` — mesma categoria já confirmada
   * nesta sessão como NÃO confiável pra preservar identidade real, ver
   * `generateAvatarLookVariant`). `trained` distingue os dois — nunca
   * inferido de outro campo, só a presença de `avatar_id` no payload real.
   */
  listGroupLooks(groupId: string): Promise<AvatarGroupLook[]>;
  /**
   * ★ Achado real (pedido direto do usuário — "se eu usar um avatar ele
   * precisa ser a voz do clone e ele narrar todo o vídeo"): áudio comum
   * (sem vídeo/rosto nenhum) usando uma voz da conta, incluindo a clonada
   * do próprio avatar (`avatar_voice_id`) — confirmado real (`POST
   * /v3/voices/speech`, testado ao vivo). Usado pra narrar as cenas SEM
   * avatar visível com a MESMA voz das cenas COM avatar, nunca uma voz
   * genérica diferente no mesmo vídeo.
   */
  synthesizeSpeech(params: { voiceId: string; text: string }): Promise<{ audioUrl: string; durationSeconds: number }>;
}

export interface AvatarGroupLook {
  lookId: string;
  name: string;
  /** `true` = treinado de um vídeo real (rosto genuíno, seguro pra virar padrão). `false` = variação sintética gerada pela própria HeyGen a partir de 1 foto — nunca oferecido como opção de padrão na UI. */
  trained: boolean;
  previewImageUrl?: string;
}

export interface CreateDigitalTwinResult {
  lookId: string;
  groupId: string;
  defaultVoiceId: string | null;
  consentStatus: string;
}

export interface CreateAssetUploadSlotResult {
  assetId: string;
  /** URL S3 pré-assinada — o navegador faz o PUT direto aqui, nunca o nosso servidor (mesmo espírito do upload pro Supabase Storage). */
  uploadUrl: string;
  /** Headers exigidos pelo PUT (ex.: `Content-Type`) — repassados literalmente pelo navegador. */
  uploadHeaders: Record<string, string>;
}

export interface AvatarVoice {
  voiceId: string;
  name: string;
  gender?: string;
  language?: string;
}
