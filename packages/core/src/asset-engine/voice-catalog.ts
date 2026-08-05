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
];

export const DEFAULT_VOICE_CATALOG_ENTRY = VOICE_CATALOG[0]!;

export function findVoiceCatalogEntry(voiceId: string): VoiceCatalogEntry | undefined {
  return VOICE_CATALOG.find((entry) => entry.voiceId === voiceId);
}
