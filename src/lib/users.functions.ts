import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

const OWNER_ROLES = ["owner", "admin"];

/**
 * Creates an app user with admin privileges so the OWNER's browser session is
 * never touched (client-side `signUp` would replace it and log the owner out).
 */
export const createAppUser = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data: { username: string; password: string; role: string }) => {
    const username = String(data?.username ?? "").trim().toLowerCase();
    const password = String(data?.password ?? "");
    const role = String(data?.role ?? "user");
    if (!username) throw new Error("اسم المستخدم مطلوب");
    if (!password) throw new Error("كلمة السر مطلوبة");
    return { username, password, role };
  })
  .handler(async ({ data, context }) => {
    const { data: callerRole } = await context.supabase
      .from("user_roles")
      .select("role")
      .eq("user_id", context.userId)
      .maybeSingle();

    if (!callerRole || !OWNER_ROLES.includes(String(callerRole.role))) {
      throw new Error("غير مصرح لك بإضافة مستخدمين");
    }

    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");

    const { data: created, error } = await supabaseAdmin.auth.admin.createUser({
      email: `${data.username}@app.local`,
      password: data.password,
      email_confirm: true,
      user_metadata: { username: data.username },
    });
    if (error) throw new Error(error.message);

    const newId = created.user?.id;
    if (newId && data.role !== "user") {
      const { error: roleErr } = await supabaseAdmin
        .from("user_roles")
        .update({ role: data.role as never })
        .eq("user_id", newId);
      if (roleErr) throw new Error(roleErr.message);
    }

    return { id: newId ?? null };
  });
