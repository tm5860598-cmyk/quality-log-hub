import {
  createContext, useContext, useEffect, useMemo, useRef, useState,
  type ReactNode,
} from "react";
import { useQueryClient } from "@tanstack/react-query";
import type { Session } from "@supabase/supabase-js";
import { supabase } from "@/integrations/supabase/client";

type AuthStatus = "loading" | "authenticated" | "unauthenticated";

type AuthValue = {
  session: Session | null;
  userId: string | null;
  role: string;
  username: string;
  status: AuthStatus;
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
  const queryClient = useQueryClient();
  const [session, setSession] = useState<Session | null>(null);
  const [status, setStatus] = useState<AuthStatus>("loading");
  const [role, setRole] = useState<string>("user");
  const [username, setUsername] = useState<string>("");
  const userId = session?.user.id ?? null;
  const loadedFor = useRef<string | null>(null);

  useEffect(() => {
    let mounted = true;
    let authEventRevision = 0;

    const applySession = (nextSession: Session | null) => {
      if (!mounted) return;
      setSession(nextSession);
      setStatus(nextSession ? "authenticated" : "unauthenticated");
      if (!nextSession) {
        setRole("user");
        setUsername("");
        loadedFor.current = null;
      }
    };

    const { data: sub } = supabase.auth.onAuthStateChange((event, s) => {
      if (!mounted) return;
      authEventRevision += 1;
      if (event === "SIGNED_OUT") {
        applySession(null);
        return;
      }
      if (s) {
        applySession(s);
        return;
      }
      if (event === "INITIAL_SESSION") applySession(null);
    });

    // getSession hydrates the persisted localStorage session. Its result is
    // accepted only when no newer auth event arrived while it was pending.
    // This prevents a stale null/session result from winning the startup race.
    const revisionAtStart = authEventRevision;
    supabase.auth
      .getSession()
      .then(({ data, error }) => {
        if (!mounted) return;
        if (authEventRevision !== revisionAtStart) return;
        if (error) {
          // A temporary storage/network error is not proof of logout. Keep the
          // app loading until INITIAL_SESSION or a definitive auth event wins.
          console.error("Session hydration failed", error);
          return;
        }
        applySession(data.session);
      });

    return () => {
      mounted = false;
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
      await queryClient.cancelQueries();
      queryClient.clear();
      await supabase.auth.signOut();
      setSession(null);
      setStatus("unauthenticated");
      setRole("user");
      setUsername("");
      loadedFor.current = null;
    },
    [queryClient],
  );

  const value = useMemo<AuthValue>(
    () => ({
      session,
      userId,
      role,
      username,
      status,
      ready: status !== "loading",
      refreshProfile,
      signOut,
    }),
    [session, userId, role, username, status, refreshProfile, signOut],
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth(): AuthValue {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth must be used inside <AuthProvider>");
  return ctx;
}
