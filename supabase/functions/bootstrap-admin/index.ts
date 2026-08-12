import { reportError } from "../_shared/observability.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const anonKey = Deno.env.get("SUPABASE_PUBLISHABLE_KEY")!;
    const adminClient = createClient(supabaseUrl, serviceRoleKey);

    // How many admins exist? (used by both GET status and POST claim)
    const { count: adminCount, error: countError } = await adminClient
      .from("user_roles")
      .select("id", { count: "exact", head: true })
      .eq("role", "admin");
    if (countError) return json({ error: countError.message }, 500);

    const setupAvailable = (adminCount ?? 0) === 0;

    // Public status check — reveals only whether setup is still open
    if (req.method === "GET") {
      return json({ setup_available: setupAvailable });
    }

    if (req.method !== "POST") return json({ error: "Method not allowed" }, 405);

    if (!setupAvailable) {
      return json(
        {
          error:
            "Setup already completed: an admin account exists. Ask an existing admin to grant access from the admin dashboard.",
        },
        409,
      );
    }

    // Require an authenticated caller — the caller becomes the first admin
    const authHeader = req.headers.get("Authorization");
    if (!authHeader) return json({ error: "You must be signed in to claim admin access." }, 401);

    const userClient = createClient(supabaseUrl, anonKey, {
      global: { headers: { Authorization: authHeader } },
    });
    const { data: { user }, error: userError } = await userClient.auth.getUser();
    if (userError || !user) return json({ error: "Unauthorized" }, 401);

    // Insert with a guard: re-check under the unique constraint
    const { error: insertError } = await adminClient
      .from("user_roles")
      .insert({ user_id: user.id, role: "admin" });
    if (insertError) return json({ error: insertError.message }, 400);

    await adminClient.from("audit_logs").insert({
      action: "bootstrap_admin",
      actor_id: user.id,
      target_user_id: user.id,
      role: "admin",
    });

    return json({
      success: true,
      message: "You are now an admin. Reload the app to see the Admin area.",
    });
  } catch (err) {
    await reportError("bootstrap-admin", err, { method: req.method, url: req.url });
    return json({ error: "Internal server error" }, 500);
  }
});
