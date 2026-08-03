"use client";

import { useState } from "react";
import type { Database, KnowledgeBaseSourceType } from "@ayon/types";
import { Button, Card, CardContent, Input, Label, Textarea, cn } from "@ayon/ui";
import {
  createManualNoteAction,
  deleteKnowledgeItemAction,
  updateKnowledgeItemTagsAction,
  uploadKnowledgeDocumentAction,
} from "./actions";

type KnowledgeBaseItemRow = Database["public"]["Tables"]["knowledge_base_items"]["Row"];

const SOURCE_TYPE_LABELS: Record<KnowledgeBaseSourceType, string> = {
  document: "Documento",
  past_content: "Conteúdo antigo",
  faq: "Pergunta frequente",
  performance_note: "Nota de performance",
  manual_note: "Nota",
  onboarding_conversation: "Conversa com a Ayon",
};

const SELECTABLE_SOURCE_TYPES: { value: KnowledgeBaseSourceType; label: string }[] = [
  { value: "document", label: "Documento" },
  { value: "past_content", label: "Conteúdo antigo" },
  { value: "faq", label: "Pergunta frequente" },
  { value: "performance_note", label: "Nota de performance" },
  { value: "manual_note", label: "Nota" },
];

type View = "list" | "add" | "detail";

export interface KnowledgeLibraryProps {
  brandName: string;
  initialItems: KnowledgeBaseItemRow[];
}

export function KnowledgeLibrary({ brandName, initialItems }: KnowledgeLibraryProps) {
  const [items, setItems] = useState<KnowledgeBaseItemRow[]>(initialItems);
  const [view, setView] = useState<View>("list");
  const [selectedItemId, setSelectedItemId] = useState<string | null>(null);

  const sortedItems = [...items].sort(
    (a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime(),
  );
  const selectedItem = items.find((item) => item.id === selectedItemId) ?? null;

  function handleItemCreated(item: KnowledgeBaseItemRow) {
    setItems((prev) => [item, ...prev]);
    setView("list");
  }

  function handleItemUpdated(item: KnowledgeBaseItemRow) {
    setItems((prev) => prev.map((existing) => (existing.id === item.id ? item : existing)));
  }

  function handleItemDeleted(itemId: string) {
    setItems((prev) => prev.filter((item) => item.id !== itemId));
    setView("list");
    setSelectedItemId(null);
  }

  if (view === "add") {
    return <AddKnowledgeForm brandName={brandName} onCreated={handleItemCreated} onCancel={() => setView("list")} />;
  }

  if (view === "detail" && selectedItem) {
    return (
      <KnowledgeItemDetail
        item={selectedItem}
        onBack={() => setView("list")}
        onUpdated={handleItemUpdated}
        onDeleted={handleItemDeleted}
      />
    );
  }

  return (
    <div className="mx-auto max-w-3xl space-y-6 py-8">
      <div className="flex items-center justify-between gap-4">
        <div className="space-y-1">
          <h1 className="text-xl font-semibold text-foreground">Ensine sua Empresa para a IA</h1>
          <p className="text-sm text-muted-foreground">
            Tudo que você enviar aqui vira conhecimento que a {brandName} pode consultar — a qualquer momento, sem
            precisar retomar a conversa.
          </p>
        </div>
        <Button onClick={() => setView("add")}>Adicionar Conhecimento</Button>
      </div>

      {sortedItems.length === 0 ? (
        <div className="rounded-lg border border-dashed border-border px-6 py-16 text-center">
          <p className="text-sm text-muted-foreground">
            Nada por aqui ainda. Envie um documento ou escreva uma nota pra começar.
          </p>
        </div>
      ) : (
        <div className="space-y-3">
          {sortedItems.map((item) => (
            <button
              key={item.id}
              type="button"
              onClick={() => {
                if (item.source_type === "onboarding_conversation") return;
                setSelectedItemId(item.id);
                setView("detail");
              }}
              className={cn(
                "w-full rounded-lg border border-border bg-card px-4 py-3 text-left transition-colors",
                item.source_type === "onboarding_conversation" ? "cursor-default" : "hover:bg-accent",
              )}
            >
              <div className="flex items-center justify-between gap-2">
                <span className="font-medium text-foreground">{item.title}</span>
                <span className="shrink-0 rounded-full bg-secondary px-2 py-0.5 text-xs text-secondary-foreground">
                  {SOURCE_TYPE_LABELS[item.source_type]}
                </span>
              </div>
              {item.tags.length > 0 ? (
                <div className="mt-2 flex flex-wrap gap-1">
                  {item.tags.map((tag) => (
                    <span key={tag} className="rounded bg-muted px-2 py-0.5 text-xs text-muted-foreground">
                      {tag}
                    </span>
                  ))}
                </div>
              ) : null}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

function AddKnowledgeForm({
  brandName,
  onCreated,
  onCancel,
}: {
  brandName: string;
  onCreated: (item: KnowledgeBaseItemRow) => void;
  onCancel: () => void;
}) {
  const [mode, setMode] = useState<"file" | "note">("file");
  const [sourceType, setSourceType] = useState<KnowledgeBaseSourceType>("document");
  const [title, setTitle] = useState("");
  const [tags, setTags] = useState("");
  const [noteText, setNoteText] = useState("");
  const [file, setFile] = useState<File | null>(null);
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleSubmit(event: React.FormEvent) {
    event.preventDefault();
    setPending(true);
    setError(null);

    const tagList = tags
      .split(",")
      .map((tag) => tag.trim())
      .filter(Boolean);

    if (mode === "file") {
      if (!file) {
        setError("Escolhe um arquivo pra enviar.");
        setPending(false);
        return;
      }
      const formData = new FormData();
      formData.append("file", file);
      formData.append("sourceType", sourceType);
      formData.append("title", title);
      formData.append("tags", tagList.join(","));

      const result = await uploadKnowledgeDocumentAction(formData);
      setPending(false);
      if (!result.ok || !result.item) {
        setError(result.error ?? "Não consegui enviar o arquivo. Tenta de novo?");
        return;
      }
      onCreated(result.item);
    } else {
      const result = await createManualNoteAction({ sourceType, title, contentText: noteText, tags: tagList });
      setPending(false);
      if (!result.ok || !result.item) {
        setError(result.error ?? "Não consegui salvar a nota. Tenta de novo?");
        return;
      }
      onCreated(result.item);
    }
  }

  return (
    <div className="mx-auto max-w-xl space-y-6 py-8">
      <div className="space-y-1">
        <h1 className="text-xl font-semibold text-foreground">Adicionar Conhecimento</h1>
        <p className="text-sm text-muted-foreground">
          Ajude a Ayon a entender ainda mais sobre a {brandName}.
        </p>
      </div>

      <div className="flex gap-2">
        <Button type="button" variant={mode === "file" ? "default" : "outline"} onClick={() => setMode("file")}>
          Enviar um arquivo
        </Button>
        <Button type="button" variant={mode === "note" ? "default" : "outline"} onClick={() => setMode("note")}>
          Escrever uma nota
        </Button>
      </div>

      <form onSubmit={handleSubmit} className="space-y-4">
        <div className="space-y-2">
          <Label htmlFor="sourceType">Tipo</Label>
          <select
            id="sourceType"
            value={sourceType}
            onChange={(event) => setSourceType(event.target.value as KnowledgeBaseSourceType)}
            className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
          >
            {SELECTABLE_SOURCE_TYPES.map((option) => (
              <option key={option.value} value={option.value}>
                {option.label}
              </option>
            ))}
          </select>
        </div>

        {mode === "file" ? (
          <div className="space-y-2">
            <Label htmlFor="file">Arquivo (PDF, DOCX ou TXT — até 10MB)</Label>
            <Input
              id="file"
              type="file"
              accept=".pdf,.docx,.txt,application/pdf,application/vnd.openxmlformats-officedocument.wordprocessingml.document,text/plain"
              onChange={(event) => setFile(event.target.files?.[0] ?? null)}
              disabled={pending}
            />
          </div>
        ) : (
          <div className="space-y-2">
            <Label htmlFor="noteText">Nota</Label>
            <Textarea
              id="noteText"
              value={noteText}
              onChange={(event) => setNoteText(event.target.value)}
              placeholder="Escreve o que você quer que a Ayon saiba..."
              className="min-h-[140px]"
              disabled={pending}
            />
          </div>
        )}

        <div className="space-y-2">
          <Label htmlFor="title">Título (opcional)</Label>
          <Input
            id="title"
            value={title}
            onChange={(event) => setTitle(event.target.value)}
            placeholder="Se deixar em branco, a gente gera um pra você"
            disabled={pending}
          />
        </div>

        <div className="space-y-2">
          <Label htmlFor="tags">Tags (separadas por vírgula, opcional)</Label>
          <Input
            id="tags"
            value={tags}
            onChange={(event) => setTags(event.target.value)}
            placeholder="ex.: cardápio, campanha de verão"
            disabled={pending}
          />
        </div>

        {error ? <p className="text-sm text-destructive">{error}</p> : null}

        <div className="flex gap-2">
          <Button type="submit" disabled={pending}>
            {pending ? (mode === "file" ? "Enviando e lendo o arquivo..." : "Salvando...") : "Salvar"}
          </Button>
          <Button type="button" variant="ghost" onClick={onCancel} disabled={pending}>
            Cancelar
          </Button>
        </div>
      </form>
    </div>
  );
}

function KnowledgeItemDetail({
  item,
  onBack,
  onUpdated,
  onDeleted,
}: {
  item: KnowledgeBaseItemRow;
  onBack: () => void;
  onUpdated: (item: KnowledgeBaseItemRow) => void;
  onDeleted: (itemId: string) => void;
}) {
  const [tags, setTags] = useState(item.tags.join(", "));
  const [saving, setSaving] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleSaveTags() {
    setSaving(true);
    setError(null);
    const tagList = tags
      .split(",")
      .map((tag) => tag.trim())
      .filter(Boolean);
    const result = await updateKnowledgeItemTagsAction(item.id, tagList);
    setSaving(false);
    if (!result.ok) {
      setError(result.error ?? "Não consegui salvar as tags. Tenta de novo?");
      return;
    }
    onUpdated({ ...item, tags: tagList });
  }

  async function handleDelete() {
    setDeleting(true);
    setError(null);
    const result = await deleteKnowledgeItemAction(item.id);
    setDeleting(false);
    if (!result.ok) {
      setError(result.error ?? "Não consegui remover agora. Tenta de novo?");
      return;
    }
    onDeleted(item.id);
  }

  return (
    <div className="mx-auto max-w-xl space-y-6 py-8">
      <Button type="button" variant="ghost" onClick={onBack}>
        ← Voltar
      </Button>

      <div className="space-y-1">
        <h1 className="text-xl font-semibold text-foreground">{item.title}</h1>
        <p className="text-sm text-muted-foreground">{SOURCE_TYPE_LABELS[item.source_type]}</p>
      </div>

      <Card>
        <CardContent className="whitespace-pre-wrap pt-6 text-sm text-foreground">
          {item.content_text || "Sem conteúdo em texto."}
        </CardContent>
      </Card>

      <div className="space-y-2">
        <Label htmlFor="detailTags">Tags</Label>
        <div className="flex gap-2">
          <Input id="detailTags" value={tags} onChange={(event) => setTags(event.target.value)} disabled={saving} />
          <Button type="button" onClick={handleSaveTags} disabled={saving}>
            {saving ? "Salvando..." : "Salvar"}
          </Button>
        </div>
      </div>

      {error ? <p className="text-sm text-destructive">{error}</p> : null}

      <Button type="button" variant="destructive" onClick={handleDelete} disabled={deleting}>
        {deleting ? "Removendo..." : "Remover item"}
      </Button>
    </div>
  );
}
