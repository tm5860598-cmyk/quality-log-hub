import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

const MANAGER_ROLES = ["owner", "admin"];

/** Returns the caller's role, throwing unless they may manage users. */
async function requireManager(context: { supabase: any; userId: string }) {
  const { data } = await context.supabase
    .from("user_roles")
    .select("role")
    .eq("user_id", context.userId)
    .maybeSingle();
  const role = String(data?.role ?? "user");
  if (!MANAGER_ROLES.includes(role)) throw new Error("غير مصرح لك بإدارة المستخدمين");
  return role;
}

/** Admins may never touch an owner, nor grant the owner role (no escalation). */
function assertNotEscalating(callerRole: string, targetRole: string | null, nextRole?: string) {
  if (callerRole === "owner") return;
  if (targetRole === "owner" || targetRole === "admin") {
    throw new Error("لا يمكنك تعديل مستخدم بصلاحية أعلى أو مساوية");
  }
  if (nextRole && MANAGER_ROLES.includes(nextRole)) {
    throw new Error("لا يمكنك منح صلاحية أعلى من صلاحيتك");
  }
}

/**
 * Creates an app user with admin privileges so the OWNER's browser session is
 * never touched (client-side `signUp` would replace it and log the owner out).
 */
export const createAppUser = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data: { username: string; password: string; role: string; jobTitle?: string }) => {
    const username = String(data?.username ?? "").trim().toLowerCase();
    const password = String(data?.password ?? "");
    const role = String(data?.role ?? "user");
    if (!username) throw new Error("اسم المستخدم مطلوب");
    if (!password) throw new Error("كلمة السر مطلوبة");
    return { username, password, role, jobTitle: String(data?.jobTitle ?? "").trim() };
  })
  .handler(async ({ data, context }) => {
    const callerRole = await requireManager(context);
    assertNotEscalating(callerRole, null, data.role);

    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");

    const { data: created, error } = await supabaseAdmin.auth.admin.createUser({
      email: `${data.username}@app.local`,
      password: data.password,
      email_confirm: true,
      user_metadata: { username: data.username },
    });
    if (error) throw new Error(error.message);

    const newId = created.user?.id;
    if (newId) {
      if (data.role !== "user") {
        const { error: roleErr } = await supabaseAdmin
          .from("user_roles")
          .update({ role: data.role as never })
          .eq("user_id", newId);
        if (roleErr) throw new Error(roleErr.message);
      }
      if (data.jobTitle) {
        await supabaseAdmin.from("profiles").update({ job_title: data.jobTitle }).eq("id", newId);
      }
    }

    return { id: newId ?? null };
  });

/** Updates username / password / job title / role of an existing user. */
export const updateAppUser = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data: {
    userId: string; username?: string; password?: string; role?: string; jobTitle?: string;
  }) => {
    if (!data?.userId) throw new Error("المستخدم مطلوب");
    return {
      userId: String(data.userId),
      username: data.username ? String(data.username).trim().toLowerCase() : undefined,
      password: data.password ? String(data.password) : undefined,
      role: data.role ? String(data.role) : undefined,
      jobTitle: data.jobTitle === undefined ? undefined : String(data.jobTitle).trim(),
    };
  })
  .handler(async ({ data, context }) => {
    const callerRole = await requireManager(context);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");

    const { data: targetRoleRow } = await supabaseAdmin
      .from("user_roles").select("role").eq("user_id", data.userId).maybeSingle();
    const targetRole = (targetRoleRow?.role as string | undefined) ?? null;
    assertNotEscalating(callerRole, targetRole, data.role);
    if (targetRole === "owner" && data.role && data.role !== "owner") {
      throw new Error("لا يمكن تغيير دور المالك");
    }

    if (data.username || data.password) {
      const attrs: Record<string, unknown> = {};
      if (data.username) {
        attrs["email"] = `${data.username}@app.local`;
        attrs["user_metadata"] = { username: data.username };
      }
      if (data.password) attrs["password"] = data.password;
      const { error } = await supabaseAdmin.auth.admin.updateUserById(data.userId, attrs);
      if (error) throw new Error(error.message);
      if (data.username) {
        await supabaseAdmin.from("profiles").update({ username: data.username }).eq("id", data.userId);
      }
    }
    if (data.jobTitle !== undefined) {
      await supabaseAdmin.from("profiles").update({ job_title: data.jobTitle || null }).eq("id", data.userId);
    }
    if (data.role) {
      const { error } = await supabaseAdmin
        .from("user_roles").update({ role: data.role as never }).eq("user_id", data.userId);
      if (error) throw new Error(error.message);
    }
    return { ok: true };
  });

/** Permanently removes a user account (and their profile / roles / permissions). */
export const deleteAppUser = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data: { userId: string }) => {
    if (!data?.userId) throw new Error("المستخدم مطلوب");
    return { userId: String(data.userId) };
  })
  .handler(async ({ data, context }) => {
    const callerRole = await requireManager(context);
    if (data.userId === context.userId) throw new Error("لا يمكنك حذف حسابك الحالي");

    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { data: targetRoleRow } = await supabaseAdmin
      .from("user_roles").select("role").eq("user_id", data.userId).maybeSingle();
    const targetRole = (targetRoleRow?.role as string | undefined) ?? null;
    if (targetRole === "owner") throw new Error("لا يمكن حذف المالك");
    assertNotEscalating(callerRole, targetRole);

    const { error } = await supabaseAdmin.auth.admin.deleteUser(data.userId);
    if (error) throw new Error(error.message);
    return { ok: true };
  });

/** Saves the per-department View / Upload / Edit / Delete matrix for one user. */
export const setDeptPermissions = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data: {
    userId: string;
    permissions: Array<{ category: string; view: boolean; upload: boolean; edit: boolean; delete: boolean }>;
  }) => {
    if (!data?.userId) throw new Error("المستخدم مطلوب");
    if (!Array.isArray(data.permissions)) throw new Error("الصلاحيات غير صالحة");
    return { userId: String(data.userId), permissions: data.permissions };
  })
  .handler(async ({ data, context }) => {
    const callerRole = await requireManager(context);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { data: targetRoleRow } = await supabaseAdmin
      .from("user_roles").select("role").eq("user_id", data.userId).maybeSingle();
    assertNotEscalating(callerRole, (targetRoleRow?.role as string | undefined) ?? null);

    const rows = data.permissions.map((p) => ({
      user_id: data.userId,
      category: p.category,
      can_view: !!p.view,
      can_upload: !!p.upload,
      can_edit: !!p.edit,
      can_delete: !!p.delete,
    }));
    const { error } = await supabaseAdmin
      .from("dept_permissions")
      .upsert(rows, { onConflict: "user_id,category" });
    if (error) throw new Error(error.message);
    return { ok: true };
  });
