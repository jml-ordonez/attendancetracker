import { createClient, type SupabaseClient } from "@supabase/supabase-js";

let cachedAdminClient: SupabaseClient | null = null;

/**
 * Privileged Service-Role Supabase Client
 * 
 * STRICT SECURITY CONSTRAINTS:
 * 1. This client must NEVER be exposed or imported into any client component or browser bundle.
 * 2. It is exclusively utilized by trusted Next.js Server Actions and Route Handlers for
 *    atomic scan verification, single-use token consumption, and role management.
 */
export function createAdminClient(): SupabaseClient {
  if (cachedAdminClient) return cachedAdminClient;

  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || process.env.SUPABASE_URL;
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_SECRET_KEY;

  if (!supabaseUrl || !serviceRoleKey) {
    throw new Error(
      "[Supabase Admin Error] Missing NEXT_PUBLIC_SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY environment variables."
    );
  }

  cachedAdminClient = createClient(supabaseUrl, serviceRoleKey, {
    auth: {
      persistSession: false,
      autoRefreshToken: false,
    },
  });

  return cachedAdminClient;
}
