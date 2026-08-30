import React, { useState } from 'react';
import { Lock, ShieldCheck, Mail, KeyRound, ArrowLeft } from 'lucide-react';
import { api, setAuthToken } from '../services/api';
import { PasswordInput } from './PasswordInput';
import { PasswordStrengthMeter } from './PasswordStrengthMeter';

interface OwnerGateProps {
  onUnlocked: () => void;
}

type View = 'login' | 'forgot' | 'reset';

// Multi-admin auth: email + password login, plus a self-contained
// forgot-password flow (emailed 6-digit code — no external auth service).
export const OwnerGate: React.FC<OwnerGateProps> = ({ onUnlocked }) => {
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
    <div className="max-w-md mx-auto py-16 px-4">
      <div className="bg-white border-4 border-[#2D3436] rounded-[2rem] p-6 sm:p-8 shadow-[8px_8px_0px_0px_rgba(45,52,54,1)] text-center">
        <div className="w-14 h-14 rounded-2xl bg-[#FFE66D] border-2 border-[#2D3436] flex items-center justify-center mx-auto mb-4 shadow-[3px_3px_0px_0px_rgba(45,52,54,1)]">
          {view === 'login' ? <Lock className="w-6 h-6 text-[#2D3436]" /> : <KeyRound className="w-6 h-6 text-[#2D3436]" />}
        </div>

        {view === 'login' && (
          <>
            <h2 className="text-xl font-black text-[#2D3436]">Owner Access Required</h2>
            <p className="text-xs sm:text-sm text-[#2D3436]/70 font-semibold mt-1.5 mb-5">
              Sign in to manage products and view click records.
            </p>
            {info && <p className="text-xs font-bold text-[#2D3436] bg-[#4ECDC4]/20 rounded-lg py-2 px-3 mb-3">{info}</p>}
            <form onSubmit={handleLogin} className="space-y-3 text-left">
              <div className="relative">
                <Mail className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-[#2D3436]/50 pointer-events-none" />
                <input
                  type="text"
                  autoFocus
                  autoComplete="username"
                  value={username}
                  onChange={e => setUsername(e.target.value)}
                  placeholder="Email"
                  className="w-full pl-9 pr-4 py-3 rounded-xl border-2 border-[#2D3436] font-bold text-sm focus:outline-none focus:ring-2 focus:ring-[#4ECDC4]"
                />
              </div>
              <PasswordInput
                value={password}
                onChange={setPassword}
                placeholder="Password"
                autoComplete="current-password"
              />
              {error && <p className="text-xs font-bold text-[#FF6B6B]">{error}</p>}
              <button
                type="submit"
                disabled={isBusy || !username || !password}
                className="w-full py-3 rounded-xl font-black text-xs uppercase tracking-wider bg-[#4ECDC4] hover:bg-[#3dbdb5] text-[#2D3436] border-2 border-[#2D3436] shadow-[3px_3px_0px_0px_rgba(45,52,54,1)] active:translate-y-0.5 active:shadow-none disabled:opacity-60 flex items-center justify-center gap-2"
              >
                <ShieldCheck className="w-4 h-4" />
                {isBusy ? 'Signing in...' : 'Sign In to Owner Hub'}
              </button>
              <button
                type="button"
                onClick={() => { setView('forgot'); resetMessages(); }}
                className="w-full text-center text-[10px] font-black uppercase tracking-wider text-[#2D3436]/50 hover:text-[#2D3436]"
              >
                Forgot password?
              </button>
            </form>
          </>
        )}

        {view === 'forgot' && (
          <>
            <h2 className="text-xl font-black text-[#2D3436]">Reset Password</h2>
            <p className="text-xs sm:text-sm text-[#2D3436]/70 font-semibold mt-1.5 mb-5">
              Enter your email and we'll send you a 6-digit code.
            </p>
            <form onSubmit={handleRequestCode} className="space-y-3 text-left">
              <div className="relative">
                <Mail className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-[#2D3436]/50 pointer-events-none" />
                <input
                  type="email"
                  autoFocus
                  autoComplete="email"
                  value={resetEmail}
                  onChange={e => setResetEmail(e.target.value)}
                  placeholder="Email"
                  className="w-full pl-9 pr-4 py-3 rounded-xl border-2 border-[#2D3436] font-bold text-sm focus:outline-none focus:ring-2 focus:ring-[#4ECDC4]"
                />
              </div>
              {error && <p className="text-xs font-bold text-[#FF6B6B]">{error}</p>}
              <button
                type="submit"
                disabled={isBusy || !resetEmail}
                className="w-full py-3 rounded-xl font-black text-xs uppercase tracking-wider bg-[#4ECDC4] hover:bg-[#3dbdb5] text-[#2D3436] border-2 border-[#2D3436] shadow-[3px_3px_0px_0px_rgba(45,52,54,1)] active:translate-y-0.5 active:shadow-none disabled:opacity-60"
              >
                {isBusy ? 'Sending...' : 'Send Reset Code'}
              </button>
              <button
                type="button"
                onClick={() => { setView('login'); resetMessages(); }}
                className="w-full flex items-center justify-center gap-1 text-[10px] font-black uppercase tracking-wider text-[#2D3436]/50 hover:text-[#2D3436]"
              >
                <ArrowLeft className="w-3 h-3" /> Back to sign in
              </button>
            </form>
          </>
        )}

        {view === 'reset' && (
          <>
            <h2 className="text-xl font-black text-[#2D3436]">Enter Code</h2>
            <p className="text-xs sm:text-sm text-[#2D3436]/70 font-semibold mt-1.5 mb-5">
              Check your email for the 6-digit code, then set a new password.
            </p>
            {info && <p className="text-xs font-bold text-[#2D3436] bg-[#4ECDC4]/20 rounded-lg py-2 px-3 mb-3">{info}</p>}
            <form onSubmit={handleResetSubmit} className="space-y-3 text-left">
              <input
                type="text"
                inputMode="numeric"
                autoFocus
                maxLength={6}
                value={otp}
                onChange={e => setOtp(e.target.value.replace(/\D/g, ''))}
                placeholder="6-digit code"
                className="w-full px-4 py-3 rounded-xl border-2 border-[#2D3436] font-bold text-sm text-center tracking-[0.3em] focus:outline-none focus:ring-2 focus:ring-[#4ECDC4]"
              />
              <div className="space-y-1.5">
                <PasswordInput
                  value={newPassword}
                  onChange={setNewPassword}
                  placeholder="New password"
                  autoComplete="new-password"
                />
                <PasswordStrengthMeter password={newPassword} email={resetEmail} />
              </div>
              <PasswordInput
                value={confirmPassword}
                onChange={setConfirmPassword}
                placeholder="Confirm new password"
                autoComplete="new-password"
              />
              {error && <p className="text-xs font-bold text-[#FF6B6B]">{error}</p>}
              <button
                type="submit"
                disabled={isBusy || otp.length !== 6 || !newPassword || !confirmPassword}
                className="w-full py-3 rounded-xl font-black text-xs uppercase tracking-wider bg-[#4ECDC4] hover:bg-[#3dbdb5] text-[#2D3436] border-2 border-[#2D3436] shadow-[3px_3px_0px_0px_rgba(45,52,54,1)] active:translate-y-0.5 active:shadow-none disabled:opacity-60"
              >
                {isBusy ? 'Resetting...' : 'Reset Password'}
              </button>
              <button
                type="button"
                onClick={() => { setView('forgot'); resetMessages(); }}
                className="w-full flex items-center justify-center gap-1 text-[10px] font-black uppercase tracking-wider text-[#2D3436]/50 hover:text-[#2D3436]"
              >
                <ArrowLeft className="w-3 h-3" /> Request a new code
              </button>
            </form>
          </>
        )}
      </div>
    </div>
  );
};
