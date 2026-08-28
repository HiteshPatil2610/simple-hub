import React, { useState } from 'react';
import { Lock, ShieldCheck } from 'lucide-react';
import { api, setOwnerKey } from '../services/api';

interface OwnerGateProps {
  onUnlocked: () => void;
}

// Shown instead of the Owner Control Hub until a valid owner key is provided.
export const OwnerGate: React.FC<OwnerGateProps> = ({ onUnlocked }) => {
  const [value, setValue] = useState('');
  const [error, setError] = useState('');
  const [isChecking, setIsChecking] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsChecking(true);
    setError('');
    try {
      const ok = await api.verifyOwnerKey(value.trim());
      if (ok) {
        setOwnerKey(value.trim());
        onUnlocked();
      } else {
        setError('Incorrect passcode. Try again.');
      }
    } catch {
      setError('Could not reach the server. Please try again.');
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
          Enter the owner passcode to manage products and view click records.
        </p>

        <form onSubmit={handleSubmit} className="space-y-3 text-left">
          <input
            type="password"
            autoFocus
            value={value}
            onChange={e => setValue(e.target.value)}
            placeholder="Owner passcode"
            className="w-full px-4 py-3 rounded-xl border-2 border-[#2D3436] font-bold text-sm focus:outline-none focus:ring-2 focus:ring-[#4ECDC4]"
          />
          {error && <p className="text-xs font-bold text-[#FF6B6B]">{error}</p>}
          <button
            type="submit"
            disabled={isChecking}
            className="w-full py-3 rounded-xl font-black text-xs uppercase tracking-wider bg-[#4ECDC4] hover:bg-[#3dbdb5] text-[#2D3436] border-2 border-[#2D3436] shadow-[3px_3px_0px_0px_rgba(45,52,54,1)] active:translate-y-0.5 active:shadow-none disabled:opacity-60 flex items-center justify-center gap-2"
          >
            <ShieldCheck className="w-4 h-4" />
            {isChecking ? 'Checking...' : 'Unlock Owner Hub'}
          </button>
        </form>
      </div>
    </div>
  );
};
