import Link from "next/link";
import { MailCheck } from "lucide-react";
import { buttonVariants, Button, Card, CardContent, CardDescription, CardHeader, CardTitle, EmptyState, Input, Label } from "@ayon/ui";
import { requestPasswordResetAction } from "../actions";

export default function RecuperarSenhaPage({
  searchParams,
}: {
  searchParams: { error?: string; sent?: string };
}) {
  if (searchParams.sent) {
    return (
      <EmptyState
        icon={MailCheck}
        title="E-mail enviado"
        description="Se existir uma conta com este e-mail, você receberá um link para redefinir sua senha."
        action={
          <Link href="/login" className={buttonVariants({ variant: "outline" })}>
            Voltar ao login
          </Link>
        }
      />
    );
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>Recuperar senha</CardTitle>
        <CardDescription>Enviaremos um link para redefinir sua senha.</CardDescription>
      </CardHeader>
      <CardContent>
        <form action={requestPasswordResetAction} className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="email">E-mail</Label>
            <Input id="email" name="email" type="email" autoComplete="email" required />
          </div>
          {searchParams.error ? (
            <p className="text-sm text-destructive" role="alert">
              {searchParams.error}
            </p>
          ) : null}
          <Button type="submit" className="w-full">
            Enviar link
          </Button>
        </form>
        <div className="mt-6 text-center text-sm text-muted-foreground">
          <Link href="/login" className="hover:text-foreground hover:underline">
            Voltar ao login
          </Link>
        </div>
      </CardContent>
    </Card>
  );
}
