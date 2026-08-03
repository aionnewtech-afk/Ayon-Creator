/**
 * Cabeçalho qualitativo do painel "O que a Ayon já sabe" (ux-design.md §4.10)
 * — nunca uma fração ou contagem (Princípio do Consultor Permanente, PRD §1.1,
 * item 4). Varia só pela quantidade de insights já sintetizados, não por
 * quantos campos/perguntas faltam.
 */
export function knowledgePanelHeadline(chipCount: number, brandName: string): string {
  if (chipCount <= 1) return "Começando a te conhecer";
  if (chipCount <= 4) return "Já tenho uma ideia boa de quem vocês são";
  return `Tenho uma visão sólida da ${brandName}`;
}
