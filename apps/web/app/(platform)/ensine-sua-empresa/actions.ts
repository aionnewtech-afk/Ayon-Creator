"use server";

import { revalidatePath } from "next/cache";
import { KnowledgeBaseItemRepository, hasMinimumRole, logger } from "@ayon/core";
import {
  DocumentTooLargeError,
  UnsupportedDocumentTypeError,
  extractDocumentText,
} from "@ayon/core/src/knowledge-base/extract-document-text";
import type { Database, KnowledgeBaseSourceType } from "@ayon/types";
import { getCurrentSession } from "@/lib/session";
import { createClient } from "@/lib/supabase/server";

type KnowledgeBaseItemRow = Database["public"]["Tables"]["knowledge_base_items"]["Row"];

const FRIENDLY_ERROR = "Não consegui salvar isso agora. Pode tentar de novo em instantes?";
const KNOWLEDGE_BASE_BUCKET = "knowledge-base";

export interface KnowledgeActionResult {
  ok: boolean;
  error?: string;
}

export interface CreateKnowledgeItemResult extends KnowledgeActionResult {
  item?: KnowledgeBaseItemRow;
}

function parseTags(raw: FormDataEntryValue | null): string[] {
  if (typeof raw !== "string" || !raw.trim()) return [];
  return raw
    .split(",")
    .map((tag) => tag.trim())
    .filter(Boolean);
}

/**
 * KB-2 — Enviar um arquivo (PDF, DOCX ou TXT). Extração de texto acontece de
 * forma síncrona nesta mesma Server Action (architecture.md §3.2) — sem n8n,
 * mesma lógica de latência do Fluxo 1.
 */
export async function uploadKnowledgeDocumentAction(formData: FormData): Promise<CreateKnowledgeItemResult> {
  const session = await getCurrentSession();

  if (!session?.organization || !session.membership || !session.brand) {
    return { ok: false, error: FRIENDLY_ERROR };
  }

  if (!hasMinimumRole(session.membership.role, "editor")) {
    return { ok: false, error: "Só quem edita ou administra a conta pode gerenciar a Knowledge Base." };
  }

  const file = formData.get("file");
  if (!(file instanceof File) || file.size === 0) {
    return { ok: false, error: "Escolhe um arquivo pra enviar." };
  }

  const sourceType = formData.get("sourceType") as KnowledgeBaseSourceType | null;
  if (!sourceType) {
    return { ok: false, error: "Escolhe que tipo de conhecimento é esse." };
  }

  const tags = parseTags(formData.get("tags"));
  const titleInput = (formData.get("title") as string | null)?.trim();
  const title = titleInput || file.name;

  try {
    const buffer = Buffer.from(await file.arrayBuffer());
    const contentText = await extractDocumentText({
      mimeType: file.type,
      sizeBytes: file.size,
      buffer,
    });

    const db = await createClient();
    const storagePath = `${session.organization.id}/${session.brand.id}/${crypto.randomUUID()}-${file.name}`;

    const { error: uploadError } = await db.storage.from(KNOWLEDGE_BASE_BUCKET).upload(storagePath, buffer, {
      contentType: file.type,
    });
    if (uploadError) throw uploadError;

    const knowledgeBaseRepository = new KnowledgeBaseItemRepository(db);
    const item = await knowledgeBaseRepository.create({
      brand_id: session.brand.id,
      source_type: sourceType,
      title,
      content_text: contentText,
      storage_path: storagePath,
      tags,
      created_by: session.user.id,
    });

    revalidatePath("/ensine-sua-empresa");
    return { ok: true, item };
  } catch (error) {
    if (error instanceof UnsupportedDocumentTypeError || error instanceof DocumentTooLargeError) {
      return { ok: false, error: error.message };
    }
    logger.error("knowledge_base.upload_failed", {
      brandId: session.brand.id,
      reason: error instanceof Error ? error.message : String(error),
    });
    return { ok: false, error: FRIENDLY_ERROR };
  }
}

/** KB-2 — Escrever uma nota manual (sem arquivo). */
export async function createManualNoteAction(input: {
  sourceType: KnowledgeBaseSourceType;
  title: string;
  contentText: string;
  tags: string[];
}): Promise<CreateKnowledgeItemResult> {
  const session = await getCurrentSession();

  if (!session?.organization || !session.membership || !session.brand) {
    return { ok: false, error: FRIENDLY_ERROR };
  }

  if (!hasMinimumRole(session.membership.role, "editor")) {
    return { ok: false, error: "Só quem edita ou administra a conta pode gerenciar a Knowledge Base." };
  }

  const contentText = input.contentText.trim();
  if (!contentText) {
    return { ok: false, error: "Escreve o que você quer que a Ayon saiba." };
  }

  const title = input.title.trim() || contentText.slice(0, 60);

  const db = await createClient();
  const knowledgeBaseRepository = new KnowledgeBaseItemRepository(db);

  const item = await knowledgeBaseRepository.create({
    brand_id: session.brand.id,
    source_type: input.sourceType,
    title,
    content_text: contentText,
    tags: input.tags,
    created_by: session.user.id,
  });

  revalidatePath("/ensine-sua-empresa");
  return { ok: true, item };
}

/** KB-3 — Editar tags de um item existente. */
export async function updateKnowledgeItemTagsAction(itemId: string, tags: string[]): Promise<KnowledgeActionResult> {
  const session = await getCurrentSession();

  if (!session?.organization || !session.membership || !session.brand) {
    return { ok: false, error: FRIENDLY_ERROR };
  }

  if (!hasMinimumRole(session.membership.role, "editor")) {
    return { ok: false, error: "Só quem edita ou administra a conta pode gerenciar a Knowledge Base." };
  }

  const db = await createClient();
  const knowledgeBaseRepository = new KnowledgeBaseItemRepository(db);
  await knowledgeBaseRepository.update(itemId, { tags });

  revalidatePath("/ensine-sua-empresa");
  return { ok: true };
}

/** KB-3 — Remover item (soft delete). */
export async function deleteKnowledgeItemAction(itemId: string): Promise<KnowledgeActionResult> {
  const session = await getCurrentSession();

  if (!session?.organization || !session.membership || !session.brand) {
    return { ok: false, error: FRIENDLY_ERROR };
  }

  if (!hasMinimumRole(session.membership.role, "editor")) {
    return { ok: false, error: "Só quem edita ou administra a conta pode gerenciar a Knowledge Base." };
  }

  const db = await createClient();
  const knowledgeBaseRepository = new KnowledgeBaseItemRepository(db);
  await knowledgeBaseRepository.softDelete(itemId);

  revalidatePath("/ensine-sua-empresa");
  return { ok: true };
}
