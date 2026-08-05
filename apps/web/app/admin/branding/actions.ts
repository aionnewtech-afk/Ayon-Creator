"use server";

import { revalidatePath } from "next/cache";
import { headers } from "next/headers";
import { BrandRepository, getPlatformAdminRole, recordAdminAction, requirePlatformAdmin } from "@ayon/core";
import { createClient } from "@/lib/supabase/server";
import { createServiceRoleClient } from "@/lib/supabase/service-role";

const BRAND_MEDIA_BUCKET = "brand-media";
const MAX_LOGO_SIZE_BYTES = 5 * 1024 * 1024;

export interface AdminActionResult {
  ok: boolean;
  error?: string;
}

async function requireActor() {
  const sessionDb = await createClient();
  const {
    data: { user },
  } = await sessionDb.auth.getUser();
  if (!user) throw new Error("Não autenticado.");

  const serviceRoleDb = createServiceRoleClient();
  await requirePlatformAdmin(serviceRoleDb, user.id);
  const role = await getPlatformAdminRole(serviceRoleDb, user.id);
  if (!role) throw new Error("Acesso restrito à administração da plataforma.");

  const headerList = await headers();
  return {
    sessionDb,
    serviceRoleDb,
    userId: user.id,
    role,
    ipAddress: headerList.get("x-forwarded-for") ?? headerList.get("x-real-ip"),
    userAgent: headerList.get("user-agent"),
  };
}

function toErrorResult(error: unknown): AdminActionResult {
  return { ok: false, error: error instanceof Error ? error.message : "Erro inesperado." };
}

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

/** Mesmos campos do Perfil da Marca (Missão 11, §14.1), visão cross-organização — qualquer platform_admin. */
export async function updateBrandAdminAction(brandId: string, organizationId: string, formData: FormData): Promise<AdminActionResult> {
  try {
    const actor = await requireActor();
    const brandRepository = new BrandRepository(actor.sessionDb);
    const before = await brandRepository.findById(brandId);
    if (!before) return { ok: false, error: "Marca não encontrada." };

    const logoFile = formData.get("logo");
    let logoStoragePath: string | undefined;

    if (logoFile instanceof File && logoFile.size > 0) {
      if (logoFile.size > MAX_LOGO_SIZE_BYTES) return { ok: false, error: "A logo é maior que 5MB." };
      if (!logoFile.type.startsWith("image/")) return { ok: false, error: "Envie um arquivo de imagem para a logo." };

      const extension = logoFile.type.split("/")[1] ?? "png";
      const storagePath = `${organizationId}/${brandId}/logo.${extension}`;
      const buffer = Buffer.from(await logoFile.arrayBuffer());

      const { error: uploadError } = await actor.sessionDb.storage
        .from(BRAND_MEDIA_BUCKET)
        .upload(storagePath, buffer, { contentType: logoFile.type, upsert: true });
      if (uploadError) throw uploadError;

      logoStoragePath = storagePath;
    }

    const patch = {
      ...(logoStoragePath ? { logo_storage_path: logoStoragePath } : {}),
      primary_color_hex: normalizeColorInput(formData.get("primaryColorHex")),
      secondary_color_hex: normalizeColorInput(formData.get("secondaryColorHex")),
      font_family: normalizeTextInput(formData.get("fontFamily")),
      visual_style: normalizeTextInput(formData.get("visualStyle")),
    };

    const after = await brandRepository.update(brandId, patch);

    await recordAdminAction({
      serviceRoleDb: actor.serviceRoleDb,
      actorUserId: actor.userId,
      actorRole: actor.role,
      organizationId,
      action: "brand.update",
      entityType: "brand",
      entityId: brandId,
      before: {
        primary_color_hex: before.primary_color_hex,
        secondary_color_hex: before.secondary_color_hex,
        font_family: before.font_family,
        visual_style: before.visual_style,
      },
      after: {
        primary_color_hex: after.primary_color_hex,
        secondary_color_hex: after.secondary_color_hex,
        font_family: after.font_family,
        visual_style: after.visual_style,
        logo_changed: Boolean(logoStoragePath),
      },
      ipAddress: actor.ipAddress,
      userAgent: actor.userAgent,
    });

    revalidatePath("/admin/branding");
    return { ok: true };
  } catch (error) {
    return toErrorResult(error);
  }
}
