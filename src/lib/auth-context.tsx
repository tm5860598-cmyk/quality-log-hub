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

  const manualSignOut = useRef(false);

  useEffect(() => {
    let mounted = true;
    let authEventRevision = 0;
    let hasSession = false;
    let recovering = false;

    const applySession = (nextSession: Session | null) => {
      if (!mounted) return;
      hasSession = !!nextSession;
      setSession(nextSession);
      setStatus(nextSession ? "authenticated" : "unauthenticated");
      if (!nextSession) {
        setRole("user");
        setUsername("");
        loadedFor.current = null;
      }
    };

    /**
     * A `SIGNED_OUT` event (or a null payload while we already hold a session)
     * is NOT proof the user logged out: a flaky token refresh, a stale copy in
     * the session store, or a cross-tab race can emit it. So we try to recover
     * the session from the persisted refresh token first, and only fall back to
     * "unauthenticated" when the server itself rejects it.
     */
    const verifyOrClear = async () => {
      if (recovering) return;
      recovering = true;
      try {
        const { data: got } = await supabase.auth.getSession();
        if (!mounted) return;
        if (got.session) {
          applySession(got.session);
          return;
        }
        const { data: refreshed, error } = await supabase.auth.refreshSession();
        if (!mounted) return;
        if (refreshed.session && !error) {
          applySession(refreshed.session);
          return;
        }
        applySession(null);
      } catch {
        // Network/storage hiccup: keep the current session rather than logging out.
      } finally {
        recovering = false;
      }
    };

    const { data: sub } = supabase.auth.onAuthStateChange((event, s) => {
      if (!mounted) return;
      authEventRevision += 1;
      if (s) {
        applySession(s);
        return;
      }
      if (event === "SIGNED_OUT") {
        // Explicit logout from our own signOut() is authoritative.
        if (manualSignOut.current) {
          applySession(null);
          return;
        }
        if (hasSession) {
          void verifyOrClear();
          return;
        }
        applySession(null);
        return;
      }
      if (event === "INITIAL_SESSION" && !hasSession) applySession(null);
    });

    // getSession hydrates the persisted session. Its result is accepted only
    // when no newer auth event arrived while it was pending, so a stale
    // null/session result can never win the startup race.
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
        if (data.session) {
          applySession(data.session);
          return;
        }
        // No session in the store yet on this device: give the async session
        // store (and any pending broker reply) one more chance before showing
        // the login screen.
        void verifyOrClear();
      });

    // Desktop browsers throttle timers in background tabs, so a token refresh
    // can be missed. Re-check when the tab becomes visible or the network
    // returns; this refreshes silently instead of dropping the user.
    const recheck = () => {
      if (!hasSession || manualSignOut.current) return;
      if (document.visibilityState !== "visible") return;
      void verifyOrClear();
    };

    document.addEventListener("visibilitychange", recheck);
    window.addEventListener("online", recheck);
    window.addEventListener("focus", recheck);

    return () => {
      mounted = false;
      document.removeEventListener("visibilitychange", recheck);
      window.removeEventListener("online", recheck);
      window.removeEventListener("focus", recheck);
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
