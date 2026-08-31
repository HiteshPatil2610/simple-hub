import React, { useState } from 'react';
import { Lock, ShieldCheck, Mail, KeyRound, ArrowLeft, ArrowUpRight } from 'lucide-react';
import { api, setAuthToken } from '../services/api';
import { PasswordInput } from './PasswordInput';
import { PasswordStrengthMeter } from './PasswordStrengthMeter';

interface OwnerGateProps {
  onUnlocked: () => void;
  onBackToStorefront?: () => void;
}

type View = 'login' | 'forgot' | 'reset';

export const OwnerGate: React.FC<OwnerGateProps> = ({ onUnlocked, onBackToStorefront }) => {
  const [view, setView] = useState<View>('login');

  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');

  const [resetEmail, setResetEmail] = useState('');
  const [otp, setOtp] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');

  const [error, setError] = useState('');
  const [info, setInfo] = useState('');
  const [isBusy, setIsBusy] = useState(false);

  const resetMessages = () => { setError(''); setInfo(''); };

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsBusy(true);
    resetMessages();
    try {
      const { token } = await api.login(username.trim(), password);
      setAuthToken(token);
      onUnlocked();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not reach the server. Please try again.');
    } finally {
      setIsBusy(false);
    }
  };

  const handleRequestCode = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsBusy(true);
    resetMessages();
    try {
      await api.forgotPassword(resetEmail.trim());
      setInfo('If that email has an account, a 6-digit code has been sent — check your inbox.');
      setView('reset');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not send a reset code. Please try again.');
    } finally {
      setIsBusy(false);
    }
  };

  const handleResetSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    resetMessages();
    if (newPassword !== confirmPassword) {
      setError('Passwords do not match.');
      return;
    }
    setIsBusy(true);
    try {
      await api.resetPassword(resetEmail.trim(), otp.trim(), newPassword);
      setInfo('Password reset — you can sign in now.');
      setUsername(resetEmail.trim());
      setPassword('');
      setOtp('');
      setNewPassword('');
      setConfirmPassword('');
      setView('login');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not reset password. Please try again.');
    } finally {
      setIsBusy(false);
    }
  };

  return (
    <div className="min-h-[85vh] -mx-4 -my-8 sm:-mx-6 sm:-my-8 lg:-mx-8 grid grid-cols-1 lg:grid-cols-2 border-b-3 border-[#111111]">
      {/* Left side: Yellow canvas with white Neo-Brutalist card */}
      <div className="bg-[#FFE600] p-6 sm:p-12 lg:p-16 flex items-center justify-center border-b-3 lg:border-b-0 lg:border-r-3 border-[#111111]">
        <div className="w-full max-w-md bg-white border-3 border-[#111111] rounded-[1.75rem] p-6 sm:p-8 shadow-[6px_6px_0px_0px_#111111] text-left">
          {/* Brand header */}
          <div className="flex items-center gap-2 mb-6">
            <div className="w-8 h-8 bg-[#FFE600] rounded-xl flex items-center justify-center border-2 border-[#111111] shadow-[2px_2px_0px_0px_#111111]">
              🦝
            </div>
            <span className="font-display font-black text-lg text-[#111111]">
              raccoon<span className="text-[#FF5722]">hub</span>
            </span>
          </div>

          {/* Badge */}
          <div className="mb-4">
            <span className="inline-flex items-center gap-1.5 px-3 py-1 bg-[#00E5FF] text-[#111111] text-[10px] font-black uppercase tracking-wider rounded-lg border-2 border-[#111111] shadow-[2px_2px_0px_0px_#111111]">
              <Lock className="w-3 h-3 text-[#111111]" />
              Private control room
            </span>
          </div>

          {view === 'login' && (
            <>
              <h2 className="font-display text-3xl sm:text-4xl font-extrabold text-[#111111] tracking-tight leading-none mb-2">
                Welcome back, curator.
              </h2>
              <p className="text-xs sm:text-sm text-[#111111]/70 font-semibold mb-6">
                Keep the good finds moving. Sign in to your quiet corner of the hub.
              </p>

              {info && (
                <p className="text-xs font-bold text-[#111111] bg-[#4ECDC4]/20 rounded-xl p-3 mb-4 border border-[#111111]">
                  {info}
                </p>
              )}

              <form onSubmit={handleLogin} className="space-y-4">
                <div>
                  <label className="block text-[11px] font-bold text-[#111111] mb-1">
                    Email address
                  </label>
                  <input
                    type="text"
                    id="login-email-input"
                    data-testid="login-email-input"
                    autoFocus
                    autoComplete="username"
                    value={username}
                    onChange={e => setUsername(e.target.value)}
                    placeholder="you@example.com"
                    className="w-full px-3.5 py-2.5 bg-white border-2 border-[#111111] rounded-xl font-medium text-xs sm:text-sm text-[#111111] placeholder-[#111111]/40 focus:outline-none focus:ring-2 focus:ring-[#00E5FF]"
                  />
                </div>

                <div>
                  <label className="block text-[11px] font-bold text-[#111111] mb-1">
                    Password
                  </label>
                  <PasswordInput
                    value={password}
                    onChange={setPassword}
                    placeholder="••••••••"
                    autoComplete="current-password"
                    id="login-password-input"
                    data-testid="login-password-input"
                  />
                </div>

                {error && (
                  <p id="login-error" data-testid="login-error" className="text-xs font-bold text-[#FF5722] bg-[#FF5722]/10 p-2.5 rounded-lg border border-[#FF5722]">
                    {error}
                  </p>
                )}

                <button
                  type="submit"
                  id="login-submit-button"
                  data-testid="login-submit-button"
                  disabled={isBusy || !username || !password}
                  className="w-full py-3 px-4 rounded-xl font-black text-xs uppercase tracking-wider bg-[#FF5722] hover:bg-[#e84e1b] text-white border-2 border-[#111111] shadow-[3px_3px_0px_0px_#111111] active:translate-y-0.5 active:shadow-none disabled:opacity-60 flex items-center justify-center gap-2 transition"
                >
                  <span>{isBusy ? 'Entering...' : 'Enter the hub'}</span>
                  <ArrowUpRight className="w-4 h-4 stroke-[3]" />
                </button>

                <div className="pt-2 flex flex-col items-center gap-2">
                  <button
                    type="button"
                    onClick={() => { setView('forgot'); resetMessages(); }}
                    className="text-[10px] font-bold text-[#111111]/60 hover:text-[#111111] underline uppercase tracking-wider"
                  >
                    Forgot password?
                  </button>

                  {onBackToStorefront && (
                    <button
                      type="button"
                      id="back-to-storefront-button"
                      data-testid="back-to-storefront-button"
                      onClick={onBackToStorefront}
                      className="mt-2 px-3 py-1.5 rounded-lg bg-[var(--muted)] border border-[#111111] text-[10px] font-bold text-[#111111] hover:bg-white transition"
                    >
                      ← Back to public storefront
                    </button>
                  )}
                </div>
              </form>
            </>
          )}

          {view === 'forgot' && (
            <>
              <h2 className="font-display text-2xl font-extrabold text-[#111111] mb-2">
                Reset Password
              </h2>
              <p className="text-xs text-[#111111]/70 font-semibold mb-5">
                Enter your email and we'll send you a 6-digit code.
              </p>
              <form onSubmit={handleRequestCode} className="space-y-3">
                <input
                  type="email"
                  autoFocus
                  value={resetEmail}
                  onChange={e => setResetEmail(e.target.value)}
                  placeholder="Email"
                  className="w-full px-3.5 py-2.5 bg-white border-2 border-[#111111] rounded-xl font-medium text-xs text-[#111111]"
                />
                {error && <p className="text-xs font-bold text-[#FF5722]">{error}</p>}
                <button
                  type="submit"
                  disabled={isBusy || !resetEmail}
                  className="w-full py-2.5 rounded-xl font-black text-xs uppercase tracking-wider bg-[#00E5FF] text-[#111111] border-2 border-[#111111] shadow-[2px_2px_0px_0px_#111111]"
                >
                  {isBusy ? 'Sending...' : 'Send Reset Code'}
                </button>
                <button
                  type="button"
                  onClick={() => { setView('login'); resetMessages(); }}
                  className="w-full flex items-center justify-center gap-1 text-[10px] font-bold text-[#111111]/60 hover:text-[#111111]"
                >
                  <ArrowLeft className="w-3 h-3" /> Back to sign in
                </button>
              </form>
            </>
          )}

          {view === 'reset' && (
            <>
              <h2 className="font-display text-2xl font-extrabold text-[#111111] mb-2">
                Enter Code
              </h2>
              <p className="text-xs text-[#111111]/70 font-semibold mb-4">
                Check your email for the 6-digit code.
              </p>
              <form onSubmit={handleResetSubmit} className="space-y-3">
                <input
                  type="text"
                  maxLength={6}
                  value={otp}
                  onChange={e => setOtp(e.target.value.replace(/\D/g, ''))}
                  placeholder="6-digit code"
                  className="w-full px-3.5 py-2.5 bg-white border-2 border-[#111111] rounded-xl font-bold text-xs text-center tracking-widest"
                />
                <PasswordInput
                  value={newPassword}
                  onChange={setNewPassword}
                  placeholder="New password"
                />
                <PasswordInput
                  value={confirmPassword}
                  onChange={setConfirmPassword}
                  placeholder="Confirm password"
                />
                {error && <p className="text-xs font-bold text-[#FF5722]">{error}</p>}
                <button
                  type="submit"
                  disabled={isBusy || otp.length !== 6}
                  className="w-full py-2.5 rounded-xl font-black text-xs uppercase bg-[#4ECDC4] text-[#111111] border-2 border-[#111111] shadow-[2px_2px_0px_0px_#111111]"
                >
                  {isBusy ? 'Resetting...' : 'Reset Password'}
                </button>
              </form>
            </>
          )}
        </div>
      </div>

      {/* Right side: Signal Orange canvas with abstract quote & geometric shape (matching Screenshot 1) */}
      <div className="bg-[#FF5722] p-8 sm:p-12 lg:p-16 flex flex-col justify-between relative overflow-hidden text-white min-h-[350px]">
        {/* Geometric circular shape graphic */}
        <div className="absolute -top-10 -right-10 w-64 h-64 sm:w-80 sm:h-80 rounded-full border-[18px] border-[#FFE600] opacity-90 pointer-events-none transform rotate-12" />

        <div className="relative z-10" />

        <div className="relative z-10 max-w-md my-auto">
          <blockquote className="font-display text-2xl sm:text-4xl font-extrabold leading-tight text-white mb-4">
            “The best finds are the ones you can’t stop telling people about.”
          </blockquote>
          <p className="text-xs font-bold text-white/80 uppercase tracking-widest">
            — field notes from the hub
          </p>
        </div>

        <div className="relative z-10 text-[10px] font-mono text-white/60">
          Raccoon Hub Curator Gateway v2.5
        </div>
      </div>
    </div>
  );
};

