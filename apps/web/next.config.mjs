import path from "node:path";

/** @type {import('next').NextConfig} */
const nextConfig = {
  transpilePackages: ["@ayon/ui", "@ayon/core", "@ayon/types"],
  // Hardening (Missão H1, item 5.2): silencia o aviso de "múltiplos
  // lockfiles" que a migração para o Next 15 passou a emitir — há um
  // package-lock.json solto fora do repositório (não relacionado a este
  // projeto, que usa pnpm) que o Next tentava usar para inferir a raiz do
  // workspace.
  outputFileTracingRoot: path.join(process.cwd(), "../.."),
  // pdf-parse (usado por @ayon/core para extração de texto — Missão 4) faz
  // acesso a `fs` que o webpack não consegue empacotar; roda só em Node
  // runtime (Server Actions), nunca em client/edge, então basta não empacotar.
  // ★ Hardening (Missão H1, item 5.2 — Next.js 15): `serverComponentsExternalPackages`
  // virou chave estável de topo (`serverExternalPackages`); `serverActions`
  // continua em `experimental` mesmo no Next 15.5 (confirmado no tipo
  // `ExperimentalConfig` do pacote instalado).
  // sharp (Sprint de estabilização, Missão 12 — detecção de divergência de
  // cor da logo) tem binding nativo (libvips) — mesmo motivo do pdf-parse,
  // webpack não consegue empacotar `node:child_process`/`node:fs` que o
  // detect-libc (dependência do sharp) usa internamente.
  serverExternalPackages: ["pdf-parse", "sharp"],
  experimental: {
    // Hardening (Missão H1, docs/hardening-plan.md item 5.3b): o default do
    // Next.js é 1MB — nenhum upload real (KB até 10MB, own_media até 20MB)
    // passava disso. Nunca foi pego em validação porque todo teste de
    // upload usou arquivos sintéticos minúsculos.
    //
    // ★ Achado real (pedido direto do usuário — "iniciar o avatar do porta
    // voz da empresa"): vídeo de treinamento do avatar (HeyGen) sobe até
    // 200MB (`MAX_AVATAR_VIDEO_SIZE_BYTES`, identity-actions.ts) — real,
    // visto ao vivo: com o limite antigo de 20MB, o upload falhava "por
    // baixo" (fora do try/catch da Server Action, a requisição nem chega a
    // executar o código) e o botão ficava preso em "Enviando..." pra
    // sempre, sem nenhum erro visível. 200MB cobre o maior teto aceito hoje
    // (avatar); a Server Action de cada rota ainda valida seu próprio teto
    // específico (10MB para KB, 20MB para own_media, 200MB para avatar).
    serverActions: {
      bodySizeLimit: "200mb",
    },
    // ★ Achado real (mesmo pedido — visto ao vivo com um vídeo de 80MB):
    // `serverActions.bodySizeLimit` acima só cobre o limite da própria
    // Server Action — o `middleware.ts` (checagem de sessão, roda em TODA
    // rota) tem um teto SEPARADO e independente, 10MB por padrão, sem
    // relação com o de cima. Acima do teto do middleware, o corpo da
    // requisição é truncado nos primeiros 10MB (nunca falha ali mesmo) e só
    // estoura como "Unexpected end of form" quando a Server Action tenta
    // interpretar o multipart cortado — daí o erro genérico de rede no
    // cliente, sem nenhum erro vindo do código da action. Precisa dos DOIS
    // limites configurados, nunca só um.
    middlewareClientMaxBodySize: "200mb",
  },
};

export default nextConfig;
