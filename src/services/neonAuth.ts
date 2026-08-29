import { createAuthClient } from '@neondatabase/auth';

// Base URL of the Neon Auth (Managed Better Auth) service for this project.
// Set at build time via VITE_NEON_AUTH_BASE_URL (see .env.example).
const NEON_AUTH_BASE_URL = import.meta.env.VITE_NEON_AUTH_BASE_URL;

if (!NEON_AUTH_BASE_URL) {
  // Not throwing here so the rest of the app (product browsing etc.) still
  // works even if auth isn't configured yet — only the Owner Hub needs this.
  console.warn(
    '[NeonAuth] VITE_NEON_AUTH_BASE_URL is not set. Owner sign-in will not work until it is.'
  );
}

export const authClient = createAuthClient(NEON_AUTH_BASE_URL || '');

// Returns the current session's JWT, used to authenticate requests to our
// own Express API (verified server-side against Neon Auth's JWKS endpoint).
// This is ONLY needed for the Google sign-in flow — email/password gets its
// token directly from our own server (see OwnerGate.tsx), sidestepping this
// entirely. For Google, after the OAuth redirect completes, the browser
// holds a valid Neon Auth session cookie; this calls Better Auth's real JWT
// plugin endpoint (GET /token, cookie-authenticated) to exchange it for a
// bearer token our backend can verify.
export async function getNeonAuthJWT(): Promise<string | null> {
  if (!NEON_AUTH_BASE_URL) return null;
  try {
    const res = await fetch(`${NEON_AUTH_BASE_URL}/token`, { credentials: 'include' });
    if (!res.ok) return null;
    const data = await res.json();
    return data?.token || null;
  } catch {
    return null;
  }
}

