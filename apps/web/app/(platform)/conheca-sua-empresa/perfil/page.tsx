import { redirect } from "next/navigation";
import {
  BrandBrainRepository,
  BrandOnboardingAnswerRepository,
  buildOnboardingSynthesis,
  logger,
} from "@ayon/core";
import { detectBrandColorMismatch } from "@ayon/core/src/asset-engine/detect-brand-color-mismatch";
import { getCurrentSession } from "@/lib/session";
import { createClient } from "@/lib/supabase/server";
import { SynthesisFieldCard } from "../conversa/synthesis-field-card";
import { updateBrandBrainFieldAction } from "../actions";
import { IdentityForm } from "./identity-form";

const BRAND_MEDIA_BUCKET = "brand-media";

const MISMATCH_FIELD_LABELS: Record<"primary" | "secondary", string> = {
  primary: "cor primária",
  secondary: "cor secundária",
};

/**
 * ★ Sprint de estabilização (Missão 12) — só detecta e avisa; nunca extrai
 * ou aplica cores automaticamente (decisão explícita do produto). Falha
 * silenciosa em qualquer erro (logo em formato exótico, decodificação
 * falhou etc.) — um alerta de UX nunca pode travar a tela de identidade.
 */
async function buildColorMismatchWarning(
  db: Awaited<ReturnType<typeof createClient>>,
  brand: { id: string; logo_storage_path: string | null; primary_color_hex: string | null; secondary_color_hex: string | null },
): Promise<string | null> {
  if (!brand.logo_storage_path || (!brand.primary_color_hex && !brand.secondary_color_hex)) return null;

  try {
    const { data, error } = await db.storage.from(BRAND_MEDIA_BUCKET).download(brand.logo_storage_path);
    if (error || !data) return null;

    const buffer = Buffer.from(await data.arrayBuffer());
    const result = await detectBrandColorMismatch(buffer, [
      { field: "primary", colorHex: brand.primary_color_hex },
      { field: "secondary", colorHex: brand.secondary_color_hex },
    ]);

    if (!result.analyzed || result.mismatches.length === 0) return null;

    const fieldLabels = result.mismatches.map((m) => MISMATCH_FIELD_LABELS[m.field]).join(" e ");
    return `A ${fieldLabels} cadastrada não parece corresponder às cores predominantes da logo enviada. Confira se está certa — a Ayon não altera isso sozinha.`;
  } catch (err) {
    logger.warn("brand.color_mismatch_detection_failed", {
      brandId: brand.id,
      reason: err instanceof Error ? err.message : String(err),
    });
    return null;
  }
}

/**
 * ONB-4 — Perfil da Marca (ux-design.md §3.2): visão persistente e editável
 * da identidade, disponível a qualquer momento pelo menu "Conheça sua
 * Empresa" — nunca trava mesmo depois de confirmada.
 */
export default async function PerfilDaMarcaPage() {
  const session = await getCurrentSession();

  if (!session?.brand) {
    redirect("/painel");
  }

  const db = await createClient();
  const brandBrainRepository = new BrandBrainRepository(db);
  const answersRepository = new BrandOnboardingAnswerRepository(db);

  const profile = await brandBrainRepository.findByBrandId(session.brand.id);

  if (!profile?.onboarding_confirmed_at) {
    redirect("/conheca-sua-empresa");
  }

  const answers = await answersRepository.findByBrandId(session.brand.id);
  const synthesis = buildOnboardingSynthesis(profile, answers);

  const logoUrl = session.brand.logo_storage_path
    ? (await db.storage.from(BRAND_MEDIA_BUCKET).createSignedUrl(session.brand.logo_storage_path, 3600)).data
        ?.signedUrl ?? null
    : null;

  const colorMismatchWarning = await buildColorMismatchWarning(db, session.brand);

  return (
    <div className="mx-auto max-w-2xl space-y-6 py-8">
      <div className="space-y-1">
        <h1 className="text-xl font-semibold text-foreground">Perfil da {session.brand.name}</h1>
        <p className="text-sm text-muted-foreground">
          O que a Ayon sabe sobre a empresa até agora — editável a qualquer momento.
        </p>
      </div>

      <IdentityForm
        logoUrl={logoUrl}
        primaryColorHex={session.brand.primary_color_hex}
        secondaryColorHex={session.brand.secondary_color_hex}
        fontFamily={session.brand.font_family}
        visualStyle={session.brand.visual_style}
        voiceId={profile.default_voice_ref}
        colorMismatchWarning={colorMismatchWarning}
      />

      <div className="space-y-3">
        {synthesis.map((field) => (
          <SynthesisFieldCard key={field.questionKey} field={field} onSave={updateBrandBrainFieldAction} />
        ))}
      </div>
    </div>
  );
}
