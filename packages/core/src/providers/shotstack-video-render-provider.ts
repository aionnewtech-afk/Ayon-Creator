import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@ayon/types";
import type {
  ImageCompositionRequest,
  ImageCompositionResult,
  VideoBranding,
  VideoRenderProvider,
  VideoRenderRequest,
  VideoRenderResult,
} from "./video-render-provider";
import { logProviderCall } from "./log-provider-call";
import { fetchWithRetry } from "../shared/fetch-with-retry";
import { logger } from "../logger";

const SCRIM_BUCKET = "content-output";

/**
 * Adapter concreto do Video Render Provider (architecture.md §5, §3.5.1,
 * §14) para o Shotstack — Missão 9, Etapa 1 (vídeo) + Missão 11 (branding,
 * sem legenda, composição de imagem — arch. §14.4.1). Único arquivo do
 * monorepo que importa a API do Shotstack; trocar de fornecedor nunca exige
 * mudar quem chama `VideoRenderProvider`, só o resultado da resolução em
 * provider-gateway.ts.
 *
 * `host` é a base URL completa, incluindo o estágio (`SHOTSTACK_HOST`, ex.:
 * `https://api.shotstack.io/edit/stage` para sandbox, `.../edit/v1` para
 * produção) — nunca hardcoded aqui, para trocar de ambiente sem mudar código.
 */
export class ShotstackVideoRenderProvider implements VideoRenderProvider {
  private readonly host: string;

  constructor(
    private readonly providerKey: string,
    private readonly apiKey: string,
    host: string,
    /** ★ Missão 12 (architecture.md §15.7) — mesmo client de service role já usado para resolver este adapter; instrumentação real via `logProviderCall`, nunca bloqueia a chamada real se falhar. */
    private readonly serviceRoleDb?: SupabaseClient<Database>,
  ) {
    // Defensivo: aceita tanto a base documentada (`.../edit/stage`) quanto
    // uma variante com `/render` já incluído — nunca falha silenciosamente
    // duplicando o segmento na URL final.
    this.host = host.replace(/\/+$/, "").replace(/\/render$/, "");
  }

  async composeVideo(request: VideoRenderRequest): Promise<VideoRenderResult> {
    const timeline = buildVideoTimeline(request);

    const videoUrl = await this.submitAndPoll({
      timeline,
      // resolution "sd" + quality "medium" (★ achado real da validação da
      // Missão 11, task 15): um vídeo de 60s com cenas de água/cachoeira
      // ultrapassou o limite de tamanho de objeto do Storage do Supabase
      // (abaixo dos 50MB padrão do plano gratuito — o valor exato não é
      // exposto pela API). "hd" + quality "medium" sozinho não é confiável:
      // como cada tentativa reseleciona cenas (segmentScript busca de novo),
      // o mesmo par de parâmetros produziu ~41MB numa tentativa (sucesso) e
      // estourou o limite em outra (falha) — o tamanho final depende do
      // bitrate nativo dos clipes sorteados, não é determinístico. "sd" corta
      // a contagem de pixels em ~4x, dando folga suficiente para qualquer
      // combinação de cenas, em vez de depender de acertar um limite exato
      // que a API do Supabase não expõe.
      output: { format: "mp4", resolution: "sd", aspectRatio: request.aspectRatio, quality: "medium" },
    });

    return { videoUrl, providerKey: this.providerKey };
  }

  async composeImage(request: ImageCompositionRequest): Promise<ImageCompositionResult> {
    const branding = request.branding;
    const primaryColor = branding?.primaryColorHex ?? "#ffffff";
    const secondaryColor = branding?.secondaryColorHex ?? "#000000";

    // ★ Achado real (pedido direto do usuário — "essa peça não é digna de
    // agência", contraste ruim e CTA quase ilegível): usar `primaryColor`/
    // `secondaryColor` cru como cor de texto assumia que a paleta da marca
    // sempre teria contraste alto entre as duas cores — falso na prática
    // (paletas com tons próximos, ex. dourado sobre laranja, geram texto
    // quase invisível). `contrastTextColor` escolhe branco ou quase-preto
    // pela luminância real do fundo, garantindo leitura sempre — nunca mais
    // depende da paleta específica da marca ter as 2 cores "certas".
    const panelTextColor = contrastTextColor(secondaryColor);
    // ★ Mesmo achado, aplicado ao pill do CTA: `primaryColor` só vira o
    // fundo do pill quando já contrasta o bastante com o painel por trás
    // dele (`secondaryColor`) — do contrário o pill "some" dentro do
    // painel. Sem contraste suficiente, cai pro oposto de `panelTextColor`
    // (garantindo o maior contraste possível contra o painel).
    const pillColor =
      contrastRatio(primaryColor, secondaryColor) >= 1.8 ? primaryColor : panelTextColor === "#ffffff" ? "#111111" : "#ffffff";
    const pillTextColor = contrastTextColor(pillColor);

    // ★ Achado real (pedido direto do usuário — "o storie precisa ser uma
    // peça, não só a foto com texto por cima"): o layout anterior (1 caixa
    // arredondada flutuando no meio da foto + 1 pill de CTA solta embaixo)
    // não lia como design de verdade — comparado a uma peça de referência
    // real que o usuário anexou (bloco de cor cobrindo uma zona inteira do
    // frame, tipografia em hierarquia, não uma "etiqueta" sobreposta).
    // Redesenhado: 1 painel sólido cobrindo a faixa inferior do frame
    // inteira (não mais uma caixa flutuante no meio), headline+subheadline
    // no topo do painel, CTA na base do mesmo painel — a foto ocupa o
    // resto do frame por completo, sem nenhuma caixa por cima dela.
    const panelHeight = Math.round(request.height * IMAGE_PANEL_HEIGHT_RATIO);

    // ★ Achado real (pedido direto do usuário — "amador, simples demais...
    // ou ele cria a imagem e você inclui o texto"): quando o fundo já é a
    // peça inteira desenhada pelo Gemini (foto + painel gráfico —
    // `buildDesignedPanelSuffix`), sobrepor o painel sólido de sempre
    // (`renderPanel`) duplicaria o painel (o gerado por baixo do PNG
    // opaco, escondido) — pulamos o `renderPanel` neste caso, o texto vai
    // direto sobre o painel já desenhado na imagem.
    const [panelUrl, ctaScrimUrl] = await Promise.all([
      request.backgroundIncludesDesignedPanel ? Promise.resolve(null) : this.renderPanel(request.width, panelHeight, secondaryColor),
      this.renderScrim(IMAGE_CTA_BLOCK_WIDTH, IMAGE_CTA_BLOCK_HEIGHT, pillColor),
    ]);

    const timeline = buildImageTimeline(request, {
      panelUrl,
      panelHeight,
      ctaScrimUrl,
      panelTextColor,
      pillColor,
      pillTextColor,
      hasVisiblePanel: Boolean(panelUrl) || Boolean(request.backgroundIncludesDesignedPanel),
    });

    const imageUrl = await this.submitAndPoll({
      timeline,
      output: { format: "jpg", size: { width: request.width, height: request.height } },
    });

    return { imageUrl, providerKey: this.providerKey };
  }

  /**
   * ★ Achado real (pedido direto do usuário — peça de verdade, não uma
   * foto com caixa em cima): painel sólido cobrindo a largura inteira do
   * frame, cantos superiores arredondados (a base encosta na borda
   * inferior do frame, então só os 2 cantos de cima precisam de raio —
   * fica com cara de painel "subindo" do rodapé, não uma caixa flutuante).
   * Mesma técnica já validada real do `renderScrim` (PNG via `sharp`,
   * `fit: "none"`), path determinístico por tamanho+cor pra reaproveitar
   * entre renders.
   */
  private async renderPanel(width: number, height: number, colorHex: string): Promise<string | null> {
    if (!this.serviceRoleDb) return null;

    try {
      const colorKey = colorHex.replace("#", "").toLowerCase();
      const path = `_shared/scrims/panel-${width}x${height}-${colorKey}.png`;
      const radius = 32;

      // ★ Achado real (pedido direto do usuário — "não só a foto com texto
      // por cima", comparado a uma peça de referência com blocos de cor
      // sólidos de verdade): opacidade parcial (0.92, herdada do scrim
      // antigo) deixava a foto "vazar" por baixo do painel de um jeito que
      // ainda lia como efeito sobre a foto, não como bloco de design
      // sólido — opaco (sem `fill-opacity`) agora, a foto ocupa só a zona
      // acima do painel, nunca por baixo dele.
      //
      // ★ Achado real #2 (pedido direto do usuário — "essa peça não é digna
      // de agência"): painel 100% opaco desde o topo cria um corte reto
      // entre foto e painel, sem nenhuma transição — lê como 2 blocos
      // empilhados, não como 1 peça desenhada. Os primeiros `fadeHeight` px
      // do topo agora usam um gradiente (transparente → opaco) em vez de
      // opacidade fixa, costurando a foto ao painel; o resto do painel
      // continua 100% opaco (legibilidade do texto não é afetada, o
      // gradiente fica bem acima de onde o texto é posicionado).
      const fadeHeight = Math.min(140, Math.round(height * 0.18));
      const fadeStopPercent = (fadeHeight / height) * 100;
      const svg =
        `<svg width="${width}" height="${height}" xmlns="http://www.w3.org/2000/svg">` +
        `<defs><linearGradient id="panelFade" x1="0" y1="0" x2="0" y2="1">` +
        `<stop offset="0%" stop-color="${colorHex}" stop-opacity="0"/>` +
        `<stop offset="${fadeStopPercent}%" stop-color="${colorHex}" stop-opacity="1"/>` +
        `<stop offset="100%" stop-color="${colorHex}" stop-opacity="1"/>` +
        `</linearGradient></defs>` +
        `<path d="M0,${radius} Q0,0 ${radius},0 L${width - radius},0 Q${width},0 ${width},${radius} ` +
        `L${width},${height} L0,${height} Z" fill="url(#panelFade)"/>` +
        `</svg>`;

      const sharpModule = await import(/* webpackIgnore: true */ "sharp");
      const sharp = sharpModule.default;
      const png = await sharp(Buffer.from(svg)).png().toBuffer();

      const { error: uploadError } = await this.serviceRoleDb.storage
        .from(SCRIM_BUCKET)
        .upload(path, png, { contentType: "image/png", upsert: true });
      if (uploadError) throw uploadError;

      const { data: signed, error: signError } = await this.serviceRoleDb.storage.from(SCRIM_BUCKET).createSignedUrl(path, 3600);
      if (signError || !signed) throw signError ?? new Error("Falha ao criar signed URL para o painel.");

      return signed.signedUrl;
    } catch (error) {
      logger.warn("providers.shotstack.render_panel_failed", { reason: error instanceof Error ? error.message : String(error) });
      return null;
    }
  }

  /**
   * Gera (ou reaproveita — path determinístico por tamanho+cor, `upsert`)
   * um PNG de fundo translúcido com cantos arredondados para ficar atrás de
   * um bloco de texto. Retorna `null` sem `serviceRoleDb` (mesmo espírito
   * defensivo de `logProviderCall` — nunca bloqueia o render principal,
   * `buildImageTimeline` cai para o bloco sólido de sempre quando `null`).
   */
  private async renderScrim(width: number, height: number, colorHex: string): Promise<string | null> {
    if (!this.serviceRoleDb) return null;

    try {
      const colorKey = colorHex.replace("#", "").toLowerCase();
      const path = `_shared/scrims/${width}x${height}-${colorKey}.png`;

      // ★ Achado real (pedido direto do usuário — CTA "quase ilegível"):
      // opacidade parcial (0.65-0.85, pensada pra um scrim sobre foto)
      // reduzia ainda mais o contraste já fraco do texto do CTA — agora que
      // o pill sempre usa uma cor calculada pra contrastar com o painel
      // (`pillColor` em `composeImage`), opaco 100% garante esse contraste
      // não seja diluído por trás.
      const svg =
        `<svg width="${width}" height="${height}" xmlns="http://www.w3.org/2000/svg">` +
        `<rect x="0" y="0" width="${width}" height="${height}" rx="28" ry="28" fill="${colorHex}"/>` +
        `</svg>`;

      // ★ Achado real (build quebrado — "Module not found: Can't resolve
      // 'child_process'"): `sharp`/`detect-libc` são binding nativo, e o
      // barrel plano (`export *`, packages/core/src/index.ts) torna este
      // arquivo alcançável por QUALQUER client component que importe
      // `@ayon/core` (via provider-gateway.ts, também no barrel) — o
      // webpack do client tentava resolver `child_process` (Node puro,
      // inexistente no browser) mesmo sem nenhum client component chamar
      // `renderScrim`. Um `import("sharp")` dinâmico comum NÃO resolve isso
      // (validado real: o erro persistiu idêntico) — o webpack ainda
      // analisa estaticamente o especificador literal pra montar o chunk.
      // `webpackIgnore: true` faz o webpack pular esse import por completo
      // (nunca tenta resolver/empacotar), deixando um `import()` nativo
      // avaliado só em runtime — que só acontece aqui, em código
      // server-only (pipeline de foto/vídeo). Validado real: build do
      // client volta a funcionar com isso.
      const sharpModule = await import(/* webpackIgnore: true */ "sharp");
      const sharp = sharpModule.default;
      const png = await sharp(Buffer.from(svg)).png().toBuffer();

      const { error: uploadError } = await this.serviceRoleDb.storage
        .from(SCRIM_BUCKET)
        .upload(path, png, { contentType: "image/png", upsert: true });
      if (uploadError) throw uploadError;

      const { data: signed, error: signError } = await this.serviceRoleDb.storage.from(SCRIM_BUCKET).createSignedUrl(path, 3600);
      if (signError || !signed) throw signError ?? new Error("Falha ao criar signed URL para o scrim.");

      return signed.signedUrl;
    } catch (error) {
      logger.warn("providers.shotstack.render_scrim_failed", { reason: error instanceof Error ? error.message : String(error) });
      return null;
    }
  }

  /**
   * ★ Missão 12 (architecture.md §15.7) — 1 linha de log por ciclo completo
   * submit→poll→done (nunca 1 por poll individual, que rodaria a cada 3s por
   * até ~5min e afogaria a tabela em ruído sem valor de observabilidade —
   * o que importa é quanto tempo o render levou e se terminou bem).
   */
  private async submitAndPoll(body: Record<string, unknown>): Promise<string> {
    const startedAt = new Date();
    const endpoint = `${this.host}/render`;
    let errorMessage: string | undefined;
    let renderId: string | undefined;

    try {
      const submitResponse = await fetchWithRetry(endpoint, {
        method: "POST",
        headers: {
          "x-api-key": this.apiKey,
          "Content-Type": "application/json",
        },
        body: JSON.stringify(body),
      });

      if (!submitResponse.ok) {
        const errorBody = await submitResponse.text().catch(() => "");
        errorMessage = `Shotstack render (submit) falhou (${submitResponse.status}): ${errorBody}`;
        throw new Error(errorMessage);
      }

      const submitPayload = (await submitResponse.json()) as ShotstackEnvelope<{ id: string }>;
      renderId = submitPayload.response.id;
      return await this.pollUntilDone(renderId);
    } catch (error) {
      errorMessage ??= error instanceof Error ? error.message : String(error);
      throw error;
    } finally {
      if (this.serviceRoleDb) {
        await logProviderCall({
          serviceRoleDb: this.serviceRoleDb,
          providerKey: this.providerKey,
          capability: "video_render",
          endpoint,
          requestId: renderId,
          startedAt,
          finishedAt: new Date(),
          ok: !errorMessage,
          errorMessage,
        });
      }
    }
  }

  private async pollUntilDone(renderId: string): Promise<string> {
    for (let attempt = 0; attempt < MAX_POLL_ATTEMPTS; attempt++) {
      const statusResponse = await fetchWithRetry(`${this.host}/render/${renderId}`, {
        headers: { "x-api-key": this.apiKey },
      });

      if (!statusResponse.ok) {
        const errorBody = await statusResponse.text().catch(() => "");
        throw new Error(`Shotstack render (status) falhou (${statusResponse.status}): ${errorBody}`);
      }

      const statusPayload = (await statusResponse.json()) as ShotstackEnvelope<ShotstackRenderStatus>;
      const { status, url, error } = statusPayload.response;

      if (status === "done") {
        if (!url) throw new Error(`Shotstack render ${renderId} terminou "done" sem url.`);
        return url;
      }
      if (status === "failed") {
        throw new Error(`Shotstack render ${renderId} falhou: ${error ?? "motivo não informado"}`);
      }

      await sleep(POLL_INTERVAL_MS);
    }

    throw new Error(`Shotstack render ${renderId} não concluiu dentro do tempo limite de polling (${MAX_POLL_ATTEMPTS * POLL_INTERVAL_MS}ms).`);
  }
}

const POLL_INTERVAL_MS = 3000;
/** ~5 minutos de polling — suficiente para um vídeo curto (peça de campanha), nunca indefinido. */
const MAX_POLL_ATTEMPTS = 100;

/** Posição/tamanho discretos do clip de logo (arch. §14.1) — canto inferior direito, pequeno, com uma margem da borda. */
const LOGO_CLIP = { position: "bottomRight", offset: { x: -0.04, y: -0.04 }, scale: 0.12 };

interface ShotstackEnvelope<T> {
  success: boolean;
  message: string;
  response: T;
}

interface ShotstackRenderStatus {
  id: string;
  status: "queued" | "fetching" | "rendering" | "saving" | "done" | "failed";
  url: string | null;
  error?: string | null;
}

/** Fonte customizada (arch. §14.1) declarada 1x no nível da timeline — Shotstack não usa @font-face/webfont, só TTF pré-hospedado. */
function toFonts(branding: VideoBranding | undefined) {
  return branding?.fontUrl ? [{ src: branding.fontUrl }] : undefined;
}

/**
 * Clip de logo opcional (arch. §14.8, branding adaptativo) — layout nunca
 * reserva um espaço vazio: o clip simplesmente não existe quando não há
 * logo, em vez de um placeholder. ★ Achado real (pedido direto do usuário —
 * "deixar opcional que o vídeo tenha a logo ou não"): `includeLogo: false`
 * pula o clipe mesmo com `logoUrl` cadastrada — escolha por geração, nunca
 * um padrão novo da marca.
 */
function buildLogoClip(branding: VideoBranding | undefined, length: number) {
  if (!branding?.logoUrl || branding.includeLogo === false) return null;
  return {
    asset: { type: "image", src: branding.logoUrl },
    start: 0,
    length,
    ...LOGO_CLIP,
  };
}

/** Posição/tamanho/opacidade da marca d'água (pedido direto do usuário — "sutil e em algum dos cantos") — canto inferior ESQUERDO, discreto: nunca no mesmo canto do logo (bottomRight), pra nunca sobrepor os dois quando coexistirem. */
const WATERMARK_CLIP_STYLE = { position: "bottomLeft", offset: { x: 0.04, y: -0.04 } };

/**
 * ★ Achado real (pedido direto do usuário — "marca d'água com o insta ou
 * nome da empresa... sutil e em algum dos cantos do vídeo"): texto pequeno
 * e semitransparente (`opacity`), nunca um bloco sólido/painel atrás — a
 * sutileza pedida é o ponto, não uma peça gráfica chamativa. Sempre no
 * canto oposto ao logo, coexistem sem se sobrepor.
 */
function buildWatermarkClip(branding: VideoBranding | undefined, length: number) {
  const text = branding?.watermarkText?.trim();
  if (!text) return null;
  return {
    asset: {
      type: "text",
      text,
      width: 400,
      height: 60,
      font: buildTextFont(branding, { color: "#ffffff", size: 22, weight: 600 }),
      alignment: { horizontal: "left", vertical: "bottom" },
    },
    start: 0,
    length,
    opacity: 0.55,
    ...WATERMARK_CLIP_STYLE,
  };
}

/**
 * ★ Achado real (pedido direto do usuário — "as transições não tão legais...
 * falei do estilo mesmo, serem as mesmas"): pool de tipos de transição
 * documentados pelo Shotstack (`Transition.type`), variante "Fast" em todos
 * pra manter o ritmo de corte rápido já pedido antes ("estilo CapCut") —
 * `fade` sozinho o vídeo inteiro era o problema, nunca a duração dele.
 */
const TRANSITION_STYLE_ROTATION = ["fadeFast", "slideLeftFast", "zoom", "wipeRightFast", "slideUpFast", "wipeLeftFast"];

/**
 * Monta a timeline do Shotstack a partir do contrato de capacidade
 * (architecture.md §14.6) — 1 track de branding (logo, quando existir e
 * `includeLogo !== false`) + 1 track de marca d'água (texto, quando
 * `watermarkText` existir — pedido direto do usuário, "opção de logo ou não
 * / marca d'água sutil num canto") + 1 track de vídeo (cenas em sequência,
 * sem áudio próprio) + 1 soundtrack (narração). ★ Missão 11 — sem track de
 * legenda (removida, arch. §14.2).
 */
function buildVideoTimeline(request: VideoRenderRequest) {
  const totalLength = request.videoSources.reduce((sum, source) => sum + source.lengthSeconds, 0);
  const logoClip = buildLogoClip(request.branding, totalLength);
  const watermarkClip = buildWatermarkClip(request.branding, totalLength);

  const tracks = [
    ...(logoClip ? [{ clips: [logoClip] }] : []),
    ...(watermarkClip ? [{ clips: [watermarkClip] }] : []),
    {
      clips: request.videoSources.map((source, index) => {
        // ★ Achado real (pedido direto do usuário — "as transições não tão
        // legais... falei do estilo mesmo, serem as mesmas"): não era
        // velocidade (já corrigido pra `fadeFast` antes) — era todo corte
        // usar o MESMO tipo de transição (`fade`) do início ao fim do vídeo,
        // monótono. `TRANSITION_STYLE_ROTATION` alterna o tipo por cena
        // (índice % tamanho do pool) — mesmo espírito "cortes rápidos estilo
        // CapCut" de sempre, mas cada corte visualmente diferente do
        // anterior.
        const transitionType = TRANSITION_STYLE_ROTATION[index % TRANSITION_STYLE_ROTATION.length]!;

        return source.assetType === "image"
          ? {
              asset: { type: "image", src: source.url },
              start: source.startSeconds,
              length: source.lengthSeconds,
              fit: "cover",
              // ★ Ken Burns simples (Shotstack `Clip.effect`, valor documentado
              // oficialmente) — sem isso, uma imagem estática numa track de
              // vídeo fica parada na tela, destoando das cenas em vídeo real
              // ao redor.
              effect: "zoomIn",
              transition: { in: transitionType, out: transitionType },
            }
          : {
              asset: { type: "video", src: source.url, volume: 0, trim: source.trimSeconds ?? 0 },
              start: source.startSeconds,
              length: source.lengthSeconds,
              fit: "cover",
              transition: { in: transitionType, out: transitionType },
            };
      }),
    },
  ];

  return {
    soundtrack: { src: request.audioUrl, effect: "fadeOut" },
    background: "#000000",
    fonts: toFonts(request.branding),
    tracks,
  };
}

/**
 * Timeline de 1 frame (composição de imagem, arch. §14.4.1) — foto de fundo
 * + bloco de headline/subheadline + CTA + logo opcional, via asset `text`
 * (Shotstack `TitleAsset` está **deprecated** — achado real ao investigar a
 * API oficial: "Notice: The TitleAsset is deprecated, use the TextAsset
 * instead" —, e `TextAsset.width`/`height` de fato quebram linha sozinhos,
 * ao contrário do `title` antigo, que exigia quebra manual). Sem asset
 * `html` (descontinuado pelo Shotstack, nunca suportou imagem dentro do HTML).
 *
 * ★ Achado real (pedido direto do usuário — peça "genérica", "sem apelo
 * comercial"): um título sozinho, sobreposto cru na foto, nunca pareceu uma
 * peça publicitária de verdade. Redesenhado com 3 blocos, cada um opcional
 * (arch. §14.8, branding adaptativo — nunca reserva espaço vazio):
 * headline+subheadline combinados num único bloco central (mesma caixa,
 * nunca dois blocos posicionados independentemente — dois `text` clips com
 * offset fracionário calculado à mão colidiam de forma imprevisível) + CTA
 * como uma segunda caixa pequena, ancorada embaixo.
 *
 * ★ Achado real #2 (validado com render real, achado só depois de ir para
 * produção com conteúdo real mais longo que o texto de teste): **omitir
 * `height` não é "auto-ajustar com segurança"** — o bloco de texto cresce
 * para ocupar quase o frame inteiro em vez de abraçar o conteúdo, o oposto
 * do que a documentação sugere. `height` explícito (generoso, não exato) é
 * obrigatório em todo `text` asset — cortar texto longo demais é um risco
 * aceitável e raro; um bloco gigante cobrindo a foto inteira é sempre pior.
 */
/** ★ Fração da altura do frame reservada pro painel inferior — grande o bastante pra headline+subheadline+CTA caberem confortavelmente, sem cobrir a foto inteira. */
const IMAGE_PANEL_HEIGHT_RATIO = 0.42;
const IMAGE_PANEL_HORIZONTAL_PADDING = 60;
const IMAGE_CTA_BLOCK_WIDTH = 760;
const IMAGE_CTA_BLOCK_HEIGHT = 100;
const IMAGE_CTA_BOTTOM_PADDING = 60;
// ★ Achado real (pedido direto do usuário — "essa peça não é digna de
// agência", hierarquia fraca): headline e subheadline dividiam 1 único
// `text` asset com o mesmo tamanho/peso — sem diferença visual entre o que
// é a mensagem principal e o que é o apoio. Separados em 2 clips próprios
// (a API do Shotstack não faz formatação mista dentro de 1 asset de
// texto), empilhados de baixo pra cima a partir do CTA — headline maior e
// mais pesada, subheadline nitidamente menor/mais leve.
// ★ Achado real #2 (pedido direto do usuário — "precisa organizar mais o
// texto e o CTA"): `IMAGE_SUBHEADLINE_BLOCK_HEIGHT` original (260) era
// dimensionado pro pior caso (~4 linhas), mas a subheadline real (1 frase
// curta, por design do `visual_brief`/prompt) raramente passa de 2 linhas
// — como o alinhamento é "top", a sobra de altura do bloco virava um vão
// vazio entre a subheadline e o CTA, os 2 elementos pareciam soltos, sem
// relação visual. Blocos e gaps reduzidos para o texto real (ainda com
// folga pra 3 linhas sem cortar) — pilha muito mais coesa.
const IMAGE_SUBHEADLINE_BLOCK_HEIGHT = 130;
const IMAGE_SUBHEADLINE_GAP_ABOVE_CTA = 28;
const IMAGE_HEADLINE_BLOCK_HEIGHT = 190;
const IMAGE_HEADLINE_GAP_ABOVE_SUBHEADLINE = 14;

/** WCAG relative luminance (0=preto, 1=branco) — base pra decidir cor de texto/pill por contraste real, nunca assumindo que a paleta da marca já tem contraste alto. */
function relativeLuminance(hex: string): number {
  const clean = hex.replace("#", "");
  const normalized = clean.length === 3 ? clean.split("").map((c) => c + c).join("") : clean;
  const value = Number.parseInt(normalized, 16);
  const r = ((value >> 16) & 255) / 255;
  const g = ((value >> 8) & 255) / 255;
  const b = (value & 255) / 255;
  const channel = (c: number) => (c <= 0.03928 ? c / 12.92 : Math.pow((c + 0.055) / 1.055, 2.4));
  return 0.2126 * channel(r) + 0.7152 * channel(g) + 0.0722 * channel(b);
}

/** Sempre branco ou quase-preto — nunca um tom intermediário que dependeria de acertar a paleta certa. */
function contrastTextColor(bgHex: string): string {
  return relativeLuminance(bgHex) > 0.5 ? "#111111" : "#ffffff";
}

/** Razão de contraste WCAG entre 2 cores (1 = idêntico, 21 = preto/branco). */
function contrastRatio(hexA: string, hexB: string): number {
  const lA = relativeLuminance(hexA) + 0.05;
  const lB = relativeLuminance(hexB) + 0.05;
  return lA > lB ? lA / lB : lB / lA;
}

function buildTextFont(branding: VideoBranding | undefined, overrides: { color: string; size: number; weight: number }) {
  return {
    ...(branding?.fontFamily ? { family: branding.fontFamily } : {}),
    color: overrides.color,
    size: overrides.size,
    weight: overrides.weight,
    lineHeight: 1.15,
  };
}

function buildImageTimeline(
  request: ImageCompositionRequest,
  panel: {
    panelUrl: string | null;
    panelHeight: number;
    ctaScrimUrl: string | null;
    panelTextColor: string;
    pillColor: string;
    pillTextColor: string;
    /** ★ `true` também quando o painel já está desenhado dentro do `backgroundImageUrl` (Gemini) — `panelUrl` fica `null` nesse caso mas o texto ainda tem painel por trás, nunca deve cair no fallback de fundo sólido próprio. */
    hasVisiblePanel: boolean;
  },
) {
  const length = 1;
  const branding = request.branding;

  // ★ Achado real (pedido direto do usuário — "o storie precisa ser uma
  // peça, não só a foto com texto por cima"): offsets calculados em pixels
  // e convertidos pra fração da altura do frame — funciona igual pro
  // formato vertical (stories/thumbnail, 1080x1920) e pro quadrado
  // (carousel, 1080x1080) sem precisar de constantes por formato.
  //
  // ★ Achado real #3 (validado com render real): `position: "bottom" +
  // offset.y` ancora a BORDA INFERIOR do clip (não o centro, como a
  // primeira versão assumiu) — `offset.y` é a distância dessa borda até o
  // fundo do frame, e o clip se estende PRA CIMA a partir dali pela sua
  // própria `height`. Com a suposição errada (ancorar pelo centro), o
  // bloco de headline ficava alto demais e "vazava" pra cima do painel,
  // sem fundo nenhum atrás. Corrigido: a borda inferior do bloco de
  // headline fica logo acima da zona reservada pro CTA.
  //
  // ★ Achado real #4 (pedido direto do usuário — hierarquia fraca): headline
  // e subheadline agora são 2 clips empilhados de baixo pra cima a partir
  // do CTA — subheadline logo acima do CTA, headline acima da subheadline.
  const ctaOffsetY = IMAGE_CTA_BOTTOM_PADDING / request.height;
  const ctaTopEdgePx = IMAGE_CTA_BOTTOM_PADDING + IMAGE_CTA_BLOCK_HEIGHT;
  const subheadlineOffsetY = (ctaTopEdgePx + IMAGE_SUBHEADLINE_GAP_ABOVE_CTA) / request.height;
  const subheadlineTopEdgePx = ctaTopEdgePx + IMAGE_SUBHEADLINE_GAP_ABOVE_CTA + IMAGE_SUBHEADLINE_BLOCK_HEIGHT;
  const headlineOffsetY = (subheadlineTopEdgePx + IMAGE_HEADLINE_GAP_ABOVE_SUBHEADLINE) / request.height;

  const panelClip = panel.panelUrl
    ? {
        asset: { type: "image", src: panel.panelUrl },
        start: 0,
        length,
        position: "bottom",
        fit: "none",
      }
    : null;

  const headlineText = request.title?.trim() || null;
  // ★ Headline maior e mais pesada (48/800) — a mensagem principal precisa
  // dominar visualmente, nunca dividir o mesmo peso da subheadline.
  const headlineClip = headlineText
    ? {
        asset: {
          type: "text",
          text: headlineText,
          width: request.width - IMAGE_PANEL_HORIZONTAL_PADDING * 2,
          height: IMAGE_HEADLINE_BLOCK_HEIGHT,
          font: buildTextFont(branding, { color: panel.panelTextColor, size: 48, weight: 800 }),
          // ★ Achado real: com painel visível atrás (PNG do `renderPanel` OU
          // já desenhado no `backgroundImageUrl` pelo Gemini), o texto fica
          // sem fundo próprio — o painel já resolve legibilidade. Sem
          // nenhum painel visível, cai pro bloco sólido de sempre, nunca
          // texto sem contraste nenhum.
          ...(panel.hasVisiblePanel ? {} : { background: { color: panel.panelTextColor === "#ffffff" ? "#111111" : "#ffffff" } }),
          alignment: { horizontal: "center", vertical: "center" },
        },
        start: 0,
        length,
        position: "bottom",
        offset: { y: headlineOffsetY },
      }
    : null;

  const subheadlineText = request.subheadline?.trim() || null;
  // ★ Subheadline claramente secundária — menor e mais leve (28/400) que a
  // headline, mesma cor (sempre legível contra o painel via
  // `panelTextColor`), a diferenciação vem só de tamanho/peso.
  const subheadlineClip = subheadlineText
    ? {
        asset: {
          type: "text",
          text: subheadlineText,
          width: request.width - IMAGE_PANEL_HORIZONTAL_PADDING * 2,
          height: IMAGE_SUBHEADLINE_BLOCK_HEIGHT,
          font: buildTextFont(branding, { color: panel.panelTextColor, size: 28, weight: 400 }),
          ...(panel.hasVisiblePanel ? {} : { background: { color: panel.panelTextColor === "#ffffff" ? "#111111" : "#ffffff" } }),
          alignment: { horizontal: "center", vertical: "top" },
        },
        start: 0,
        length,
        position: "bottom",
        offset: { y: subheadlineOffsetY },
      }
    : null;

  const ctaClip = request.ctaText?.trim()
    ? {
        asset: {
          type: "text",
          text: request.ctaText.trim(),
          width: IMAGE_CTA_BLOCK_WIDTH,
          height: IMAGE_CTA_BLOCK_HEIGHT,
          font: buildTextFont(branding, { color: panel.pillTextColor, size: 26, weight: 700 }),
          ...(panel.ctaScrimUrl ? {} : { background: { color: panel.pillColor } }),
          alignment: { horizontal: "center", vertical: "center" },
        },
        start: 0,
        length,
        position: "bottom",
        offset: { y: ctaOffsetY },
      }
    : null;

  const ctaScrimClip = ctaClip && panel.ctaScrimUrl
    ? {
        asset: { type: "image", src: panel.ctaScrimUrl },
        start: 0,
        length,
        position: "bottom",
        offset: { y: ctaOffsetY },
        fit: "none",
      }
    : null;

  const logoClip = buildLogoClip(branding, length);

  const tracks = [
    ...(logoClip ? [{ clips: [logoClip] }] : []),
    ...(ctaClip ? [{ clips: [ctaClip] }] : []),
    ...(ctaScrimClip ? [{ clips: [ctaScrimClip] }] : []),
    ...(headlineClip ? [{ clips: [headlineClip] }] : []),
    ...(subheadlineClip ? [{ clips: [subheadlineClip] }] : []),
    ...(panelClip ? [{ clips: [panelClip] }] : []),
    {
      clips: [
        {
          asset: { type: "image", src: request.backgroundImageUrl },
          start: 0,
          length,
          fit: "cover",
        },
      ],
    },
  ];

  return {
    background: "#000000",
    fonts: toFonts(branding),
    tracks,
  };
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}
