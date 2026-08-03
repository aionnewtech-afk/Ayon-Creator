"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import type { SynthesisFieldEntry } from "@ayon/core";
import { Button, Card, CardContent, Textarea, cn } from "@ayon/ui";
import { navItemHref, NAV_ITEMS } from "@/config/navigation";
import {
  confirmOnboardingSynthesisAction,
  sendOnboardingMessageAction,
  updateBrandBrainFieldAction,
} from "../actions";
import { KnowledgePanel } from "./knowledge-panel";
import { SynthesisFieldCard } from "./synthesis-field-card";

interface ChatMessage {
  role: "user" | "ayon";
  text: string;
}

export interface OnboardingChatProps {
  brandId: string;
  brandName: string;
  initialMessages: ChatMessage[];
  initialChips: string[];
  initiallyCompleted: boolean;
  initialSynthesis: SynthesisFieldEntry[] | null;
}

type Mode = "chat" | "reviewing" | "confirmed";

export function OnboardingChat({
  brandName,
  initialMessages,
  initialChips,
  initiallyCompleted,
  initialSynthesis,
}: OnboardingChatProps) {
  const [mode, setMode] = useState<Mode>(initiallyCompleted ? "reviewing" : "chat");
  const [messages, setMessages] = useState<ChatMessage[]>(initialMessages);
  const [chips, setChips] = useState<string[]>(initialChips);
  const [synthesis, setSynthesis] = useState<SynthesisFieldEntry[]>(initialSynthesis ?? []);
  const [pending, setPending] = useState(false);
  const [confirming, setConfirming] = useState(false);
  const [inputValue, setInputValue] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [showResumeBanner] = useState(initialMessages.length > 0 && !initiallyCompleted);
  const kickoffTriggered = useRef(false);
  const scrollAnchorRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (mode === "chat" && messages.length === 0 && !kickoffTriggered.current) {
      kickoffTriggered.current = true;
      void sendTurn(null);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    scrollAnchorRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages, pending]);

  async function sendTurn(message: string | null) {
    setPending(true);
    setError(null);

    if (message) {
      setMessages((prev) => [...prev, { role: "user", text: message }]);
    }

    const result = await sendOnboardingMessageAction(message);
    setPending(false);

    if (!result.ok || !result.reply) {
      setError(result.error ?? "Algo deu errado. Tenta de novo?");
      return;
    }

    setMessages((prev) => [...prev, { role: "ayon", text: result.reply! }]);

    if (result.knowledgeChip) {
      setChips((prev) => [...prev, result.knowledgeChip!]);
    }

    if (result.conversationComplete) {
      setSynthesis(result.synthesis ?? []);
      setMode("reviewing");
    }
  }

  function handleSubmit(event: React.FormEvent) {
    event.preventDefault();
    const trimmed = inputValue.trim();
    if (!trimmed || pending) return;
    setInputValue("");
    void sendTurn(trimmed);
  }

  async function handleFieldSave(questionKey: SynthesisFieldEntry["questionKey"], value: string) {
    const result = await updateBrandBrainFieldAction(questionKey, value);
    if (result.ok) {
      setSynthesis((prev) =>
        prev.map((field) => (field.questionKey === questionKey ? { ...field, value } : field)),
      );
    }
    return result;
  }

  async function handleConfirm() {
    setConfirming(true);
    const result = await confirmOnboardingSynthesisAction();
    setConfirming(false);
    if (result.ok) {
      setMode("confirmed");
    } else {
      setError(result.error ?? "Não consegui confirmar agora. Tenta de novo?");
    }
  }

  if (mode === "confirmed") {
    const criarCampanha = NAV_ITEMS.find((item) => item.slug === "criar-campanha");
    return (
      <div className="mx-auto max-w-xl space-y-6 py-16 text-center">
        <h1 className="text-2xl font-semibold text-foreground">Pronto — a Ayon entrou pro time</h1>
        <p className="text-muted-foreground">
          A partir de agora eu penso na {brandName} como parte do que eu faço — toda campanha que eu
          ajudar a criar vai passar por esse entendimento. E isso não precisa parar aqui: sempre que
          você quiser me contar mais, a conversa continua em &quot;Ensine sua empresa pra IA&quot;.
        </p>
        <div className="flex flex-col items-center gap-3 sm:flex-row sm:justify-center">
          {criarCampanha ? (
            <Link href={navItemHref(criarCampanha)}>
              <Button size="lg">Vamos criar sua primeira campanha</Button>
            </Link>
          ) : null}
          <Link href="/conheca-sua-empresa/perfil">
            <Button variant="ghost">Ver o que aprendi, com calma</Button>
          </Link>
        </div>
      </div>
    );
  }

  if (mode === "reviewing") {
    return (
      <div className="mx-auto max-w-2xl space-y-6 py-8">
        <div className="space-y-1">
          <h1 className="text-xl font-semibold text-foreground">O que eu entendi até agora</h1>
          <p className="text-sm text-muted-foreground">
            Me corrija se eu peguei algo errado — quero começar com o pé direito.
          </p>
        </div>

        <div className="space-y-3">
          {synthesis.map((field) => (
            <SynthesisFieldCard key={field.questionKey} field={field} onSave={handleFieldSave} />
          ))}
        </div>

        {error ? <p className="text-sm text-destructive">{error}</p> : null}

        <Button size="lg" onClick={handleConfirm} disabled={confirming}>
          {confirming ? "Confirmando..." : "Isso mesmo, pode seguir"}
        </Button>
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-6 lg:flex-row">
      <div className="flex flex-1 flex-col gap-4">
        {showResumeBanner ? (
          <div className="rounded-md bg-secondary/60 px-4 py-2 text-sm text-secondary-foreground">
            Bem-vindo de volta! Vamos continuar a conversa sobre a {brandName}.
          </div>
        ) : null}

        <Card className="flex min-h-[60vh] flex-col">
          <CardContent className="flex flex-1 flex-col gap-4 overflow-y-auto pt-6">
            {messages.map((message, index) => (
              <div
                key={index}
                className={cn("flex", message.role === "user" ? "justify-end" : "justify-start")}
              >
                <div
                  className={cn(
                    "max-w-[80%] rounded-lg px-4 py-2 text-sm",
                    message.role === "user"
                      ? "bg-primary text-primary-foreground"
                      : "bg-secondary text-secondary-foreground",
                  )}
                >
                  {message.text}
                </div>
              </div>
            ))}

            {pending ? (
              <div className="flex justify-start">
                <div className="flex items-center gap-1 rounded-lg bg-secondary px-4 py-3">
                  <span className="h-1.5 w-1.5 animate-bounce rounded-full bg-secondary-foreground/60 [animation-delay:-0.3s]" />
                  <span className="h-1.5 w-1.5 animate-bounce rounded-full bg-secondary-foreground/60 [animation-delay:-0.15s]" />
                  <span className="h-1.5 w-1.5 animate-bounce rounded-full bg-secondary-foreground/60" />
                </div>
              </div>
            ) : null}

            <div ref={scrollAnchorRef} />
          </CardContent>
        </Card>

        {error ? <p className="text-sm text-destructive">{error}</p> : null}

        <form onSubmit={handleSubmit} className="flex gap-2">
          <Textarea
            value={inputValue}
            onChange={(event) => setInputValue(event.target.value)}
            onKeyDown={(event) => {
              if (event.key === "Enter" && !event.shiftKey) {
                event.preventDefault();
                handleSubmit(event);
              }
            }}
            placeholder="Escreva sua resposta..."
            className="min-h-[52px] resize-none"
            disabled={pending}
          />
          <Button type="submit" disabled={pending || !inputValue.trim()}>
            Enviar
          </Button>
        </form>
      </div>

      <div className="lg:w-72 lg:shrink-0">
        <KnowledgePanel brandName={brandName} chips={chips} />
      </div>
    </div>
  );
}
