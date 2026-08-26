"use client";

import { useEffect, useRef, useState } from "react";
import { Button, Input, Label } from "@ayon/ui";
import {
  addBrandAvatarLookAction,
  createAvatarUploadSlotAction,
  createBrandAvatarAction,
  listAllAvatarLooksAction,
  refreshBrandAvatarLooksAction,
  refreshBrandAvatarStatusAction,
  regenerateConsentLinkAction,
  removeBrandAvatarLookAction,
  setDefaultAvatarLookAction,
  type AvatarGroupLookView,
} from "./identity-actions";

/** ★ Achado real (validado com uma chamada real ao slot de upload — `max_bytes` na resposta): 209715200 bytes = exatos 200MB, teto real da HeyGen pro upload direto de asset (bem maior que os 32MB do envio por URL). Teto só pra UX (aviso antes de tentar) — o upload vai direto do navegador pra um slot S3 pré-assinado da própria HeyGen, nunca passa pelo nosso servidor nem pelo Supabase. */
const MAX_AVATAR_VIDEO_SIZE_BYTES = 200 * 1024 * 1024;

export interface AvatarLookSummary {
  lookId: string;
  name: string;
  status: string;
}

export interface AvatarSectionProps {
  avatarName: string | null;
  avatarLookId: string | null;
  avatarConsentStatus: string | null;
  avatarTrainingStatus: string | null;
  avatarReady: boolean;
  hasAvatarInProgress: boolean;
  avatarLooks: AvatarLookSummary[];
}

/**
 * ★ Achado real (pedido direto do usuário — "iniciar o avatar do porta voz
 * da empresa"): "digital twin" HeyGen — sobe um vídeo real de alguém da
 * empresa, a HeyGen treina o clone e exige a própria pessoa confirmar
 * consentimento (link hospedado por eles) antes de liberar geração de
 * vídeo com o avatar. Fluxo em 2 fases (criar → acompanhar status) porque
 * a espera pelo consentimento é humana, pode levar até 24h — nunca um
 * polling síncrono dentro da mesma ação.
 */
export function AvatarSection({
  avatarName,
  avatarConsentStatus,
  avatarLookId,
  avatarTrainingStatus,
  avatarReady,
  hasAvatarInProgress,
  avatarLooks,
}: AvatarSectionProps) {
  const [submitting, setSubmitting] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [consentUrl, setConsentUrl] = useState<string | null>(null);
  const [consentStatus, setConsentStatus] = useState(avatarConsentStatus);
  const [trainingStatus, setTrainingStatus] = useState(avatarTrainingStatus);
  const [ready, setReady] = useState(avatarReady);
  const [createdNow, setCreatedNow] = useState(false);

  const [looks, setLooks] = useState<AvatarLookSummary[]>(avatarLooks);
  const [looksSubmitting, setLooksSubmitting] = useState(false);
  const [looksError, setLooksError] = useState<string | null>(null);
  const [lookConsentUrl, setLookConsentUrl] = useState<string | null>(null);
  const [removingLookId, setRemovingLookId] = useState<string | null>(null);

  // ★ Achado real (pedido direto do usuário — "no meu caso que tenho vários
  // avatar no HeyGen, ele liste todos e que eu possa escolher qual será o
  // padrão"): lista sob demanda (custa 1 chamada real à HeyGen) — nunca
  // carrega sozinho, só quando o usuário pede.
  const [allLooks, setAllLooks] = useState<AvatarGroupLookView[] | null>(null);
  const [allLooksLoading, setAllLooksLoading] = useState(false);
  const [allLooksError, setAllLooksError] = useState<string | null>(null);
  const [settingDefaultLookId, setSettingDefaultLookId] = useState<string | null>(null);

  // ★ Achado real (pedido direto do usuário — "fica só processing", depois
  // de o look já ter terminado de verdade na HeyGen fazia tempo sem
  // ninguém clicar em "Atualizar status"): enquanto existir algum look
  // "processing", consulta sozinho a cada alguns segundos — mesmo padrão de
  // polling já usado em `content-package-review.tsx` pra geração de vídeo.
  const looksPollingRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const LOOKS_POLL_INTERVAL_MS = 8000;

  useEffect(() => {
    const hasProcessing = looks.some((look) => look.status === "processing");

    if (!hasProcessing) {
      if (looksPollingRef.current) {
        clearInterval(looksPollingRef.current);
        looksPollingRef.current = null;
      }
      return;
    }

    if (looksPollingRef.current) return;

    looksPollingRef.current = setInterval(async () => {
      const result = await refreshBrandAvatarLooksAction();
      if (result.ok) setLooks(result.looks ?? []);
    }, LOOKS_POLL_INTERVAL_MS);

    return () => {
      if (looksPollingRef.current) {
        clearInterval(looksPollingRef.current);
        looksPollingRef.current = null;
      }
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [looks]);

  async function handleCreate(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError(null);

    const formData = new FormData(event.currentTarget);
    const name = String(formData.get("name") ?? "").trim();
    const file = formData.get("trainingVideo");

    if (!name) {
      setError("Dê um nome para o avatar (ex.: o nome do porta-voz).");
      return;
    }
    if (!(file instanceof File) || file.size === 0) {
      setError("Envie o vídeo de treinamento do porta-voz.");
      return;
    }
    if (file.size > MAX_AVATAR_VIDEO_SIZE_BYTES) {
      setError("Esse vídeo é maior que 200MB (teto da HeyGen) — tenta um arquivo menor?");
      return;
    }
    if (!file.type.startsWith("video/")) {
      setError("Envie um arquivo de vídeo.");
      return;
    }

    setSubmitting(true);

    try {
      // ★ Achado real (visto ao vivo, 2 causas reais em sequência — vídeo de
      // 80MB derrubou o servidor de dev com "JavaScript heap out of
      // memory"; depois, mesmo indo direto pro Supabase Storage, um vídeo
      // de 46.8MB — dentro do teto do Supabase — ainda foi rejeitado pela
      // HeyGen ao tentar buscar a URL: "Maximum size for URL inputs...
      // is 32 MB"): nem passar pelo nosso servidor, nem guardar cópia no
      // Supabase primeiro — pede um slot de upload S3 pré-assinado direto
      // na HeyGen (`createAvatarUploadSlotAction`, só metadados) e o PUT
      // dos bytes vai direto do navegador pra lá.
      const slot = await createAvatarUploadSlotAction(file.name, file.type, file.size);
      if (!slot.ok || !slot.assetId || !slot.uploadUrl) {
        setError(slot.error ?? "Não consegui preparar o envio do vídeo agora.");
        return;
      }

      const uploadResponse = await fetch(slot.uploadUrl, {
        method: "PUT",
        headers: slot.uploadHeaders,
        body: file,
      });
      if (!uploadResponse.ok) {
        throw new Error(`Envio do vídeo falhou (${uploadResponse.status}).`);
      }

      const result = await createBrandAvatarAction({ name, assetId: slot.assetId });
      if (!result.ok) {
        setError(result.error ?? "Algo deu errado. Tenta de novo?");
        return;
      }
      setConsentUrl(result.consentUrl ?? null);
      setConsentStatus("pending");
      setTrainingStatus("processing");
      setCreatedNow(true);
    } catch (uploadOrCreateError) {
      // ★ Achado real: erro genérico já escondeu causas reais diferentes
      // nesta sessão (limite de corpo de requisição, estouro de memória,
      // teto de tamanho do Supabase) — sempre que houver uma mensagem real
      // disponível, mostra ela direto, nunca escondida atrás de um texto
      // genérico de novo.
      const message = uploadOrCreateError instanceof Error ? uploadOrCreateError.message : null;
      setError(message ? `Não consegui enviar o vídeo: ${message}` : "Não consegui enviar o vídeo agora. Tenta de novo?");
    } finally {
      setSubmitting(false);
    }
  }

  async function handleRefresh() {
    setRefreshing(true);
    setError(null);
    try {
      const result = await refreshBrandAvatarStatusAction();
      if (!result.ok) {
        setError(result.error ?? "Algo deu errado. Tenta de novo?");
        return;
      }
      setConsentStatus(result.consentStatus ?? null);
      setTrainingStatus(result.trainingStatus ?? null);
      setReady(result.ready ?? false);
    } catch {
      setError("Não consegui verificar o status agora. Tenta de novo?");
    } finally {
      setRefreshing(false);
    }
  }

  async function handleRegenerateLink() {
    setRefreshing(true);
    setError(null);
    try {
      const result = await regenerateConsentLinkAction();
      if (!result.ok) {
        setError(result.error ?? "Algo deu errado. Tenta de novo?");
        return;
      }
      setConsentUrl(result.consentUrl ?? null);
    } catch {
      setError("Não consegui gerar o link agora. Tenta de novo?");
    } finally {
      setRefreshing(false);
    }
  }

  async function handleAddLook(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setLooksError(null);

    // ★ Achado real (visto ao vivo — "Cannot read properties of null
    // (reading 'reset')"): `event.currentTarget` vira null depois do 1º
    // `await` (React limpa o SyntheticEvent assim que o handler devolve o
    // controle) — precisa guardar a referência do form ANTES de qualquer
    // chamada assíncrona, nunca reler `event.currentTarget` depois.
    const formEl = event.currentTarget;
    const formData = new FormData(formEl);
    const name = String(formData.get("lookName") ?? "").trim();
    const file = formData.get("lookVideo");

    if (!name) {
      setLooksError("Dê um nome para esse look (ex.: \"Casual\", \"Escritório\").");
      return;
    }
    if (!(file instanceof File) || file.size === 0) {
      setLooksError("Envie o vídeo desse novo look.");
      return;
    }
    if (file.size > MAX_AVATAR_VIDEO_SIZE_BYTES) {
      setLooksError("Esse vídeo é maior que 200MB (teto da HeyGen) — tenta um arquivo menor?");
      return;
    }
    if (!file.type.startsWith("video/")) {
      setLooksError("Envie um arquivo de vídeo.");
      return;
    }

    setLooksSubmitting(true);

    try {
      const slot = await createAvatarUploadSlotAction(file.name, file.type, file.size);
      if (!slot.ok || !slot.assetId || !slot.uploadUrl) {
        setLooksError(slot.error ?? "Não consegui preparar o envio do vídeo agora.");
        return;
      }

      const uploadResponse = await fetch(slot.uploadUrl, {
        method: "PUT",
        headers: slot.uploadHeaders,
        body: file,
      });
      if (!uploadResponse.ok) {
        throw new Error(`Envio do vídeo falhou (${uploadResponse.status}).`);
      }

      const result = await addBrandAvatarLookAction({ name, assetId: slot.assetId });
      if (!result.ok) {
        setLooksError(result.error ?? "Algo deu errado. Tenta de novo?");
        return;
      }

      setLooks((prev) => [...prev, { lookId: result.lookId ?? "", name, status: "processing" }]);
      setLookConsentUrl(result.consentUrl ?? null);
      formEl.reset();
    } catch (uploadOrCreateError) {
      const message = uploadOrCreateError instanceof Error ? uploadOrCreateError.message : null;
      setLooksError(message ? `Não consegui enviar o vídeo: ${message}` : "Não consegui enviar o vídeo agora. Tenta de novo?");
    } finally {
      setLooksSubmitting(false);
    }
  }

  async function handleRemoveLook(lookId: string) {
    setRemovingLookId(lookId);
    setLooksError(null);
    try {
      const result = await removeBrandAvatarLookAction(lookId);
      if (!result.ok) {
        setLooksError(result.error ?? "Algo deu errado. Tenta de novo?");
        return;
      }
      setLooks(result.looks ?? []);
    } catch {
      setLooksError("Não consegui remover esse look agora. Tenta de novo?");
    } finally {
      setRemovingLookId(null);
    }
  }

  async function handleRefreshLooks() {
    setLooksSubmitting(true);
    setLooksError(null);
    try {
      const result = await refreshBrandAvatarLooksAction();
      if (!result.ok) {
        setLooksError(result.error ?? "Algo deu errado. Tenta de novo?");
        return;
      }
      setLooks(result.looks ?? []);
    } catch {
      setLooksError("Não consegui verificar o status agora. Tenta de novo?");
    } finally {
      setLooksSubmitting(false);
    }
  }

  async function handleLoadAllLooks() {
    setAllLooksLoading(true);
    setAllLooksError(null);
    try {
      const result = await listAllAvatarLooksAction();
      if (!result.ok) {
        setAllLooksError(result.error ?? "Algo deu errado. Tenta de novo?");
        return;
      }
      setAllLooks(result.looks ?? []);
    } catch {
      setAllLooksError("Não consegui buscar os avatares agora. Tenta de novo?");
    } finally {
      setAllLooksLoading(false);
    }
  }

  const [defaultLookChanged, setDefaultLookChanged] = useState(false);

  async function handleSetDefaultLook(lookId: string) {
    setSettingDefaultLookId(lookId);
    setAllLooksError(null);
    try {
      const result = await setDefaultAvatarLookAction(lookId);
      if (!result.ok) {
        setAllLooksError(result.error ?? "Algo deu errado. Tenta de novo?");
        return;
      }
      // ★ Trocar o padrão zera `avatar_ready` no servidor (força novo
      // status antes de gerar de novo, nunca herda o "pronto" do look
      // anterior) — nunca escondido do usuário, mas também nunca colapsa a
      // seção "Todos os avatares" na hora (`ready` continua como estava até
      // um refresh real, pra não sumir a tela debaixo do clique).
      setDefaultLookChanged(true);
    } catch {
      setAllLooksError("Não consegui trocar o padrão agora. Tenta de novo?");
    } finally {
      setSettingDefaultLookId(null);
    }
  }

  const showProgress = hasAvatarInProgress || createdNow;

  return (
    <div className="space-y-4 rounded-lg border border-border p-5">
      <div className="space-y-1">
        <h2 className="text-base font-semibold text-foreground">Porta-voz (avatar)</h2>
        <p className="text-sm text-muted-foreground">
          Um &quot;gêmeo digital&quot; treinado a partir de um vídeo real de alguém da empresa — fala qualquer
          roteiro com a cara e a voz da pessoa. A HeyGen exige que a própria pessoa confirme consentimento antes de
          liberar o uso.
        </p>
      </div>

      {ready ? (
        <div className="space-y-4">
          <p className="text-sm text-foreground">
            Avatar &quot;{avatarName}&quot; pronto para uso — já pode ser escolhido como porta-voz ao gerar vídeo.
          </p>

          <div className="space-y-3 rounded-md border border-border/60 bg-secondary/20 p-4">
            <div className="space-y-1">
              <h3 className="text-sm font-semibold text-foreground">Novo look (ângulo/roupa diferente)</h3>
              <p className="text-xs text-muted-foreground">
                Envie outro vídeo real da mesma pessoa (roupa, cenário ou ângulo diferentes) — treina um look novo
                mantendo o rosto real, sem precisar de outro consentimento. Depois, escolha qual look usar na hora de
                gerar cada vídeo.
              </p>
            </div>

            {looks.length > 0 ? (
              <ul className="space-y-1 text-sm text-foreground">
                {looks.map((look) => (
                  <li key={look.lookId} className="flex items-center justify-between gap-2 rounded bg-background/60 px-2 py-1">
                    <span>{look.name}</span>
                    <span className="flex items-center gap-2">
                      <span className="text-xs text-muted-foreground">{look.status}</span>
                      <Button
                        type="button"
                        size="sm"
                        variant="ghost"
                        disabled={removingLookId === look.lookId}
                        onClick={() => handleRemoveLook(look.lookId)}
                      >
                        {removingLookId === look.lookId ? "Removendo..." : "Remover"}
                      </Button>
                    </span>
                  </li>
                ))}
              </ul>
            ) : null}

            {lookConsentUrl ? (
              <p className="break-all text-xs text-foreground">
                Esse look ainda precisa de consentimento — envie este link pro porta-voz gravar pela webcam:{" "}
                <a href={lookConsentUrl} target="_blank" rel="noreferrer" className="underline">
                  {lookConsentUrl}
                </a>
              </p>
            ) : null}

            <form onSubmit={handleAddLook} className="space-y-2">
              <div className="space-y-1">
                <Label htmlFor="look-name">Nome do look</Label>
                <Input id="look-name" name="lookName" placeholder="Ex.: Casual, Escritório" />
              </div>
              <div className="space-y-1">
                <Label htmlFor="look-video">Vídeo desse look</Label>
                <Input id="look-video" name="lookVideo" type="file" accept="video/*" />
              </div>
              {looksError ? <p className="text-sm text-destructive">{looksError}</p> : null}
              <div className="flex flex-wrap gap-2 pt-1">
                <Button type="submit" size="sm" disabled={looksSubmitting}>
                  {looksSubmitting ? "Enviando..." : "Adicionar look"}
                </Button>
                {looks.some((look) => look.status === "processing") ? (
                  <Button type="button" size="sm" variant="outline" disabled={looksSubmitting} onClick={handleRefreshLooks}>
                    Atualizar status
                  </Button>
                ) : null}
              </div>
            </form>
          </div>

          <div className="space-y-3 rounded-md border border-border/60 bg-secondary/20 p-4">
            <div className="space-y-1">
              <h3 className="text-sm font-semibold text-foreground">Todos os avatares (HeyGen)</h3>
              <p className="text-xs text-muted-foreground">
                Sua conta HeyGen pode ter mais avatares/looks do que os criados por aqui — busca direto na HeyGen e
                deixa escolher qual é o padrão.
              </p>
            </div>

            {allLooks === null ? (
              <Button type="button" size="sm" variant="outline" disabled={allLooksLoading} onClick={handleLoadAllLooks}>
                {allLooksLoading ? "Buscando..." : "Ver todos os avatares"}
              </Button>
            ) : (
              <div className="space-y-2">
                {defaultLookChanged ? (
                  <p className="text-xs text-foreground">
                    Padrão trocado — clique em &quot;Atualizar status&quot; (acima, se aparecer) pra confirmar quando
                    esse look estiver pronto pra uso.
                  </p>
                ) : null}
                {allLooksError ? <p className="text-xs text-destructive">{allLooksError}</p> : null}

                <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
                  Treinados de vídeo real (rosto seu de verdade)
                </p>
                <ul className="space-y-1 text-sm text-foreground">
                  {allLooks
                    .filter((look) => look.trained)
                    .map((look) => (
                      <li
                        key={look.lookId}
                        className="flex items-center justify-between gap-2 rounded bg-background/60 px-2 py-1"
                      >
                        <span>{look.name}</span>
                        {look.lookId === avatarLookId ? (
                          <span className="text-xs text-muted-foreground">Padrão atual</span>
                        ) : (
                          <Button
                            type="button"
                            size="sm"
                            variant="outline"
                            disabled={settingDefaultLookId === look.lookId}
                            onClick={() => handleSetDefaultLook(look.lookId)}
                          >
                            {settingDefaultLookId === look.lookId ? "Aplicando..." : "Usar como padrão"}
                          </Button>
                        )}
                      </li>
                    ))}
                </ul>

                {allLooks.some((look) => !look.trained) ? (
                  <details className="text-xs text-muted-foreground">
                    <summary className="cursor-pointer select-none">
                      + {allLooks.filter((look) => !look.trained).length} gerados automaticamente pela HeyGen (não
                      recomendado)
                    </summary>
                    <p className="mt-1">
                      Esses foram criados pela própria HeyGen a partir de 1 foto, não do seu vídeo real — não
                      preservam sua identidade de forma confiável, por isso não podem virar padrão por aqui.
                    </p>
                    <ul className="mt-1 space-y-1">
                      {allLooks
                        .filter((look) => !look.trained)
                        .map((look) => (
                          <li key={look.lookId} className="rounded bg-background/40 px-2 py-1">
                            {look.name}
                          </li>
                        ))}
                    </ul>
                  </details>
                ) : null}
              </div>
            )}
          </div>
        </div>
      ) : showProgress ? (
        <div className="space-y-2 rounded-md bg-secondary/40 p-3 text-sm text-foreground">
          <p>Consentimento: {consentStatus ?? "pendente"}</p>
          <p>Treinamento: {trainingStatus ?? "processando"}</p>
          {consentUrl ? (
            <p className="break-all">
              Envie este link pro porta-voz gravar o consentimento pela webcam (válido por ~24h):{" "}
              <a href={consentUrl} target="_blank" rel="noreferrer" className="underline">
                {consentUrl}
              </a>
            </p>
          ) : (
            <p className="text-muted-foreground">
              Link de consentimento já enviado antes. Se foi perdido, gere um novo abaixo.
            </p>
          )}
          {error ? <p className="text-destructive">{error}</p> : null}
          <div className="flex flex-wrap gap-2 pt-1">
            <Button size="sm" variant="outline" disabled={refreshing} onClick={handleRefresh}>
              {refreshing ? "Verificando..." : "Atualizar status"}
            </Button>
            <Button size="sm" variant="ghost" disabled={refreshing} onClick={handleRegenerateLink}>
              Gerar novo link de consentimento
            </Button>
          </div>
        </div>
      ) : (
        <form onSubmit={handleCreate} className="space-y-3">
          <div className="space-y-2">
            <Label htmlFor="avatar-name">Nome do porta-voz</Label>
            <Input id="avatar-name" name="name" placeholder="Ex.: João, dono da agência" />
          </div>
          <div className="space-y-2">
            <Label htmlFor="avatar-video">Vídeo de treinamento</Label>
            <p className="text-xs text-muted-foreground">
              Vídeo real da pessoa (rosto único e visível, áudio claro) — a HeyGen usa ele pra treinar a fala,
              expressões e movimento do avatar, e clona a voz junto.
            </p>
            <Input id="avatar-video" name="trainingVideo" type="file" accept="video/*" />
          </div>
          {error ? <p className="text-sm text-destructive">{error}</p> : null}
          <Button type="submit" disabled={submitting}>
            {submitting ? "Enviando..." : "Criar avatar"}
          </Button>
        </form>
      )}
    </div>
  );
}
