import {
  createContext, useContext, useEffect, useMemo, useRef, useState,
  type ReactNode,
} from "react";
import type { Session } from "@supabase/supabase-js";
import { supabase } from "@/integrations/supabase/client";

type AuthValue = {
  session: Session | null;
  userId: string | null;
  role: string;
  username: string;
  ready: boolean;
  refreshProfile: () => Promise<void>;
  signOut: () => Promise<void>;
};

const AuthContext = createContext<AuthValue | null>(null);

/**
 * Single source of truth for the Supabase session.
 *
 * Rules that keep desktop sessions alive:
 * - Only ONE `onAuthStateChange` listener exists in the whole app.
 * - `ready` flips to true only after the first `getSession()` resolves, so no
 *   screen can decide "not logged in" before the session is hydrated.
 * - The session is cleared ONLY on an explicit `SIGNED_OUT` event. Transient
 *   null payloads from `INITIAL_SESSION` / `TOKEN_REFRESHED` are ignored.
 */
export function AuthProvider({ children }: { children: ReactNode }) {
  const [session, setSession] = useState<Session | null>(null);
  const [ready, setReady] = useState(false);
  const [role, setRole] = useState<string>("user");
  const [username, setUsername] = useState<string>("");
  const userId = session?.user.id ?? null;
  const loadedFor = useRef<string | null>(null);

  useEffect(() => {
    let mounted = true;

    const { data: sub } = supabase.auth.onAuthStateChange((event, s) => {
      if (!mounted) return;
      if (event === "SIGNED_OUT") {
        setSession(null);
        setRole("user");
        setUsername("");
        loadedFor.current = null;
        setReady(true);
        return;
      }
      if (s) setSession(s);
      if (event === "INITIAL_SESSION") setReady(true);
    });

    supabase.auth
      .getSession()
      .then(({ data }) => {
        if (!mounted) return;
        if (data.session) setSession(data.session);
      })
      .finally(() => {
        if (mounted) setReady(true);
      });

    // Re-validate when the tab regains focus (desktop keeps tabs open for
    // hours). We never sign the user out here — Supabase handles refresh.
    const onFocus = () => {
      supabase.auth.getSession().then(({ data }) => {
        if (mounted && data.session) setSession(data.session);
      });
    };
    window.addEventListener("focus", onFocus);

    return () => {
      mounted = false;
      window.removeEventListener("focus", onFocus);
      sub.subscription.unsubscribe();
    };
  }, []);

  const refreshProfile = useMemo(
    () => async () => {
      if (!userId) return;
      const [{ data: profile }, { data: roleRow }] = await Promise.all([
        supabase.from("profiles").select("username").eq("id", userId).maybeSingle(),
        supabase.from("user_roles").select("role").eq("user_id", userId).maybeSingle(),
      ]);
      setUsername(profile?.username ?? "");
      setRole((roleRow?.role as string) ?? "user");
    },
    [userId],
  );

  useEffect(() => {
    if (!userId) return;
    if (loadedFor.current === userId) return;
    loadedFor.current = userId;
    void refreshProfile();
  }, [userId, refreshProfile]);

  const signOut = useMemo(
    () => async () => {
      await supabase.auth.signOut();
      setSession(null);
      setRole("user");
      setUsername("");
      loadedFor.current = null;
    },
    [],
  );

  const value = useMemo<AuthValue>(
    () => ({ session, userId, role, username, ready, refreshProfile, signOut }),
    [session, userId, role, username, ready, refreshProfile, signOut],
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth(): AuthValue {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth must be used inside <AuthProvider>");
  return ctx;
}
