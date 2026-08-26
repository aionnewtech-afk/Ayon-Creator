/**
 * Catálogo curado de vozes ElevenLabs (arch. §14.3) — constante no código,
 * não uma tabela nova (mesma simplicidade já adotada em outras decisões
 * desta missão). Cada voz validada com uma chamada real de síntese antes de
 * entrar aqui (nunca um `voice_id` copiado sem confirmar que ainda existe).
 * Metadados em linguagem de negócio, nunca jargão técnico do fornecedor —
 * usados tanto pelo LLM Provider (seleção automática) quanto pela UI
 * (Perfil da Marca, override manual, ux-design.md §4.12).
 */
export interface VoiceCatalogEntry {
  voiceId: string;
  label: string;
  description: string;
}

export const VOICE_CATALOG: VoiceCatalogEntry[] = [
  { voiceId: "21m00Tcm4TlvDq8ikWAM", label: "Rachel", description: "feminina, calma, confiável — bom padrão neutro para a maioria dos nichos" },
  { voiceId: "AZnzlk1XvdvUeBnXmlld", label: "Domi", description: "feminina, forte, confiante — marcas jovens/ousadas" },
  { voiceId: "EXAVITQu4vr4xnSDxMaL", label: "Bella", description: "feminina, suave, acolhedora — turismo, bem-estar, hospitalidade" },
  { voiceId: "ErXwobaYiN019PkySvjV", label: "Antoni", description: "masculina, versátil, equilibrada — bom padrão neutro para a maioria dos nichos" },
  { voiceId: "TxGEqnHWrfWFTfGW9XjX", label: "Josh", description: "masculina, grave, descontraída — marcas jovens/casuais" },
  { voiceId: "VR6AewLTigWG4xSOukaG", label: "Arnold", description: "masculina, firme, nítida — marcas corporativas/institucionais" },
  { voiceId: "pNInz6obpgDQGcFmaJgB", label: "Adam", description: "masculina, profunda, séria — autoridade, conteúdo educativo" },
  // ★ Achado real (pedido direto do usuário — "queria a voz da Matilda"):
  // voice_id validado com uma chamada real de síntese (curl direto à API,
  // resposta 200 com áudio real) antes de entrar aqui, mesmo critério de
  // todo o resto do catálogo.
  { voiceId: "XrExE9yKIg1WjnnlVkGX", label: "Matilda", description: "feminina, calorosa, expressiva — narrativa/storytelling, bom para vídeos de campanha" },
  // ★ Achado real (pedido direto do usuário — "tem como adicionar mais
  // vozes?"): mesmo critério de sempre — cada `voiceId` abaixo validado com
  // uma chamada real de síntese (todas responderam 200 com áudio real)
  // antes de entrar aqui.
  { voiceId: "MF3mGyEYCl7XYWbV9V6O", label: "Elli", description: "feminina, jovem, emotiva — conteúdo pessoal/inspiracional" },
  { voiceId: "yoZ06aMxZJJ28mfd3POQ", label: "Sam", description: "masculina, jovem, dinâmica — marcas descontraídas/redes sociais" },
  { voiceId: "piTKgcLEGmPE4e6mEKli", label: "Nicole", description: "feminina, suave, quase sussurrada — bem-estar, meditação, spa" },
  { voiceId: "XB0fDUnXU5powFXDhCwa", label: "Charlotte", description: "feminina, sedutora, sofisticada — moda, beleza, marcas premium" },
  { voiceId: "onwK4e9ZLuTAKqWW03F9", label: "Daniel", description: "masculina, formal, autoritária — institucional, notícias, corporativo" },
  { voiceId: "CYw3kZ02Hs0563khs1Fj", label: "Dave", description: "masculina, jovem, animada — jogos, entretenimento, marcas casuais" },
  { voiceId: "jsCqWAovK2LkecY7zXl4", label: "Freya", description: "feminina, firme, direta — conteúdo educativo, tutoriais" },
  { voiceId: "N2lVS1w4EtoT3dr4eOWO", label: "Callum", description: "masculina, rouca, intensa — narrativa dramática, trailers" },
  { voiceId: "TX3LPaxmHKxFdv7VOQHJ", label: "Liam", description: "masculina, jovem, articulada — bom padrão neutro alternativo" },
  { voiceId: "Yko7PKHZNXotIFUBG7I9", label: "Matthew", description: "masculina, madura, tranquilizadora — audiobooks, conteúdo longo" },
];

export const DEFAULT_VOICE_CATALOG_ENTRY = VOICE_CATALOG[0]!;

export function findVoiceCatalogEntry(voiceId: string): VoiceCatalogEntry | undefined {
  return VOICE_CATALOG.find((entry) => entry.voiceId === voiceId);
}
