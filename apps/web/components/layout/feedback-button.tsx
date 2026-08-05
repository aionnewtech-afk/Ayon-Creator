"use client";

import { useEffect, useState } from "react";
import { usePathname } from "next/navigation";
import { Button, Dialog, Label, Textarea } from "@ayon/ui";
import type { UserFeedbackCategory } from "@ayon/types";
import { sendFeedbackAction } from "@/app/(platform)/feedback-actions";

const CATEGORY_LABELS: Record<UserFeedbackCategory, string> = {
  suggestion: "Sugestão",
  bug: "Bug",
  difficulty: "Dificuldade de uso",
  other: "Outro",
};

const CATEGORY_OPTIONS: UserFeedbackCategory[] = ["suggestion", "bug", "difficulty", "other"];

export function FeedbackButton() {
  const pathname = usePathname();
  const [open, setOpen] = useState(false);
  const [category, setCategory] = useState<UserFeedbackCategory>("suggestion");
  const [description, setDescription] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [showToast, setShowToast] = useState(false);

  useEffect(() => {
    if (!showToast) return;
    const timeout = setTimeout(() => setShowToast(false), 3000);
    return () => clearTimeout(timeout);
  }, [showToast]);

  function handleClose() {
    setOpen(false);
    setError(null);
  }

  async function handleSubmit(event: React.FormEvent) {
    event.preventDefault();
    setSubmitting(true);
    setError(null);

    const result = await sendFeedbackAction(category, description, pathname);

    setSubmitting(false);

    if (!result.ok) {
      setError(result.error ?? "Algo deu errado. Tenta de novo?");
      return;
    }

    setCategory("suggestion");
    setDescription("");
    setOpen(false);
    setShowToast(true);
  }

  return (
    <>
      <Button type="button" variant="outline" size="sm" onClick={() => setOpen(true)}>
        Enviar feedback
      </Button>

      <Dialog open={open} onClose={handleClose} title="Enviar feedback">
        <form onSubmit={handleSubmit} className="flex flex-col gap-4">
          <div className="flex flex-col gap-2">
            <Label htmlFor="feedback-category">Categoria</Label>
            <select
              id="feedback-category"
              value={category}
              onChange={(event) => setCategory(event.target.value as UserFeedbackCategory)}
              className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
            >
              {CATEGORY_OPTIONS.map((option) => (
                <option key={option} value={option}>
                  {CATEGORY_LABELS[option]}
                </option>
              ))}
            </select>
          </div>

          <div className="flex flex-col gap-2">
            <Label htmlFor="feedback-description">Descrição</Label>
            <Textarea
              id="feedback-description"
              value={description}
              onChange={(event) => setDescription(event.target.value)}
              placeholder="Conte com detalhes o que você notou..."
              required
            />
          </div>

          {error ? <p className="text-sm text-destructive">{error}</p> : null}

          <div className="flex justify-end gap-2">
            <Button type="button" variant="ghost" onClick={handleClose}>
              Cancelar
            </Button>
            <Button type="submit" disabled={submitting}>
              {submitting ? "Enviando..." : "Enviar"}
            </Button>
          </div>
        </form>
      </Dialog>

      {showToast ? (
        <div className="fixed bottom-6 right-6 z-50 rounded-md border border-border bg-background px-4 py-3 text-sm text-foreground shadow-lg">
          Feedback enviado. Obrigado!
        </div>
      ) : null}
    </>
  );
}
