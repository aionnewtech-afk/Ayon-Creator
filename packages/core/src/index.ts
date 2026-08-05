export * from "./logger";
export * from "./slug";
export * from "./roles";
export * from "./repositories/organization.repository";
export * from "./repositories/brand.repository";
export * from "./repositories/user.repository";
export * from "./repositories/audit.repository";
export * from "./repositories/brand-brain.repository";
export * from "./repositories/brand-onboarding-answer.repository";
export * from "./repositories/knowledge-base-item.repository";
export * from "./repositories/provider-config.repository";
export * from "./repositories/specialist.repository";
export * from "./repositories/intelligence-hub-session.repository";
export * from "./repositories/specialist-opinion.repository";
export * from "./repositories/campaign.repository";
export * from "./repositories/trend-research.repository";
export * from "./repositories/subscription.repository";
export * from "./repositories/credit-ledger.repository";
export * from "./repositories/credit-pricing.repository";
export * from "./repositories/credit-package.repository";
export * from "./repositories/plan.repository";
export * from "./repositories/content-piece.repository";
export * from "./repositories/content-version.repository";
export * from "./repositories/content-package.repository";
export * from "./repositories/learning-signal.repository";
export * from "./repositories/learning-insight.repository";
export * from "./repositories/pipeline-run.repository";
export * from "./repositories/user-feedback.repository";
export * from "./repositories/platform-admin.repository";
export * from "./repositories/admin-audit-log.repository";
export * from "./repositories/provider-call-log.repository";
export * from "./repositories/feature-flag.repository";
export * from "./platform-admin/is-platform-admin";
export * from "./platform-admin/require-platform-admin";
export * from "./platform-admin/record-admin-action";
export * from "./platform-admin/get-dashboard-metrics";
export * from "./platform-admin/get-organizations-overview";
export * from "./platform-admin/get-users-overview";
export * from "./platform-admin/get-trials-overview";
export * from "./platform-admin/get-credits-overview";
export * from "./platform-admin/get-mercado-pago-overview";
export * from "./platform-admin/get-feedbacks-overview";
export * from "./platform-admin/get-providers-observability";
export * from "./platform-admin/get-logs-overview";
export * from "./platform-admin/get-brands-overview";
export * from "./platform-admin/get-audit-log-overview";
export * from "./provisioning/initial-provisioning";
export * from "./providers/llm-provider";
export * from "./providers/anthropic-llm-provider";
export * from "./providers/trend-source-provider";
export * from "./providers/anthropic-web-search-trend-source-provider";
export * from "./providers/voice-provider";
export * from "./providers/elevenlabs-voice-provider";
export * from "./providers/media-provider";
export * from "./providers/pexels-media-provider";
export * from "./providers/video-render-provider";
export * from "./providers/shotstack-video-render-provider";
export * from "./providers/provider-gateway";
export * from "./providers/log-provider-call";
export * from "./brand-brain/onboarding-themes";
export * from "./brand-brain/knowledge-panel";
export * from "./brand-brain/onboarding-prompt";
export * from "./brand-brain/process-onboarding-turn";
export * from "./brand-brain/apply-extracted-fields";
export * from "./brand-brain/replace-profile-field";
export * from "./brand-brain/build-onboarding-synthesis";
export * from "./brand-brain/conversation-log";
export * from "./brand-brain/onboarding-conversation-engine";
export * from "./shared/llm-json";
export * from "./intelligence-hub/intelligence-hub-prompts";
export * from "./intelligence-hub/run-specialist-panel";
export * from "./intelligence-hub/run-coordinator";
export * from "./intelligence-hub/intelligence-hub-engine";
export * from "./trend-engine/trend-ranking-prompts";
export * from "./trend-engine/run-trend-ranking-panel";
export * from "./trend-engine/run-trend-coordinator";
export * from "./trend-engine/trend-engine";
export * from "./billing/credit-gate";
export * from "./asset-engine/asset-generation-prompts";
export * from "./asset-engine/generate-text-piece";
export * from "./asset-engine/initialize-campaign-content-pieces";
export * from "./asset-engine/video-pipeline-narrate";
export * from "./asset-engine/video-pipeline-scenes";
export * from "./asset-engine/video-pipeline-render";
export * from "./asset-engine/video-pipeline-complete";
export * from "./asset-engine/video-pipeline-trigger";
export * from "./asset-engine/voice-catalog";
export * from "./asset-engine/select-brand-voice";
export * from "./asset-engine/segment-script";
export * from "./asset-engine/font-catalog";
export * from "./asset-engine/resolve-brand-branding";
export * from "./asset-engine/resolve-visual-brief";
export * from "./asset-engine/photo-pipeline-select";
export * from "./asset-engine/photo-pipeline-compose";
export * from "./asset-engine/photo-pipeline-trigger";
export * from "./asset-engine/photo-pipeline-complete";
export * from "./asset-engine/pipeline-progress";
export * from "./learning-engine/learning-engine-prompts";
export * from "./learning-engine/run-learning-analysis-panel";
export * from "./learning-engine/run-learning-coordinator";
export * from "./learning-engine/learning-engine";
export * from "./knowledge-base/knowledge-source-labels";
// `./knowledge-base/extract-document-text` fica FORA deste barrel de propósito:
// depende de pdf-parse (acessa `fs`), e este arquivo é importado por Client
// Components (ex.: apps/web/components/layout/sidebar.tsx, só por causa de
// `hasMinimumRole`) — reexportar a extração aqui quebra o build do Next.js ao
// tentar empacotar pdf-parse no bundle do client. Quem precisar da extração
// (só a Server Action de upload da Missão 4) importa direto o arquivo:
// `@ayon/core/src/knowledge-base/extract-document-text`.
// `./billing/mercado-pago-client` e `./billing/mercado-pago-webhook-handler`
// ficam FORA do barrel pelo mesmo motivo: importam o SDK do Mercado Pago
// (Node-only), e este barrel é importado por Client Components. Quem precisar
// (Server Actions de assinatura/compra de créditos, a rota de webhook) importa
// direto o arquivo: `@ayon/core/src/billing/mercado-pago-client`.
// `./asset-engine/build-content-package` fica FORA do barrel pelo mesmo
// motivo: `jszip` gera `nodebuffer` (Node-only). Quem precisar (Server
// Action de montagem do pacote) importa direto o arquivo:
// `@ayon/core/src/asset-engine/build-content-package`.
// `./shared/verify-n8n-webhook-secret` fica FORA do barrel pelo mesmo motivo
// (Missão 9, achado real durante a validação de build) — usa `node:crypto`
// (`timingSafeEqual`), e o build do Next.js quebra ao tentar empacotar um
// módulo `node:` no bundle do client. Quem precisar (as 4 rotas do Fluxo 13)
// importa direto: `@ayon/core/src/shared/verify-n8n-webhook-secret`.
