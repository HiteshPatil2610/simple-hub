import React, { useState } from 'react';
import { Lock, ShieldCheck, Mail } from 'lucide-react';
import { api, setAuthToken } from '../services/api';

interface OwnerGateProps {
  onUnlocked: () => void;
}

// ④ Multi-user auth: shows username + password form instead of a single passcode.
export const OwnerGate: React.FC<OwnerGateProps> = ({ onUnlocked }) => {
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [isChecking, setIsChecking] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsChecking(true);
    setError('');
    try {
      const { token } = await api.login(username.trim(), password);
      setAuthToken(token);
      onUnlocked();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not reach the server. Please try again.');
    } finally {
      setIsChecking(false);
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

        <form onSubmit={handleSubmit} className="space-y-3 text-left">
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
          <div className="relative">
            <Lock className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-[#2D3436]/50 pointer-events-none" />
            <input
              type="password"
              autoComplete="current-password"
              value={password}
              onChange={e => setPassword(e.target.value)}
              placeholder="Password"
              className="w-full pl-9 pr-4 py-3 rounded-xl border-2 border-[#2D3436] font-bold text-sm focus:outline-none focus:ring-2 focus:ring-[#4ECDC4]"
            />
          </div>
          {error && <p className="text-xs font-bold text-[#FF6B6B]">{error}</p>}
          <button
            type="submit"
            disabled={isChecking || !username || !password}
            className="w-full py-3 rounded-xl font-black text-xs uppercase tracking-wider bg-[#4ECDC4] hover:bg-[#3dbdb5] text-[#2D3436] border-2 border-[#2D3436] shadow-[3px_3px_0px_0px_rgba(45,52,54,1)] active:translate-y-0.5 active:shadow-none disabled:opacity-60 flex items-center justify-center gap-2"
          >
            <ShieldCheck className="w-4 h-4" />
            {isChecking ? 'Signing in...' : 'Sign In to Owner Hub'}
          </button>
        </form>
      </div>
    </div>
  );
};
