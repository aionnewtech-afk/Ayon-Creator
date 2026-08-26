/**
 * Contrato de capacidade `video_render` (architecture.md §5, ★ novo Missão
 * 9, revisado na Missão 11 arch. §14.2/§14.4/§14.6/§14.8) — nunca conhece
 * fornecedor de mídia/avatar/voz, só recebe as fontes já resolvidas pelo
 * Asset Engine (áudio de narração + cenas, ou foto + título) e devolve o
 * arquivo final. Ver shotstack-video-render-provider.ts para a
 * implementação (Missão 9, Etapa 1 + Missão 11).
 *
 * ★ Missão 11 — `VideoRenderCaptionCue`/`captionCues` removidos: o vídeo
 * não leva mais legenda embutida (arch. §14.2).
 */
export interface VideoRenderSceneSource {
  /** URL pública/assinada do clipe (Media Provider) — nunca base64. */
  url: string;
  startSeconds: number;
  lengthSeconds: number;
  /**
   * ★ Achado real (pedido direto do usuário — vídeo "desconexo", não
   * "acompanha o roteiro"): quando a busca de vídeo de banco (Pexels) não
   * acha nenhuma cena nova pro trecho, `video-pipeline-scenes.ts` repetia o
   * último clipe usado — o mesmo b-roll reaparecendo sem relação com a fala
   * atual é justamente o sintoma relatado. Fallback híbrido (só quando
   * `IMAGE_GENERATION_PROVIDER=gemini`): gera uma imagem sob medida pro
   * trecho em vez de repetir um clipe — `"image"` avisa
   * `shotstack-video-render-provider.ts` para montar um asset de imagem com
   * efeito Ken Burns (`effect: "zoomIn"`) em vez de vídeo. Ausente/`"video"`
   * preserva o comportamento anterior em qualquer cena vinda do Pexels.
   */
  /**
   * ★ Achado real (pedido direto do usuário — "incluir uma opção de
   * alternar com avatar" nas cenas do vídeo automático): `"avatar"` marca um
   * clipe real do avatar treinado da marca, falando o trecho exato daquele
   * momento — visualmente entra na composição pelo mesmo caminho de
   * `"video"` (Shotstack, `shotstack-video-render-provider.ts`, sem branch
   * própria: qualquer valor que não seja `"image"` já cai no clipe de vídeo
   * mudo), nunca precisou de um branch novo lá. Só existe pra UI de revisão
   * identificar/rotular a cena como avatar.
   */
  assetType?: "video" | "image" | "avatar";
  /**
   * ★ Achado real (pedido direto do usuário — "opção de excluir/substituir
   * uma cena individual do vídeo"): índice do trecho do roteiro
   * (`segments[]`, `video-pipeline-scenes.ts`) que originou esta cena —
   * várias cenas podem vir do mesmo trecho (`MAX_CLIP_SECONDS`, cortes
   * rápidos). Sem isso, trocar 1 cena por geração de IA não teria como
   * saber qual trecho da narração a nova cena precisa retratar.
   */
  segmentIndex?: number;
  /** ★ Achado real (pedido direto do usuário — "mostrar o prompt exato usado em cada peça gerada"): prompt de geração (Veo/Gemini image) ou termo de busca (Pexels) usado pra achar esta cena específica. */
  generationPrompt?: string;
}

/**
 * Identidade visual da marca (arch. §14.1), repassada pelo Asset Engine —
 * nunca lida diretamente de `brands` por este provider (desacoplamento de
 * sempre, §5.1). Todos os campos opcionais: sem logo cadastrado, o
 * comportamento é adaptativo (arch. §14.8), nunca um espaço vazio.
 */
export interface VideoBranding {
  logoUrl?: string | null;
  primaryColorHex?: string | null;
  secondaryColorHex?: string | null;
  /** URL pública de um arquivo TTF pré-hospedado (Shotstack não usa @font-face/webfont — arch. §14.1). */
  fontUrl?: string | null;
  /** Nome canônico da família (font-catalog.ts) — Shotstack precisa do nome exato embutido na fonte para os assets `text` usarem, a URL sozinha não basta. */
  fontFamily?: string | null;
  /** ★ Achado real (pedido direto do usuário — "deixar opcional que o vídeo tenha a logo ou não"): `false` pula o clipe de logo mesmo com `logoUrl` presente — ausente/`true` mantém o comportamento de sempre (logo sempre que cadastrada). Escolha por geração, nunca um padrão novo da marca. */
  includeLogo?: boolean;
  /**
   * ★ Achado real (pedido direto do usuário — "marca d'água com o insta ou
   * nome da empresa... sutil e em algum dos cantos"): texto curto (@handle
   * ou nome) sobreposto no vídeo inteiro, pequeno e semitransparente, num
   * canto — independente da logo (as duas podem coexistir). Ausente não
   * adiciona nada, nunca um padrão fixo.
   */
  watermarkText?: string | null;
}

export interface VideoRenderRequest {
  /** URL pública/assinada do áudio de narração já persistido em Storage. */
  audioUrl: string;
  videoSources: VideoRenderSceneSource[];
  aspectRatio: "9:16";
  branding?: VideoBranding;
}

export interface VideoRenderResult {
  videoUrl: string;
  providerKey: string;
}

/**
 * ★ novo (Missão 11, arch. §14.4.1) — composição de imagem estática
 * (stories/carousel/thumbnail), mesmo fornecedor do vídeo, timeline em
 * camadas em vez de asset `html`.
 *
 * ★ Achado real (pedido direto do usuário — peça "genérica", "sem apelo
 * comercial"): um título sozinho não faz uma peça parecer publicitária.
 * `subheadline`/`ctaText` viraram campos próprios (não concatenados no
 * `title`) para cada um virar seu próprio bloco de texto na composição —
 * ver `buildImageTimeline` (shotstack-video-render-provider.ts). Todos
 * opcionais, mesmo espírito adaptativo de sempre: campo ausente não deixa
 * espaço vazio, o bloco correspondente simplesmente não existe.
 */
export interface ImageCompositionRequest {
  /** URL do banco de fotos (Pexels) usada como fundo. */
  backgroundImageUrl: string;
  /** Título curto/headline — quando ausente, a peça não leva bloco de headline. */
  title?: string | null;
  /** Linha de apoio (1 frase, apelo comercial/emocional específico do tema). */
  subheadline?: string | null;
  /** Chamada para ação curta (ex.: "Fale com a gente no WhatsApp"). */
  ctaText?: string | null;
  branding?: VideoBranding;
  width: number;
  height: number;
  /**
   * ★ Achado real (pedido direto do usuário — "amador, simples demais...
   * ou ele cria a imagem e você inclui o texto"): quando `true`,
   * `backgroundImageUrl` já contém a peça inteira desenhada pelo gerador de
   * imagem (foto + painel gráfico, ver `buildDesignedPanelSuffix` em
   * `derive-image-generation-prompt.ts`) — `composeImage` pula o painel
   * sólido de sempre (`renderPanel`), só sobrepõe o texto. `false`/ausente
   * (fotos de banco, Pexels) mantém o painel sólido gerado por
   * `renderPanel` como sempre — nunca texto sem fundo nenhum atrás.
   */
  backgroundIncludesDesignedPanel?: boolean;
}

export interface ImageCompositionResult {
  imageUrl: string;
  providerKey: string;
}

export interface VideoRenderProvider {
  composeVideo(request: VideoRenderRequest): Promise<VideoRenderResult>;
  composeImage(request: ImageCompositionRequest): Promise<ImageCompositionResult>;
}
