import Link from "next/link";
import { MailCheck } from "lucide-react";
import {
  buttonVariants,
  Button,
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
  EmptyState,
  Input,
  Label,
} from "@ayon/ui";
import { signUpAction } from "../actions";

export default async function CadastroPage(
  props: {
    searchParams: Promise<{ error?: string; sent?: string }>;
  }
) {
  const searchParams = await props.searchParams;
  if (searchParams.sent) {
    return (
      <EmptyState
        icon={MailCheck}
        title="Confirme seu e-mail"
        description="Enviamos um link de confirmação. Depois de confirmar, você poderá entrar normalmente."
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
        <CardTitle>Criar conta</CardTitle>
        <CardDescription>Comece sua organização na Ayon Creator.</CardDescription>
      </CardHeader>
      <CardContent>
        <form action={signUpAction} className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="organizationName">Nome da organização</Label>
            <Input id="organizationName" name="organizationName" type="text" required />
          </div>
          <div className="space-y-2">
            <Label htmlFor="email">E-mail</Label>
            <Input id="email" name="email" type="email" autoComplete="email" required />
          </div>
          <div className="space-y-2">
            <Label htmlFor="password">Senha</Label>
            <Input id="password" name="password" type="password" autoComplete="new-password" minLength={8} required />
          </div>
          {searchParams.error ? (
            <p className="text-sm text-destructive" role="alert">
              {searchParams.error}
            </p>
          ) : null}
          <Button type="submit" className="w-full">
            Criar conta
          </Button>
        </form>
        <div className="mt-6 text-center text-sm text-muted-foreground">
          Já tem uma conta?{" "}
          <Link href="/login" className="font-medium text-foreground hover:underline">
            Entrar
          </Link>
        </div>
      </CardContent>
    </Card>
  );
}
