"use server";

import { revalidatePath } from "next/cache";
import { BrandBrainRepository, BrandRepository, hasMinimumRole, logger, VOICE_CATALOG } from "@ayon/core";
import { getCurrentSession } from "@/lib/session";
import { createClient } from "@/lib/supabase/server";

const BRAND_MEDIA_BUCKET = "brand-media";
const MAX_LOGO_SIZE_BYTES = 5 * 1024 * 1024;
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
