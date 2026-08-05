import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@ayon/types";
import { isPlatformAdmin, isSuperAdmin } from "./is-platform-admin";

export class PlatformAccessDeniedError extends Error {
  constructor() {
    super("Acesso restrito à administração da plataforma.");
    this.name = "PlatformAccessDeniedError";
  }
}

/**
 * Guard único (architecture.md §15.9) — primeira linha de toda Server
 * Action/rota administrativa nova. Concede acesso aos 2 papéis
 * (`super_admin`/`support_admin`); ações exclusivas chamam
 * `requireSuperAdmin` adicionalmente, dentro da própria Server Action.
 */
export async function requirePlatformAdmin(db: SupabaseClient<Database>, userId: string): Promise<void> {
  if (!(await isPlatformAdmin(db, userId))) {
    throw new PlatformAccessDeniedError();
  }
}

/** Bloqueia `support_admin` também — matriz de capacidades em architecture.md §15.1.1. */
export async function requireSuperAdmin(db: SupabaseClient<Database>, userId: string): Promise<void> {
  if (!(await isSuperAdmin(db, userId))) {
    throw new PlatformAccessDeniedError();
  }
}
