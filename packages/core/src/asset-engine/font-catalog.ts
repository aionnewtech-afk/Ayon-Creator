/**
 * Catálogo curado de fontes (arch. §14.1) — o Shotstack não usa
 * @font-face/webfont, só TTF auto-hospedado referenciado por URL (achado da
 * auditoria). Em vez de exigir que o usuário hospede o próprio arquivo, um
 * pequeno conjunto de fontes Google Fonts populares é pré-mapeado para uma
 * URL de arquivo TTF estável (repositório oficial `google/fonts` no
 * GitHub — mesmo espírito de simplicidade do catálogo de vozes). Cada URL
 * validada com uma requisição real antes de entrar aqui.
 *
 * `brands.font_family` é texto livre (o usuário digita um nome) — quando
 * não bate com nenhuma entrada do catálogo (nome digitado livremente, fonte
 * não suportada), a composição cai na fonte padrão do Shotstack, nunca
 * bloqueia a geração.
 */
export interface FontCatalogEntry {
  family: string;
  ttfUrl: string;
}

export const FONT_CATALOG: FontCatalogEntry[] = [
  { family: "Poppins", ttfUrl: "https://raw.githubusercontent.com/google/fonts/main/ofl/poppins/Poppins-Regular.ttf" },
  { family: "Montserrat", ttfUrl: "https://raw.githubusercontent.com/google/fonts/main/ofl/montserrat/Montserrat%5Bwght%5D.ttf" },
  { family: "Playfair Display", ttfUrl: "https://raw.githubusercontent.com/google/fonts/main/ofl/playfairdisplay/PlayfairDisplay%5Bwght%5D.ttf" },
  { family: "Lato", ttfUrl: "https://raw.githubusercontent.com/google/fonts/main/ofl/lato/Lato-Regular.ttf" },
  { family: "Nunito", ttfUrl: "https://raw.githubusercontent.com/google/fonts/main/ofl/nunito/Nunito%5Bwght%5D.ttf" },
];

function findCatalogEntry(fontFamily: string | null | undefined): FontCatalogEntry | undefined {
  if (!fontFamily) return undefined;
  const normalized = fontFamily.trim().toLowerCase();
  return FONT_CATALOG.find((entry) => entry.family.toLowerCase() === normalized);
}

export function resolveFontUrl(fontFamily: string | null | undefined): string | undefined {
  return findCatalogEntry(fontFamily)?.ttfUrl;
}

/**
 * ★ Achado real (redesenho da composição de imagem — headline/subheadline/CTA
 * como texto real, não `title` legado): o Shotstack precisa do nome exato da
 * família embutida na fonte para os assets `text` usarem a fonte customizada
 * (`TextFont.family`) — nunca basta a URL do TTF sozinha. Devolve o nome
 * canônico do catálogo (não o texto livre que o usuário digitou em
 * `brands.font_family`, que pode ter capitalização diferente).
 */
export function resolveFontFamily(fontFamily: string | null | undefined): string | undefined {
  return findCatalogEntry(fontFamily)?.family;
}
