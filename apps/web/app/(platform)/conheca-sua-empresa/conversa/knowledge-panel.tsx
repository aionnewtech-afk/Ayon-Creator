"use client";

import { Sparkles } from "lucide-react";
import { knowledgePanelHeadline } from "@ayon/core";
import { Card, CardContent, CardHeader, CardTitle } from "@ayon/ui";

export interface KnowledgePanelProps {
  brandName: string;
  chips: string[];
}

/**
 * Painel "O que a Ayon já sabe" (ux-design.md §4.10) — substitui qualquer
 * barra de progresso por contagem. Cresce com insights sintetizados, nunca
 * com respostas cruas; o cabeçalho muda qualitativamente, nunca em fração
 * (Princípio do Consultor Permanente, PRD §1.1, item 4).
 */
export function KnowledgePanel({ brandName, chips }: KnowledgePanelProps) {
  return (
    <Card className="h-fit">
      <CardHeader className="pb-3">
        <CardTitle className="flex items-center gap-2 text-sm font-semibold text-muted-foreground">
          <Sparkles className="h-4 w-4" aria-hidden="true" />
          {knowledgePanelHeadline(chips.length, brandName)}
        </CardTitle>
      </CardHeader>
      <CardContent className="flex flex-col gap-2 pt-0">
        {chips.length === 0 ? (
          <p className="text-sm text-muted-foreground">
            Assim que a conversa começar, o que a Ayon for entendendo aparece aqui.
          </p>
        ) : (
          chips.map((chip, index) => (
            <div
              key={`${index}-${chip}`}
              className="animate-in fade-in rounded-md bg-secondary/60 px-3 py-2 text-sm text-secondary-foreground"
            >
              {chip}
            </div>
          ))
        )}
      </CardContent>
    </Card>
  );
}
