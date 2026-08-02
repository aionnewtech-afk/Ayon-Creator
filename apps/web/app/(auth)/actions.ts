"use server";

import { redirect } from "next/navigation";
import { logger } from "@ayon/core";
import { createClient } from "@/lib/supabase/server";
import { appConfig } from "@/config/app";

function redirectWithError(path: string, message: string): never {
  redirect(`${path}?error=${encodeURIComponent(message)}`);
}

export async function signInAction(formData: FormData): Promise<void> {
  const email = String(formData.get("email") ?? "").trim();
  const password = String(formData.get("password") ?? "");
  const redirectTo = String(formData.get("redirectTo") ?? "/painel");

  if (!email || !password) {
    redirectWithError("/login", "Informe e-mail e senha.");
  }

  const supabase = createClient();
  const { error } = await supabase.auth.signInWithPassword({ email, password });

  if (error) {
    logger.warn("auth.login_failed", { email, reason: error.message });
    redirectWithError("/login", "E-mail ou senha inválidos.");
  }

  redirect(redirectTo);
}

export async function signUpAction(formData: FormData): Promise<void> {
  const organizationName = String(formData.get("organizationName") ?? "").trim();
  const email = String(formData.get("email") ?? "").trim();
  const password = String(formData.get("password") ?? "");

  if (!organizationName || !email || !password) {
    redirectWithError("/cadastro", "Preencha todos os campos.");
  }
  if (password.length < 8) {
    redirectWithError("/cadastro", "A senha deve ter pelo menos 8 caracteres.");
  }

  const supabase = createClient();
  const { error } = await supabase.auth.signUp({
    email,
    password,
    options: {
      data: { organization_name: organizationName },
      emailRedirectTo: `${appConfig.url}/auth/callback?redirectTo=/painel`,
    },
  });

  if (error) {
    logger.warn("auth.signup_failed", {
      email,
      reason: error.message,
      code: error.code,
      status: error.status,
    });

    const message =
      error.code === "user_already_exists"
        ? "Já existe uma conta com este e-mail."
        : error.code === "over_email_send_rate_limit"
          ? "Enviamos muitas mensagens de confirmação recentemente. Aguarde alguns minutos e tente novamente."
          : "Não foi possível criar a conta. Tente novamente.";
    redirectWithError("/cadastro", message);
  }

  redirect("/cadastro?sent=1");
}

export async function requestPasswordResetAction(formData: FormData): Promise<void> {
  const email = String(formData.get("email") ?? "").trim();

  if (!email) {
    redirectWithError("/recuperar-senha", "Informe seu e-mail.");
  }

  const supabase = createClient();
  const { error } = await supabase.auth.resetPasswordForEmail(email, {
    redirectTo: `${appConfig.url}/auth/callback?redirectTo=/recuperar-senha/nova-senha`,
  });

  if (error) {
    logger.warn("auth.password_reset_request_failed", { email, reason: error.message });
  }

  // Sempre "enviado", mesmo se o e-mail não existir — evita confirmar quais
  // e-mails têm conta (mesmo padrão de segurança do próprio Supabase Auth).
  redirect("/recuperar-senha?sent=1");
}

export async function updatePasswordAction(formData: FormData): Promise<void> {
  const password = String(formData.get("password") ?? "");

  if (password.length < 8) {
    redirectWithError("/recuperar-senha/nova-senha", "A senha deve ter pelo menos 8 caracteres.");
  }

  const supabase = createClient();
  const { error } = await supabase.auth.updateUser({ password });

  if (error) {
    logger.warn("auth.password_update_failed", { reason: error.message });
    redirectWithError("/recuperar-senha/nova-senha", "Não foi possível atualizar a senha. Solicite um novo link.");
  }

  redirect("/painel");
}
