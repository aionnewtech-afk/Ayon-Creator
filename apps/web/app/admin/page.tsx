import { getPlatformDashboardMetrics } from "@ayon/core";
import { Badge, Card, CardContent, CardHeader, CardTitle, Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@ayon/ui";
import { createClient } from "@/lib/supabase/server";
import { createServiceRoleClient } from "@/lib/supabase/service-role";

function formatBRL(cents: number): string {
  return (cents / 100).toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
}

function formatPercent(ratio: number | null): string {
  if (ratio === null) return "—";
  return ratio.toLocaleString("pt-BR", { style: "percent", maximumFractionDigits: 1 });
}

const PLAN_LABELS: Record<string, string> = {
  starter: "Starter",
  pro: "Pro",
  business: "Business",
};

interface MetricCardProps {
  label: string;
  value: string;
}

function MetricCard({ label, value }: MetricCardProps) {
  return (
    <Card>
      <CardHeader className="pb-2">
        <CardTitle className="text-sm font-medium text-muted-foreground">{label}</CardTitle>
      </CardHeader>
      <CardContent>
        <p className="text-2xl font-semibold text-foreground">{value}</p>
      </CardContent>
    </Card>
  );
}

export default async function AdminDashboardPage() {
  const sessionDb = await createClient();
  const serviceRoleDb = createServiceRoleClient();
  const metrics = await getPlatformDashboardMetrics(sessionDb, serviceRoleDb);

  return (
    <div className="space-y-6">
      <div className="space-y-1">
        <h1 className="text-xl font-semibold text-foreground">Dashboard</h1>
        <p className="text-sm text-muted-foreground">Métricas da plataforma em tempo real.</p>
      </div>

      <section className="grid grid-cols-2 gap-4 md:grid-cols-4">
        <MetricCard label="Organizações" value={metrics.organizationsCount.toLocaleString("pt-BR")} />
        <MetricCard label="Usuários" value={metrics.usersCount.toLocaleString("pt-BR")} />
        <MetricCard label="Campanhas" value={metrics.campaignsCount.toLocaleString("pt-BR")} />
        <MetricCard label="Trials ativos" value={metrics.activeTrialsCount.toLocaleString("pt-BR")} />
        <MetricCard label="Vídeos gerados hoje" value={metrics.videosCount.toLocaleString("pt-BR")} />
        <MetricCard label="Imagens geradas hoje" value={metrics.imagesCount.toLocaleString("pt-BR")} />
        <MetricCard label="Créditos consumidos hoje" value={metrics.creditsConsumedToday.toLocaleString("pt-BR")} />
        <MetricCard label="Conversão trial → pago" value={formatPercent(metrics.trialToPaidConversionRate)} />
      </section>

      <section className="grid grid-cols-1 gap-4 md:grid-cols-3">
        <MetricCard label="MRR" value={formatBRL(metrics.mrrCents)} />
        <MetricCard label="ARR" value={formatBRL(metrics.arrCents)} />
        <MetricCard
          label="Margem estimada (mês)"
          value={metrics.estimatedMarginCents === null ? "— (sem pacote de créditos ativo)" : formatBRL(metrics.estimatedMarginCents)}
        />
      </section>

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle>Organizações por plano</CardTitle>
          </CardHeader>
          <CardContent>
            {metrics.planBreakdown.length === 0 ? (
              <p className="text-sm text-muted-foreground">Nenhuma assinatura ativa.</p>
            ) : (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Plano</TableHead>
                    <TableHead>Organizações</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {metrics.planBreakdown.map((row) => (
                    <TableRow key={row.plan}>
                      <TableCell>{PLAN_LABELS[row.plan] ?? row.plan}</TableCell>
                      <TableCell>{row.organizations}</TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Providers mais utilizados hoje</CardTitle>
          </CardHeader>
          <CardContent>
            {metrics.topProviders.length === 0 ? (
              <p className="text-sm text-muted-foreground">Nenhuma chamada registrada hoje.</p>
            ) : (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Provider</TableHead>
                    <TableHead>Chamadas</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {metrics.topProviders.map((row) => (
                    <TableRow key={row.providerKey}>
                      <TableCell>{row.providerKey}</TableCell>
                      <TableCell>{row.calls}</TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            )}
            <p className="mt-4 text-sm text-muted-foreground">
              Gasto estimado com IA hoje: <strong className="text-foreground">{metrics.estimatedAiSpendCreditsToday.toLocaleString("pt-BR")} créditos</strong>
            </p>
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Erros recentes de providers</CardTitle>
        </CardHeader>
        <CardContent>
          {metrics.recentErrors.length === 0 ? (
            <p className="text-sm text-muted-foreground">Nenhum erro registrado.</p>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Provider</TableHead>
                  <TableHead>Mensagem</TableHead>
                  <TableHead>Quando</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {metrics.recentErrors.map((row) => (
                  <TableRow key={row.id}>
                    <TableCell>{row.providerKey}</TableCell>
                    <TableCell>
                      <Badge variant="destructive">{row.errorMessage ?? "Erro sem mensagem"}</Badge>
                    </TableCell>
                    <TableCell>{new Date(row.createdAt).toLocaleString("pt-BR")}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
