import React, { useState } from 'react';
import { Lock, ShieldCheck, Mail } from 'lucide-react';
import { setAuthToken } from '../services/api';
import { authClient, getNeonAuthJWT } from '../services/neonAuth';

interface OwnerGateProps {
  onUnlocked: () => void;
}

// Sign-in for the Owner Hub, backed by Neon Auth (Managed Better Auth).
// Supports email+password and Google sign-in. Anyone can authenticate with
// Neon Auth itself, but the server only grants Owner Hub access to emails on
// its admin allow-list (checked via /api/auth/me after we get a token here).
export const OwnerGate: React.FC<OwnerGateProps> = ({ onUnlocked }) => {
  const [mode, setMode] = useState<'sign-in' | 'sign-up'>('sign-in');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [name, setName] = useState('');
  const [error, setError] = useState('');
  const [isChecking, setIsChecking] = useState(false);

  // After any successful Neon Auth authentication, confirm with our own
  // server that this email is actually on the admin allow-list before
  // unlocking the Owner Hub.
  const finishLogin = async () => {
    const token = await getNeonAuthJWT();
    if (!token) {
      setError('Signed in, but could not retrieve a session token. Please try again.');
      return;
    }
    const res = await fetch('/api/auth/me', { headers: { Authorization: `Bearer ${token}` } });
    if (!res.ok) {
      await authClient.signOut();
      if (res.status === 403) {
        setError('This account is not approved for Owner Hub access.');
      } else {
        setError('Could not verify your session. Please try again.');
      }
      return;
    }
    setAuthToken(token);
    onUnlocked();
  };

  const handleEmailSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsChecking(true);
    setError('');
    try {
      if (mode === 'sign-up') {
        await authClient.signUp.email({ email: email.trim(), password, name: name.trim() || email.trim() });
      } else {
        await authClient.signIn.email({ email: email.trim(), password });
      }
      await finishLogin();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not sign in. Please try again.');
    } finally {
      setIsChecking(false);
    }
  };

  const handleGoogleSignIn = async () => {
    setError('');
    try {
      // Redirects to Google; on return, App.tsx's session check on mount
      // (via /api/auth/me) picks the session back up.
      await authClient.signIn.social({ provider: 'google', callbackURL: window.location.href });
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Google sign-in failed. Please try again.');
    }
  };

  return (
    <div className="max-w-md mx-auto py-16 px-4">
      <div className="bg-white border-4 border-[#2D3436] rounded-[2rem] p-6 sm:p-8 shadow-[8px_8px_0px_0px_rgba(45,52,54,1)] text-center">
        <div className="w-14 h-14 rounded-2xl bg-[#FFE66D] border-2 border-[#2D3436] flex items-center justify-center mx-auto mb-4 shadow-[3px_3px_0px_0px_rgba(45,52,54,1)]">
          <Lock className="w-6 h-6 text-[#2D3436]" />
        </div>
        <h2 className="text-xl font-black text-[#2D3436]">Owner Access Required</h2>
        <p className="text-xs sm:text-sm text-[#2D3436]/70 font-semibold mt-1.5 mb-5">
          Sign in to manage products and view click records.
        </p>

        <button
          type="button"
          onClick={handleGoogleSignIn}
          className="w-full py-3 mb-3 rounded-xl font-black text-xs uppercase tracking-wider bg-white hover:bg-gray-50 text-[#2D3436] border-2 border-[#2D3436] shadow-[3px_3px_0px_0px_rgba(45,52,54,1)] active:translate-y-0.5 active:shadow-none flex items-center justify-center gap-2"
        >
          <svg className="w-4 h-4" viewBox="0 0 24 24">
            <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"/>
            <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"/>
            <path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"/>
            <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"/>
          </svg>
          Continue with Google
        </button>

        <div className="flex items-center gap-2 my-3">
          <div className="h-px flex-1 bg-[#2D3436]/15" />
          <span className="text-[10px] font-black uppercase text-[#2D3436]/40">or</span>
          <div className="h-px flex-1 bg-[#2D3436]/15" />
        </div>

        <form onSubmit={handleEmailSubmit} className="space-y-3 text-left">
          {mode === 'sign-up' && (
            <input
              type="text"
              value={name}
              onChange={e => setName(e.target.value)}
              placeholder="Name"
              className="w-full px-4 py-3 rounded-xl border-2 border-[#2D3436] font-bold text-sm focus:outline-none focus:ring-2 focus:ring-[#4ECDC4]"
            />
          )}
          <div className="relative">
            <Mail className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-[#2D3436]/50 pointer-events-none" />
            <input
              type="email"
              autoFocus
              autoComplete="email"
              value={email}
              onChange={e => setEmail(e.target.value)}
              placeholder="Email"
              className="w-full pl-9 pr-4 py-3 rounded-xl border-2 border-[#2D3436] font-bold text-sm focus:outline-none focus:ring-2 focus:ring-[#4ECDC4]"
            />
          </div>
          <div className="relative">
            <Lock className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-[#2D3436]/50 pointer-events-none" />
            <input
              type="password"
              autoComplete={mode === 'sign-up' ? 'new-password' : 'current-password'}
              value={password}
              onChange={e => setPassword(e.target.value)}
              placeholder="Password"
              className="w-full pl-9 pr-4 py-3 rounded-xl border-2 border-[#2D3436] font-bold text-sm focus:outline-none focus:ring-2 focus:ring-[#4ECDC4]"
            />
          </div>
          {error && <p className="text-xs font-bold text-[#FF6B6B]">{error}</p>}
          <button
            type="submit"
            disabled={isChecking || !email || !password}
            className="w-full py-3 rounded-xl font-black text-xs uppercase tracking-wider bg-[#4ECDC4] hover:bg-[#3dbdb5] text-[#2D3436] border-2 border-[#2D3436] shadow-[3px_3px_0px_0px_rgba(45,52,54,1)] active:translate-y-0.5 active:shadow-none disabled:opacity-60 flex items-center justify-center gap-2"
          >
            <ShieldCheck className="w-4 h-4" />
            {isChecking ? 'Please wait...' : mode === 'sign-up' ? 'Create Account & Sign In' : 'Sign In to Owner Hub'}
          </button>
          <button
            type="button"
            onClick={() => { setMode(mode === 'sign-in' ? 'sign-up' : 'sign-in'); setError(''); }}
            className="w-full text-center text-[10px] font-black uppercase tracking-wider text-[#2D3436]/50 hover:text-[#2D3436]"
          >
            {mode === 'sign-in' ? "First time here? Create an account" : 'Already have an account? Sign in'}
          </button>
        </form>
      </div>
    </div>
  );
};
