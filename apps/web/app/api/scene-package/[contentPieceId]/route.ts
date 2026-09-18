import { NextResponse, type NextRequest } from "next/server";
import { ContentPieceRepository, hasMinimumRole, logger } from "@ayon/core";
import { buildScenePackage } from "@ayon/core/src/asset-engine/build-scene-clips-package";
import { getCurrentSession } from "@/lib/session";
import { createClient } from "@/lib/supabase/server";

/**
 * ★ Achado real (pedido direto do usuário — "The object exceeded the
 * maximum allowed size"): `downloadScenePackageAction` (Server Action)
 * fazia upload do .zip pro Supabase Storage antes de devolver uma URL —
 * Storage recusa qualquer objeto acima do limite do plano (50MB no
 * gratuito), fácil de estourar com várias cenas de vídeo. Como Server
 * Actions não são feitas pra devolver binário grande direto, esta rota
 * (`fetch` simples do client, autenticada pela MESMA sessão/cookie de
 * sempre) monta o .zip e transmite ele direto na resposta HTTP — nunca
 * passa pelo Storage, nunca tem limite de tamanho de objeto no meio.
 */
export async function GET(_request: NextRequest, context: { params: Promise<{ contentPieceId: string }> }): Promise<NextResponse> {
  const { contentPieceId } = await context.params;

  const session = await getCurrentSession();
  if (!session?.organization || !session.membership || !session.brand) {
    return NextResponse.json({ error: "Não consegui confirmar sua sessão. Recarrega a página e tenta de novo." }, { status: 401 });
  }
  if (!hasMinimumRole(session.membership.role, "editor")) {
    return NextResponse.json({ error: "Só quem edita ou administra a conta pode baixar as cenas." }, { status: 403 });
  }

  const db = await createClient();
  const contentPieceRepository = new ContentPieceRepository(db);
  const piece = await contentPieceRepository.findById(contentPieceId);
  if (!piece || piece.status !== "scenes_ready_for_review") {
    return NextResponse.json({ error: "Essa peça não tem cenas em revisão pra empacotar agora." }, { status: 400 });
  }

  try {
    const { buffer } = await buildScenePackage({ db, contentPieceId });
    return new NextResponse(new Uint8Array(buffer), {
      status: 200,
      headers: {
        "Content-Type": "application/zip",
        "Content-Disposition": 'attachment; filename="cenas.zip"',
        "Content-Length": String(buffer.length),
      },
    });
  } catch (error) {
    logger.error("asset_engine.scene_package_route_failed", {
      contentPieceId,
      reason: error instanceof Error ? error.message : String(error),
    });
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Não consegui montar o pacote de cenas agora. Tenta de novo?" },
      { status: 500 },
    );
  }
}
