import Link from "next/link";
import { Button, Card, CardContent, CardDescription, CardHeader, CardTitle, Input, Label } from "@ayon/ui";
import { signInAction } from "../actions";

export default async function LoginPage(
  props: {
    searchParams: Promise<{ error?: string; redirectTo?: string }>;
  }
) {
  const searchParams = await props.searchParams;
  return (
    <Card>
      <CardHeader>
        <CardTitle>Entrar</CardTitle>
        <CardDescription>Acesse sua conta da Ayon Creator.</CardDescription>
      </CardHeader>
      <CardContent>
        <form action={signInAction} className="space-y-4">
          <input type="hidden" name="redirectTo" value={searchParams.redirectTo ?? "/painel"} />
          <div className="space-y-2">
            <Label htmlFor="email">E-mail</Label>
            <Input id="email" name="email" type="email" autoComplete="email" required />
          </div>
          <div className="space-y-2">
            <Label htmlFor="password">Senha</Label>
            <Input id="password" name="password" type="password" autoComplete="current-password" required />
          </div>
          {searchParams.error ? (
            <p className="text-sm text-destructive" role="alert">
              {searchParams.error}
            </p>
          ) : null}
          <Button type="submit" className="w-full">
            Entrar
          </Button>
        </form>
        <div className="mt-6 flex flex-col gap-2 text-center text-sm text-muted-foreground">
          <Link href="/recuperar-senha" className="hover:text-foreground hover:underline">
            Esqueceu sua senha?
          </Link>
          <span>
            Não tem uma conta?{" "}
            <Link href="/cadastro" className="font-medium text-foreground hover:underline">
              Cadastre-se
            </Link>
          </span>
        </div>
      </CardContent>
    </Card>
  );
}
