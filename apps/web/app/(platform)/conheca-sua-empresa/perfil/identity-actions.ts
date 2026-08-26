"use server";

import { revalidatePath } from "next/cache";
import {
  addBrandAvatarLook,
  BrandBrainRepository,
  BrandRepository,
  createBrandAvatar,
  createBrandAvatarUploadSlot,
  hasMinimumRole,
  listAllBrandAvatarLooks,
  logger,
  refreshBrandAvatarLooksStatus,
  refreshBrandAvatarStatus,
  regenerateBrandAvatarConsentLink,
  removeBrandAvatarLook,
  setDefaultBrandAvatarLook,
  VOICE_CATALOG,
} from "@ayon/core";
import { getCurrentSession } from "@/lib/session";
import { createClient } from "@/lib/supabase/server";
import { createServiceRoleClient } from "@/lib/supabase/service-role";

const BRAND_MEDIA_BUCKET = "brand-media";
const MAX_LOGO_SIZE_BYTES = 5 * 1024 * 1024;
const MAX_REFERENCE_IMAGE_SIZE_BYTES = 8 * 1024 * 1024;
/** ★ Achado real (pedido direto do usuário — "anexar umas artes pra ele entender a identidade visual"): validado real que o gerador de imagem (Gemini) já respeita paleta/tom com só 1 referência anexada ao prompt — um teto pequeno evita custo/latência desnecessários sem perder o benefício. */
const MAX_REFERENCE_IMAGES = 4;
const FRIENDLY_ERROR = "Não consegui salvar a identidade visual agora. Pode tentar de novo em instantes?";

export interface UpdateBrandIdentityResult {
  ok: boolean;
  error?: string;
}

/**
 * Salva a identidade visual da marca como ativo permanente (Missão 11, arch.
 * §14.1/§14.3, ux-design.md §4.12) — logo, cores, fonte, estilo visual e a
 * voz (override manual, sobrescrevendo a seleção automática). Todos os
 * campos opcionais — marca sem nada preenchido continua gerando conteúdo
 * normalmente (layout adaptativo, arch. §14.8).
 */
export async function updateBrandIdentityAction(formData: FormData): Promise<UpdateBrandIdentityResult> {
  const session = await getCurrentSession();
  if (!session?.organization || !session.membership || !session.brand) return { ok: false, error: FRIENDLY_ERROR };
  if (!hasMinimumRole(session.membership.role, "admin")) {
    return { ok: false, error: "Só quem administra a conta pode editar a identidade visual." };
  }

  const db = await createClient();
  const brandRepository = new BrandRepository(db);

  try {
    const logoFile = formData.get("logo");
    let logoStoragePath: string | undefined;

    if (logoFile instanceof File && logoFile.size > 0) {
      if (logoFile.size > MAX_LOGO_SIZE_BYTES) {
        return { ok: false, error: "A logo é maior que 5MB — tenta uma imagem menor?" };
      }
      if (!logoFile.type.startsWith("image/")) {
        return { ok: false, error: "Envie um arquivo de imagem para a logo." };
      }

      const extension = logoFile.type.split("/")[1] ?? "png";
      const storagePath = `${session.organization.id}/${session.brand.id}/logo.${extension}`;
      const buffer = Buffer.from(await logoFile.arrayBuffer());

      const { error: uploadError } = await db.storage
        .from(BRAND_MEDIA_BUCKET)
        .upload(storagePath, buffer, { contentType: logoFile.type, upsert: true });
      if (uploadError) throw uploadError;

      logoStoragePath = storagePath;
    }

    // ★ Achado real (pedido direto do usuário — "anexar umas artes pra ele
    // entender a identidade visual da empresa"): validado real (curl direto
    // na API do Gemini) que anexar uma imagem de referência junto do prompt
    // de texto faz a geração puxar paleta/tom reais da marca. Remoções
    // (`removeReferencePaths`, checkboxes marcados na UI) processadas antes
    // dos novos uploads, mesmo array; teto (`MAX_REFERENCE_IMAGES`) aplicado
    // por último, cortando os mais antigos primeiro se passar do limite.
    const removePaths = new Set(formData.getAll("removeReferencePaths").map(String));
    const keptPaths = (session.brand.reference_image_paths ?? []).filter((path) => !removePaths.has(path));

    const newReferenceFiles = formData.getAll("referenceImages").filter((f): f is File => f instanceof File && f.size > 0);
    const newReferencePaths: string[] = [];
    for (const file of newReferenceFiles) {
      if (file.size > MAX_REFERENCE_IMAGE_SIZE_BYTES) {
        return { ok: false, error: `A imagem de referência "${file.name}" é maior que 8MB — tenta uma menor?` };
      }
      if (!file.type.startsWith("image/")) {
        return { ok: false, error: "As referências visuais precisam ser imagens." };
      }

      const extension = file.type.split("/")[1] ?? "png";
      const storagePath = `${session.organization.id}/${session.brand.id}/reference-${Date.now()}-${newReferencePaths.length}.${extension}`;
      const buffer = Buffer.from(await file.arrayBuffer());

      const { error: uploadError } = await db.storage
        .from(BRAND_MEDIA_BUCKET)
        .upload(storagePath, buffer, { contentType: file.type, upsert: true });
      if (uploadError) throw uploadError;

      newReferencePaths.push(storagePath);
    }

    const referenceImagePaths = [...keptPaths, ...newReferencePaths].slice(-MAX_REFERENCE_IMAGES);

    const primaryColorHex = normalizeColorInput(formData.get("primaryColorHex"));
    const secondaryColorHex = normalizeColorInput(formData.get("secondaryColorHex"));
    const fontFamily = normalizeTextInput(formData.get("fontFamily"));
    const visualStyle = normalizeTextInput(formData.get("visualStyle"));
    const voiceOverride = normalizeTextInput(formData.get("voiceId"));

    await brandRepository.update(session.brand.id, {
      ...(logoStoragePath ? { logo_storage_path: logoStoragePath } : {}),
      primary_color_hex: primaryColorHex,
      secondary_color_hex: secondaryColorHex,
      font_family: fontFamily,
      visual_style: visualStyle,
      reference_image_paths: referenceImagePaths,
    });

    if (voiceOverride !== undefined) {
      const isKnownVoice = voiceOverride === null || VOICE_CATALOG.some((entry) => entry.voiceId === voiceOverride);
      if (!isKnownVoice) return { ok: false, error: "Voz inválida — escolha uma opção da lista." };

      const brandBrainRepository = new BrandBrainRepository(db);
      await brandBrainRepository.upsertByBrandId(session.brand.id, { default_voice_ref: voiceOverride });
    }

    revalidatePath("/conheca-sua-empresa/perfil");
    return { ok: true };
  } catch (error) {
    logger.error("brand.identity_update_failed", {
      brandId: session.brand.id,
      reason: error instanceof Error ? error.message : String(error),
    });
    return { ok: false, error: FRIENDLY_ERROR };
  }
}

export interface CreateAvatarUploadSlotResult {
  ok: boolean;
  error?: string;
  assetId?: string;
  uploadUrl?: string;
  uploadHeaders?: Record<string, string>;
}

/**
 * ★ Achado real (visto ao vivo — vídeo real de 46.8MB rejeitado pela
 * HeyGen: "Maximum size for URL inputs... is 32 MB"): pede um slot de
 * upload S3 pré-assinado direto na HeyGen — o navegador faz o PUT dos bytes
 * ali (`avatar-section.tsx`), nunca passa pelo nosso servidor. Requisição
 * aqui é só metadados (nome do arquivo, tipo, tamanho), nunca os bytes.
 */
export async function createAvatarUploadSlotAction(
  filename: string,
  contentType: string,
  sizeBytes: number,
): Promise<CreateAvatarUploadSlotResult> {
  const session = await getCurrentSession();
  if (!session?.organization || !session.membership || !session.brand) return { ok: false, error: FRIENDLY_ERROR };
  if (!hasMinimumRole(session.membership.role, "admin")) {
    return { ok: false, error: "Só quem administra a conta pode criar o avatar da marca." };
  }

  const serviceRoleDb = createServiceRoleClient();

  try {
    const slot = await createBrandAvatarUploadSlot({
      serviceRoleDb,
      organizationId: session.organization.id,
      filename,
      contentType,
      sizeBytes,
    });
    return { ok: true, assetId: slot.assetId, uploadUrl: slot.uploadUrl, uploadHeaders: slot.uploadHeaders };
  } catch (error) {
    logger.error("brand.avatar_upload_slot_failed", {
      brandId: session.brand.id,
      reason: error instanceof Error ? error.message : String(error),
    });
    return { ok: false, error: FRIENDLY_ERROR };
  }
}

export interface CreateBrandAvatarResult {
  ok: boolean;
  error?: string;
  consentUrl?: string;
}

/**
 * ★ Achado real (pedido direto do usuário — "iniciar o avatar do porta voz
 * da empresa"): recebe o `assetId` de um upload já concluído
 * (`createAvatarUploadSlotAction` + PUT direto do navegador pra HeyGen) —
 * esta action nunca vê os bytes do vídeo, só confirma o upload e cria o
 * avatar a partir dele.
 */
export async function createBrandAvatarAction(params: { name: string; assetId: string }): Promise<CreateBrandAvatarResult> {
  const session = await getCurrentSession();
  if (!session?.organization || !session.membership || !session.brand) return { ok: false, error: FRIENDLY_ERROR };
  if (!hasMinimumRole(session.membership.role, "admin")) {
    return { ok: false, error: "Só quem administra a conta pode criar o avatar da marca." };
  }

  const name = params.name.trim();
  if (!name) return { ok: false, error: "Dê um nome para o avatar (ex.: o nome do porta-voz)." };
  if (!params.assetId.trim()) return { ok: false, error: FRIENDLY_ERROR };

  const db = await createClient();
  const serviceRoleDb = createServiceRoleClient();

  try {
    const { consentUrl } = await createBrandAvatar({
      db,
      serviceRoleDb,
      organizationId: session.organization.id,
      brandId: session.brand.id,
      name,
      assetId: params.assetId,
    });

    revalidatePath("/conheca-sua-empresa/perfil");
    return { ok: true, consentUrl };
  } catch (error) {
    logger.error("brand.avatar_create_failed", {
      brandId: session.brand.id,
      reason: error instanceof Error ? error.message : String(error),
    });
    return { ok: false, error: FRIENDLY_ERROR };
  }
}

export interface RefreshBrandAvatarStatusActionResult {
  ok: boolean;
  error?: string;
  consentStatus?: string;
  trainingStatus?: string;
  ready?: boolean;
}

/** Consulta o status real (consentimento + treinamento) e atualiza a marca — usado pelo botão "Atualizar status" enquanto o usuário espera. */
export async function refreshBrandAvatarStatusAction(): Promise<RefreshBrandAvatarStatusActionResult> {
  const session = await getCurrentSession();
  if (!session?.organization || !session.membership || !session.brand) return { ok: false, error: FRIENDLY_ERROR };

  const db = await createClient();
  const serviceRoleDb = createServiceRoleClient();

  try {
    const result = await refreshBrandAvatarStatus({
      db,
      serviceRoleDb,
      organizationId: session.organization.id,
      brandId: session.brand.id,
    });
    revalidatePath("/conheca-sua-empresa/perfil");
    return { ok: true, ...result };
  } catch (error) {
    logger.error("brand.avatar_status_refresh_failed", {
      brandId: session.brand.id,
      reason: error instanceof Error ? error.message : String(error),
    });
    return { ok: false, error: FRIENDLY_ERROR };
  }
}

export interface RegenerateConsentLinkResult {
  ok: boolean;
  error?: string;
  consentUrl?: string;
}

/** Gera um novo link de consentimento — pro caso do link original (1 uso só, ~24h) ter sido perdido antes de chegar ao porta-voz. */
export async function regenerateConsentLinkAction(): Promise<RegenerateConsentLinkResult> {
  const session = await getCurrentSession();
  if (!session?.organization || !session.membership || !session.brand) return { ok: false, error: FRIENDLY_ERROR };
  if (!hasMinimumRole(session.membership.role, "admin")) {
    return { ok: false, error: "Só quem administra a conta pode gerenciar o avatar da marca." };
  }

  const db = await createClient();
  const serviceRoleDb = createServiceRoleClient();

  try {
    const { consentUrl } = await regenerateBrandAvatarConsentLink({
      db,
      serviceRoleDb,
      organizationId: session.organization.id,
      brandId: session.brand.id,
    });
    return { ok: true, consentUrl };
  } catch (error) {
    logger.error("brand.avatar_consent_regenerate_failed", {
      brandId: session.brand.id,
      reason: error instanceof Error ? error.message : String(error),
    });
    return { ok: false, error: FRIENDLY_ERROR };
  }
}

export interface AddBrandAvatarLookResult {
  ok: boolean;
  error?: string;
  lookId?: string;
  consentUrl?: string | null;
}

/**
 * ★ Achado real (pedido direto do usuário — "e eu faço isso pelo heygen?",
 * depois de troca de roupa por prompt não preservar identidade real): treina
 * um NOVO look a partir de um 2º vídeo real, dentro do MESMO avatar já
 * criado — mesmo padrão de upload de `createBrandAvatarAction` (`assetId` já
 * enviado direto pro navegador, esta action nunca vê os bytes).
 */
export async function addBrandAvatarLookAction(params: { name: string; assetId: string }): Promise<AddBrandAvatarLookResult> {
  const session = await getCurrentSession();
  if (!session?.organization || !session.membership || !session.brand) return { ok: false, error: FRIENDLY_ERROR };
  if (!hasMinimumRole(session.membership.role, "admin")) {
    return { ok: false, error: "Só quem administra a conta pode gerenciar o avatar da marca." };
  }

  const name = params.name.trim();
  if (!name) return { ok: false, error: "Dê um nome para esse look (ex.: \"Casual\", \"Escritório\")." };
  if (!params.assetId.trim()) return { ok: false, error: FRIENDLY_ERROR };

  const db = await createClient();
  const serviceRoleDb = createServiceRoleClient();

  try {
    const result = await addBrandAvatarLook({
      db,
      serviceRoleDb,
      organizationId: session.organization.id,
      brandId: session.brand.id,
      name,
      assetId: params.assetId,
    });

    revalidatePath("/conheca-sua-empresa/perfil");
    return { ok: true, lookId: result.lookId, consentUrl: result.consentUrl };
  } catch (error) {
    logger.error("brand.avatar_look_add_failed", {
      brandId: session.brand.id,
      reason: error instanceof Error ? error.message : String(error),
    });
    return { ok: false, error: FRIENDLY_ERROR };
  }
}

export interface RefreshBrandAvatarLooksActionResult {
  ok: boolean;
  error?: string;
  looks?: { lookId: string; name: string; status: string }[];
}

/** Consulta o status real de treinamento de cada look extra ainda "processing" — usado pelo mesmo botão "Atualizar status" da tela de Perfil da Marca. */
export async function refreshBrandAvatarLooksAction(): Promise<RefreshBrandAvatarLooksActionResult> {
  const session = await getCurrentSession();
  if (!session?.organization || !session.membership || !session.brand) return { ok: false, error: FRIENDLY_ERROR };

  const db = await createClient();
  const serviceRoleDb = createServiceRoleClient();

  try {
    const looks = await refreshBrandAvatarLooksStatus({
      db,
      serviceRoleDb,
      organizationId: session.organization.id,
      brandId: session.brand.id,
    });
    revalidatePath("/conheca-sua-empresa/perfil");
    return { ok: true, looks };
  } catch (error) {
    logger.error("brand.avatar_looks_status_refresh_failed", {
      brandId: session.brand.id,
      reason: error instanceof Error ? error.message : String(error),
    });
    return { ok: false, error: FRIENDLY_ERROR };
  }
}

export interface AvatarGroupLookView {
  lookId: string;
  name: string;
  trained: boolean;
  previewImageUrl?: string;
}

export interface ListAllAvatarLooksResult {
  ok: boolean;
  error?: string;
  looks?: AvatarGroupLookView[];
}

/**
 * ★ Achado real (pedido direto do usuário — "no meu caso que tenho vários
 * avatar no HeyGen, ele liste todos"): consulta a HeyGen ao vivo — nunca só
 * `brand.avatar_looks` (bookkeeping próprio, só sabe dos looks criados pelo
 * nosso fluxo de upload).
 */
export async function listAllAvatarLooksAction(): Promise<ListAllAvatarLooksResult> {
  const session = await getCurrentSession();
  if (!session?.organization || !session.membership || !session.brand) return { ok: false, error: FRIENDLY_ERROR };

  const db = await createClient();
  const serviceRoleDb = createServiceRoleClient();

  try {
    const looks = await listAllBrandAvatarLooks({
      db,
      serviceRoleDb,
      organizationId: session.organization.id,
      brandId: session.brand.id,
    });
    return { ok: true, looks };
  } catch (error) {
    logger.error("brand.avatar_looks_list_all_failed", {
      brandId: session.brand.id,
      reason: error instanceof Error ? error.message : String(error),
    });
    return { ok: false, error: FRIENDLY_ERROR };
  }
}

export interface SetDefaultAvatarLookResult {
  ok: boolean;
  error?: string;
}

/** Troca qual look treinado de vídeo real é o padrão da marca. */
export async function setDefaultAvatarLookAction(lookId: string): Promise<SetDefaultAvatarLookResult> {
  const session = await getCurrentSession();
  if (!session?.organization || !session.membership || !session.brand) return { ok: false, error: FRIENDLY_ERROR };
  if (!hasMinimumRole(session.membership.role, "admin")) {
    return { ok: false, error: "Só quem administra a conta pode gerenciar o avatar da marca." };
  }

  const db = await createClient();
  const serviceRoleDb = createServiceRoleClient();

  try {
    await setDefaultBrandAvatarLook({
      db,
      serviceRoleDb,
      organizationId: session.organization.id,
      brandId: session.brand.id,
      lookId,
    });
    revalidatePath("/conheca-sua-empresa/perfil");
    return { ok: true };
  } catch (error) {
    logger.error("brand.avatar_look_set_default_failed", {
      brandId: session.brand.id,
      reason: error instanceof Error ? error.message : String(error),
    });
    return { ok: false, error: error instanceof Error ? error.message : FRIENDLY_ERROR };
  }
}

export interface RemoveBrandAvatarLookResult {
  ok: boolean;
  error?: string;
  looks?: { lookId: string; name: string; status: string }[];
}

/**
 * ★ Achado real (visto ao vivo — tentativas repetidas por causa do bug do
 * `formEl.reset()` criaram looks duplicados de verdade): remove só da nossa
 * lista, nunca chama a HeyGen pra apagar (ver `removeBrandAvatarLook`).
 */
export async function removeBrandAvatarLookAction(lookId: string): Promise<RemoveBrandAvatarLookResult> {
  const session = await getCurrentSession();
  if (!session?.organization || !session.membership || !session.brand) return { ok: false, error: FRIENDLY_ERROR };
  if (!hasMinimumRole(session.membership.role, "admin")) {
    return { ok: false, error: "Só quem administra a conta pode gerenciar o avatar da marca." };
  }

  const db = await createClient();

  try {
    const looks = await removeBrandAvatarLook({ db, brandId: session.brand.id, lookId });
    revalidatePath("/conheca-sua-empresa/perfil");
    return { ok: true, looks };
  } catch (error) {
    logger.error("brand.avatar_look_remove_failed", {
      brandId: session.brand.id,
      reason: error instanceof Error ? error.message : String(error),
    });
    return { ok: false, error: FRIENDLY_ERROR };
  }
}

/** `""` (campo limpo pelo usuário) vira `null` (remove o valor); campo ausente do FormData vira `undefined` (não mexe no valor atual). */
function normalizeTextInput(value: FormDataEntryValue | null): string | null | undefined {
  if (value === null) return undefined;
  const trimmed = String(value).trim();
  return trimmed.length > 0 ? trimmed : null;
}

function normalizeColorInput(value: FormDataEntryValue | null): string | null | undefined {
  const normalized = normalizeTextInput(value);
  if (!normalized) return normalized;
  return /^#[0-9a-fA-F]{6}$/.test(normalized) ? normalized : null;
}
