import mammoth from "mammoth";

export const ACCEPTED_DOCUMENT_MIME_TYPES = [
  "application/pdf",
  "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
  "text/plain",
] as const;

export const MAX_DOCUMENT_SIZE_BYTES = 10 * 1024 * 1024;

export class UnsupportedDocumentTypeError extends Error {
  constructor(mimeType: string) {
    super(`Tipo de arquivo não suportado: ${mimeType}. Envie PDF, DOCX ou TXT.`);
    this.name = "UnsupportedDocumentTypeError";
  }
}

export class DocumentTooLargeError extends Error {
  constructor() {
    super("Esse arquivo é maior que 10MB — tenta um resumo ou divide em partes?");
    this.name = "DocumentTooLargeError";
  }
}

/**
 * Extrai texto de um documento (PDF, DOCX ou TXT), de forma síncrona na
 * própria Server Action — decisão deliberada de não usar n8n aqui, mesma
 * lógica de latência do Fluxo 1 (architecture.md §3.2).
 */
export async function extractDocumentText(file: {
  mimeType: string;
  sizeBytes: number;
  buffer: Buffer;
}): Promise<string> {
  if (file.sizeBytes > MAX_DOCUMENT_SIZE_BYTES) {
    throw new DocumentTooLargeError();
  }

  switch (file.mimeType) {
    case "application/pdf": {
      const pdfParse = (await import("pdf-parse")).default;
      const result = await pdfParse(file.buffer);
      return result.text.trim();
    }
    case "application/vnd.openxmlformats-officedocument.wordprocessingml.document": {
      const result = await mammoth.extractRawText({ buffer: file.buffer });
      return result.value.trim();
    }
    case "text/plain":
      return file.buffer.toString("utf-8").trim();
    default:
      throw new UnsupportedDocumentTypeError(file.mimeType);
  }
}
