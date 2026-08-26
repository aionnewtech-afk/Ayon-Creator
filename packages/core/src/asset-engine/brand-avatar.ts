import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@ayon/types";
import type { AvatarGroupLook, CreateAssetUploadSlotResult } from "../providers/avatar-provider";
import { resolveAvatarProvider } from "../providers/provider-gateway";
import { BrandRepository } from "../repositories/brand.repository";

export class AvatarProviderUnavailableError extends Error {
  constructor() {
    super("Geração de avatar não está habilitada — configure HEYGEN_API_KEY.");
    this.name = "AvatarProviderUnavailableError";
  }
}

/**
 * ★ Achado real (visto ao vivo — vídeo real de 46.8MB rejeitado pela HeyGen:
 * "Maximum size for URL inputs... is 32 MB"): pedir um slot de upload S3
 * pré-assinado direto na HeyGen — o navegador faz o PUT dos bytes ali
 * (`avatar-section.tsx`), nunca passa pelo nosso servidor nem pelo Supabase
 * Storage (2 limites a menos pra esbarrar).
 */
export async function createBrandAvatarUploadSlot(params: {
  serviceRoleDb: SupabaseClient<Database>;
  organizationId: string;
  filename: string;
  contentType: string;
  sizeBytes: number;
}): Promise<CreateAssetUploadSlotResult> {
  const avatarProvider = await resolveAvatarProvider(params.serviceRoleDb, params.organizationId);
  if (!avatarProvider) throw new AvatarProviderUnavailableError();

  return avatarProvider.createAssetUploadSlot({
    filename: params.filename,
    contentType: params.contentType,
    sizeBytes: params.sizeBytes,
  });
}

export interface CreateBrandAvatarParams {
  db: SupabaseClient<Database>;
  serviceRoleDb: SupabaseClient<Database>;
  organizationId: string;
  brandId: string;
  name: string;
  /** `assetId` do slot criado por `createBrandAvatarUploadSlot` — o navegador já terminou o PUT dos bytes antes de chamar isto. */
  assetId: string;
}

/**
 * ★ Achado real (pedido direto do usuário — "iniciar o avatar do porta voz
 * da empresa"): confirma o upload do asset, cria o "digital twin" (voz
 * clonada junto, achado real da documentação da HeyGen) e já pede o link de
 * consentimento na mesma chamada — a pessoa retratada precisa dele o quanto
 * antes, não faz sentido a UI exigir um passo extra só pra revelar um link
 * que já existe assim que o `group_id` é criado.
 */
export async function createBrandAvatar(params: CreateBrandAvatarParams): Promise<{ consentUrl: string }> {
  const avatarProvider = await resolveAvatarProvider(params.serviceRoleDb, params.organizationId);
  if (!avatarProvider) throw new AvatarProviderUnavailableError();

  const brandRepository = new BrandRepository(params.db);

  await avatarProvider.completeAssetUpload(params.assetId);
  const created = await avatarProvider.createDigitalTwin({ name: params.name, assetId: params.assetId });

  // ★ Achado real (visto ao vivo — avatar criado de verdade na HeyGen, mas
  // ficou "órfão": `requestConsent` falhou logo em seguida, e como o
  // registro só era salvo DEPOIS dela, o `group_id`/`look_id` reais nunca
  // chegaram ao nosso banco. Uma tentativa seguinte tentou criar outro
  // avatar do zero e esbarrou no teto da conta ("limit of 1 verified
  // avatar group slots") — a HeyGen já tinha o avatar certo, só não
  // sabíamos. Salva assim que o avatar existe de verdade, antes de
  // qualquer chamada que ainda possa falhar.
  await brandRepository.update(params.brandId, {
    avatar_group_id: created.groupId,
    avatar_look_id: created.lookId,
    avatar_name: params.name,
    avatar_consent_status: "pending",
    avatar_training_status: "processing",
    avatar_ready: false,
    // ★ Achado real (pedido direto do usuário — "a voz do clone... narrar
    // todo o vídeo"): a HeyGen clona a voz junto do treinamento do rosto
    // (`defaultVoiceId`) — nunca persistido antes, reaproveitado agora pra
    // narrar cenas sem avatar visível com a MESMA voz das cenas com avatar.
    avatar_voice_id: created.defaultVoiceId,
  });

  const { consentUrl } = await avatarProvider.requestConsent(created.groupId);
  return { consentUrl };
}

/**
 * Gera um novo link de consentimento pro grupo já existente — o link da
 * HeyGen é revelado 1 vez só na criação e expira em ~24h; sem isso, perder
 * o link antes de enviar pro porta-voz encalharia o fluxo sem saída.
 */
export async function regenerateBrandAvatarConsentLink(params: {
  serviceRoleDb: SupabaseClient<Database>;
  db: SupabaseClient<Database>;
  organizationId: string;
  brandId: string;
}): Promise<{ consentUrl: string }> {
  const avatarProvider = await resolveAvatarProvider(params.serviceRoleDb, params.organizationId);
  if (!avatarProvider) throw new AvatarProviderUnavailableError();

  const brand = await new BrandRepository(params.db).findById(params.brandId);
  if (!brand?.avatar_group_id) throw new Error("Essa marca ainda não tem um avatar sendo criado.");

  return avatarProvider.requestConsent(brand.avatar_group_id);
}

/** ★ Achado real (mesmo espírito de `video-pipeline-avatar.ts`): gerar um novo look também é assíncrono (foto, não vídeo — mais rápido, mas ainda não instantâneo) — folga generosa, bem menor que a de vídeo. */
const LOOK_POLL_INTERVAL_MS = 5_000;
const LOOK_MAX_POLL_ATTEMPTS = 36; // ~3min

/**
 * ★ Achado real (pedido direto do usuário — "implementa a troca de roupa
 * também, nem que seja com um prompt"): gera um novo "look" (foto, mesmo
 * rosto do avatar treinado, roupa/estilo conforme o prompt) e espera ele
 * ficar pronto — devolve o `lookId` já pronto pra uso direto em
 * `generateAvatarVideo` no lugar do look original. Nunca persistido no
 * `brands` (é uma escolha por geração, não um novo padrão da marca — mesmo
 * espírito de `backgroundColorHex`/`voiceId` em `video-pipeline-avatar.ts`).
 */
export async function generateAvatarLookVariant(params: {
  serviceRoleDb: SupabaseClient<Database>;
  organizationId: string;
  groupId: string;
  baseAvatarId: string;
  name: string;
  prompt: string;
}): Promise<{ lookId: string }> {
  const avatarProvider = await resolveAvatarProvider(params.serviceRoleDb, params.organizationId);
  if (!avatarProvider) throw new AvatarProviderUnavailableError();

  const created = await avatarProvider.createPromptLook({
    name: params.name,
    prompt: params.prompt,
    avatarId: params.baseAvatarId,
    groupId: params.groupId,
  });

  for (let attempt = 0; attempt < LOOK_MAX_POLL_ATTEMPTS; attempt++) {
    const { status } = await avatarProvider.getTrainingStatus(created.lookId);
    if (status === "completed") return { lookId: created.lookId };
    if (status === "failed") throw new Error("Não consegui gerar essa variação de roupa/estilo agora.");
    await new Promise((resolve) => setTimeout(resolve, LOOK_POLL_INTERVAL_MS));
  }

  throw new Error(`Variação de roupa/estilo não ficou pronta a tempo (${(LOOK_MAX_POLL_ATTEMPTS * LOOK_POLL_INTERVAL_MS) / 1000}s).`);
}

/**
 * ★ Achado real (pedido direto do usuário — "e eu faço isso pelo heygen?",
 * resposta a "implementa a troca de roupa também" ter falhado em preservar
 * identidade real): treina um NOVO look a partir de um vídeo real novo,
 * anexado ao MESMO `avatar_group_id` já consentido (nunca cria grupo novo —
 * a conta só permite 1). Reaproveita o mesmo fluxo de upload
 * (`createBrandAvatarUploadSlot`) já usado pro avatar principal.
 */
export interface AddBrandAvatarLookParams {
  db: SupabaseClient<Database>;
  serviceRoleDb: SupabaseClient<Database>;
  organizationId: string;
  brandId: string;
  name: string;
  /** `assetId` do slot criado por `createBrandAvatarUploadSlot` — o navegador já terminou o PUT dos bytes antes de chamar isto. */
  assetId: string;
}

export async function addBrandAvatarLook(params: AddBrandAvatarLookParams): Promise<{ lookId: string; consentUrl: string | null }> {
  const avatarProvider = await resolveAvatarProvider(params.serviceRoleDb, params.organizationId);
  if (!avatarProvider) throw new AvatarProviderUnavailableError();

  const brandRepository = new BrandRepository(params.db);
  const brand = await brandRepository.findById(params.brandId);
  if (!brand?.avatar_group_id) {
    throw new Error("Essa marca ainda não tem um avatar principal — crie o avatar antes de adicionar um novo look.");
  }

  await avatarProvider.completeAssetUpload(params.assetId);
  const created = await avatarProvider.createDigitalTwin({
    name: params.name,
    assetId: params.assetId,
    groupId: brand.avatar_group_id,
  });

  // ★ Mesmo cuidado de `createBrandAvatar`: salva o look novo assim que ele
  // existe de verdade na HeyGen, antes de qualquer chamada que ainda possa
  // falhar (evita o mesmo bug de look "órfão" já visto ao vivo com o avatar
  // principal).
  const existingLooks = Array.isArray(brand.avatar_looks) ? (brand.avatar_looks as { lookId: string; name: string; status: string }[]) : [];
  await brandRepository.update(params.brandId, {
    avatar_looks: [...existingLooks, { lookId: created.lookId, name: params.name, status: "processing" }],
  });

  // ★ Consentimento é do GRUPO, não por look (achado real da doc da HeyGen)
  // — um grupo já consentido (`"accepted"`) não deveria pedir de novo por
  // causa de um look adicional.
  if (created.consentStatus === "accepted") {
    return { lookId: created.lookId, consentUrl: null };
  }

  const { consentUrl } = await avatarProvider.requestConsent(brand.avatar_group_id);
  return { lookId: created.lookId, consentUrl };
}

/**
 * Atualiza o status de treinamento de todos os looks extras ainda
 * "processing" em `avatar_looks` — separado de `refreshBrandAvatarStatus`
 * (que cuida só do look principal + consentimento do grupo) porque cada
 * look extra treina de forma independente e pode terminar em momentos
 * diferentes.
 */
export async function refreshBrandAvatarLooksStatus(params: {
  db: SupabaseClient<Database>;
  serviceRoleDb: SupabaseClient<Database>;
  organizationId: string;
  brandId: string;
}): Promise<{ lookId: string; name: string; status: string }[]> {
  const avatarProvider = await resolveAvatarProvider(params.serviceRoleDb, params.organizationId);
  if (!avatarProvider) throw new AvatarProviderUnavailableError();

  const brandRepository = new BrandRepository(params.db);
  const brand = await brandRepository.findById(params.brandId);
  const looks = Array.isArray(brand?.avatar_looks) ? (brand!.avatar_looks as { lookId: string; name: string; status: string }[]) : [];

  const updatedLooks = await Promise.all(
    looks.map(async (look) => {
      if (look.status !== "processing") return look;
      const { status } = await avatarProvider.getTrainingStatus(look.lookId);
      return { ...look, status };
    }),
  );

  await brandRepository.update(params.brandId, { avatar_looks: updatedLooks });
  return updatedLooks;
}

/**
 * ★ Achado real (visto ao vivo — o erro de `formEl.reset()` fez o usuário
 * reenviar o mesmo vídeo 2x antes do envio "limpo" funcionar, criando looks
 * duplicados de verdade na HeyGen): remove só da nossa lista (`avatar_looks`)
 * — nunca chama nada na HeyGen pra apagar o look de lá, o teto de conta era
 * por GRUPO (1 só), nunca por look dentro de um grupo, então um look extra
 * "esquecido" lá não custa nada nem atrapalha.
 */
export async function removeBrandAvatarLook(params: {
  db: SupabaseClient<Database>;
  brandId: string;
  lookId: string;
}): Promise<{ lookId: string; name: string; status: string }[]> {
  const brandRepository = new BrandRepository(params.db);
  const brand = await brandRepository.findById(params.brandId);
  const looks = Array.isArray(brand?.avatar_looks) ? (brand!.avatar_looks as { lookId: string; name: string; status: string }[]) : [];

  const updatedLooks = looks.filter((look) => look.lookId !== params.lookId);
  await brandRepository.update(params.brandId, { avatar_looks: updatedLooks });
  return updatedLooks;
}

export interface RefreshBrandAvatarStatusResult {
  consentStatus: string;
  trainingStatus: string;
  ready: boolean;
}

/**
 * Consulta o status real na HeyGen (consentimento + treinamento, etapas
 * independentes) e grava no `brands` — `avatar_ready` só vira `true` quando
 * as DUAS estiverem concluídas (geração de vídeo com o avatar exige
 * consentimento aprovado E treinamento pronto).
 */
export async function refreshBrandAvatarStatus(params: {
  db: SupabaseClient<Database>;
  serviceRoleDb: SupabaseClient<Database>;
  organizationId: string;
  brandId: string;
}): Promise<RefreshBrandAvatarStatusResult> {
  const avatarProvider = await resolveAvatarProvider(params.serviceRoleDb, params.organizationId);
  if (!avatarProvider) throw new AvatarProviderUnavailableError();

  const brandRepository = new BrandRepository(params.db);
  const brand = await brandRepository.findById(params.brandId);
  if (!brand?.avatar_group_id || !brand.avatar_look_id) {
    throw new Error("Essa marca ainda não tem um avatar sendo criado.");
  }

  const [consent, training] = await Promise.all([
    avatarProvider.getConsentStatus(brand.avatar_group_id),
    avatarProvider.getTrainingStatus(brand.avatar_look_id),
  ]);

  // ★ Achado real (visto ao vivo, conta HeyGen real do usuário — a
  // documentação nunca confirma o valor exato): consentimento concluído
  // vem como `"accepted"`, nunca `"approved"` (suposição inicial errada,
  // corrigida depois de ver o valor real numa consulta direta à API).
  const ready = consent.consentStatus === "accepted" && training.status === "completed";

  await brandRepository.update(params.brandId, {
    avatar_consent_status: consent.consentStatus,
    avatar_training_status: training.status,
    avatar_ready: ready,
    // ★ Achado real: cobre marcas cujo avatar foi criado antes de
    // `avatar_voice_id` existir (migration 0027) — nunca sobrescreve um
    // valor já salvo, só preenche quando ainda está vazio.
    ...(!brand.avatar_voice_id && training.defaultVoiceId ? { avatar_voice_id: training.defaultVoiceId } : {}),
  });

  return { consentStatus: consent.consentStatus, trainingStatus: training.status, ready };
}

/**
 * ★ Achado real (pedido direto do usuário — "no meu caso que tenho vários
 * avatar no HeyGen, ele liste todos"): consulta a HeyGen DIRETO (nunca só
 * `brand.avatar_looks`, bookkeeping próprio que só sabe dos looks criados
 * pelo nosso próprio fluxo de upload) — devolve TODOS os looks do grupo,
 * incluindo os 6 treinados de vídeo real e os sintéticos que a própria
 * HeyGen gera automaticamente (`trained: false`, nunca oferecidos como
 * padrão — mesmo achado real de `generateAvatarLookVariant`: não preservam
 * identidade de forma confiável).
 */
export async function listAllBrandAvatarLooks(params: {
  db: SupabaseClient<Database>;
  serviceRoleDb: SupabaseClient<Database>;
  organizationId: string;
  brandId: string;
}): Promise<AvatarGroupLook[]> {
  const avatarProvider = await resolveAvatarProvider(params.serviceRoleDb, params.organizationId);
  if (!avatarProvider) throw new AvatarProviderUnavailableError();

  const brand = await new BrandRepository(params.db).findById(params.brandId);
  if (!brand?.avatar_group_id) throw new Error("Essa marca ainda não tem um avatar sendo criado.");

  return avatarProvider.listGroupLooks(brand.avatar_group_id);
}

/**
 * Troca qual look é o padrão da marca (`avatar_look_id`/`avatar_name`) —
 * escolha entre os looks treinados de vídeo real (`listAllBrandAvatarLooks`,
 * `trained: true`); nunca aceita um synthetic/sem `avatar_id` real, mesmo
 * que o chamador tente forçar (checagem contra a lista real da HeyGen, não
 * só um `lookId` arbitrário).
 */
export async function setDefaultBrandAvatarLook(params: {
  db: SupabaseClient<Database>;
  serviceRoleDb: SupabaseClient<Database>;
  organizationId: string;
  brandId: string;
  lookId: string;
}): Promise<void> {
  const looks = await listAllBrandAvatarLooks(params);
  const chosen = looks.find((look) => look.lookId === params.lookId);
  if (!chosen) throw new Error("Esse look não existe mais no avatar da marca.");
  if (!chosen.trained) {
    throw new Error("Esse look foi gerado automaticamente pela HeyGen a partir de 1 foto — não preserva sua identidade real, não pode virar padrão.");
  }

  // ★ Achado real: `avatar_ready` refletia o status do look ANTERIOR — sem
  // resetar aqui, trocar pra um look recém-criado (ainda `processing`)
  // deixaria `avatar_ready` preso em `true` (herdado do look antigo, já
  // pronto), liberando geração de vídeo contra um look que talvez nem
  // tenha terminado de treinar. Força um novo `refreshBrandAvatarStatus`
  // antes de gerar de novo.
  await new BrandRepository(params.db).update(params.brandId, {
    avatar_look_id: chosen.lookId,
    avatar_name: chosen.name,
    avatar_ready: false,
    avatar_training_status: "processing",
  });
}
