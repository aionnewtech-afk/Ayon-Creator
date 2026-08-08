const SEASON_BY_MONTH_SOUTHERN_HEMISPHERE = [
  "verão",
  "verão",
  "outono",
  "outono",
  "outono",
  "inverno",
  "inverno",
  "inverno",
  "primavera",
  "primavera",
  "primavera",
  "verão",
] as const;

/**
 * Contexto temporal (data/mês/ano/sazonalidade/país) — achado real, sprint
 * de estabilização: nenhum prompt do produto (Intelligence Hub, Trend
 * Source Provider) injetava a data atual, então o modelo raciocinava só com
 * base no conhecimento de treino, citando datas/eventos antigos como se
 * fossem atuais e trazendo os mesmos resultados repetidamente em buscas de
 * tendências. Sazonalidade calculada para o hemisfério sul (o
 * público/mercado do produto é o Brasil) — nunca assume hemisfério norte.
 * Vive em `shared/` (não em `intelligence-hub/`) porque também é usado pelo
 * Provider Layer (`anthropic-web-search-trend-source-provider.ts`), uma
 * camada mais baixa que nunca deveria importar de cima.
 */
export function buildTemporalContextBlock(now: Date = new Date()): string {
  const longDate = new Intl.DateTimeFormat("pt-BR", { dateStyle: "full", timeZone: "America/Sao_Paulo" }).format(now);
  const month = new Intl.DateTimeFormat("pt-BR", { month: "long", timeZone: "America/Sao_Paulo" }).format(now);
  const year = new Intl.DateTimeFormat("pt-BR", { year: "numeric", timeZone: "America/Sao_Paulo" }).format(now);
  const monthIndex = Number(new Intl.DateTimeFormat("en-US", { month: "numeric", timeZone: "America/Sao_Paulo" }).format(now)) - 1;
  const season = SEASON_BY_MONTH_SOUTHERN_HEMISPHERE[monthIndex];

  return (
    `Contexto temporal (use isto como a data real de hoje, nunca uma data do seu conhecimento de treino): ` +
    `hoje é ${longDate}, mês de ${month} de ${year}. País/mercado: Brasil (hemisfério sul — estação atual: ${season}). ` +
    `Nunca cite datas, eventos ou tendências passadas como se fossem atuais ou futuras.`
  );
}
