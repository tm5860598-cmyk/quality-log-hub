import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth-context";

export type DeptPerm = { view: boolean; upload: boolean; edit: boolean; delete: boolean };
export const FULL_PERM: DeptPerm = { view: true, upload: true, edit: true, delete: true };
export const NO_PERM: DeptPerm = { view: false, upload: false, edit: false, delete: false };

export const MANAGER_ROLES = ["owner", "admin"];

/** Loads the signed-in user's per-department permissions. Owners/admins get all. */
export function useDeptPermissions() {
  const { userId, role, status } = useAuth();
  const isManager = MANAGER_ROLES.includes(role);
  const [map, setMap] = useState<Record<string, DeptPerm>>({});
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (status !== "authenticated" || !userId) return;
    let alive = true;
    void (async () => {
      const { data } = await supabase
        .from("dept_permissions")
        .select("category, can_view, can_upload, can_edit, can_delete")
        .eq("user_id", userId);
      if (!alive) return;
      const next: Record<string, DeptPerm> = {};
      for (const r of data ?? []) {
        next[r.category] = {
          view: !!r.can_view, upload: !!r.can_upload, edit: !!r.can_edit, delete: !!r.can_delete,
        };
      }
      setMap(next);
      setLoading(false);
    })();
    return () => { alive = false; };
  }, [userId, status]);

  const can = (category: string): DeptPerm =>
    isManager ? FULL_PERM : (map[category] ?? NO_PERM);

  return { can, isManager, loading: isManager ? false : loading };
}
