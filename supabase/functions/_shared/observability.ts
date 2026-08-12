import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

/**
 * Central error reporting for edge functions.
 * Writes a row to public.function_errors (service-role only) and logs to stderr.
 * Never throws — monitoring must never break the request path.
 */
export async function reportError(
  functionName: string,
  err: unknown,
  context: Record<string, unknown> = {},
): Promise<void> {
  const message = err instanceof Error ? err.message : String(err);
  const stack = err instanceof Error ? (err.stack ?? null) : null;

  console.error(`[${functionName}] ${message}`, { stack, context });

  try {
    const url = Deno.env.get("SUPABASE_URL");
    const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
    if (!url || !serviceRoleKey) return;

    const admin = createClient(url, serviceRoleKey);
    await admin.from("function_errors").insert({
      function_name: functionName,
      message: message.slice(0, 2000),
      stack: stack ? stack.slice(0, 8000) : null,
      context: sanitizeContext(context),
    });
  } catch (loggingError) {
    console.error(`[${functionName}] failed to persist error`, loggingError);
  }
}

const SENSITIVE = /(key|token|secret|password|authorization|apikey)/i;

/** Strips obviously sensitive keys so credentials never land in the log table. */
export function sanitizeContext(
  context: Record<string, unknown>,
): Record<string, unknown> {
  const out: Record<string, unknown> = {};
  for (const [k, v] of Object.entries(context ?? {})) {
    if (SENSITIVE.test(k)) {
      out[k] = "[redacted]";
    } else if (v && typeof v === "object" && !Array.isArray(v)) {
      out[k] = sanitizeContext(v as Record<string, unknown>);
    } else {
      out[k] = v;
    }
  }
  return out;
}
