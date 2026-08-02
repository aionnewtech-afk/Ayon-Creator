/**
 * Registro estático das chaves de feature flag conhecidas pela aplicação.
 * Nenhuma funcionalidade da Sprint 1 é condicionada a flag — este registro
 * existe para documentar as chaves à medida que forem criadas (tabela
 * `feature_flags`, database.md §9.2) e evitar strings mágicas espalhadas
 * pelo código quando o primeiro flag real for consumido.
 */
export const FEATURE_FLAG_KEYS = {} as const;

export type FeatureFlagKey = keyof typeof FEATURE_FLAG_KEYS;
