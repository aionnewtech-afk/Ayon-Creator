import { Button, Card, CardContent, CardDescription, CardHeader, CardTitle, Input, Label } from "@ayon/ui";
import { updatePasswordAction } from "../../actions";

export default async function NovaSenhaPage(props: { searchParams: Promise<{ error?: string }> }) {
  const searchParams = await props.searchParams;
  return (
    <Card>
      <CardHeader>
        <CardTitle>Defina uma nova senha</CardTitle>
        <CardDescription>Escolha uma nova senha para sua conta.</CardDescription>
      </CardHeader>
      <CardContent>
        <form action={updatePasswordAction} className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="password">Nova senha</Label>
            <Input id="password" name="password" type="password" autoComplete="new-password" minLength={8} required />
          </div>
          {searchParams.error ? (
            <p className="text-sm text-destructive" role="alert">
              {searchParams.error}
            </p>
          ) : null}
          <Button type="submit" className="w-full">
            Salvar nova senha
          </Button>
        </form>
      </CardContent>
    </Card>
  );
}
