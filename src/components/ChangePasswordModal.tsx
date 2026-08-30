import React, { useState } from 'react';
import { X, Lock, ShieldCheck } from 'lucide-react';
import { api } from '../services/api';

interface ChangePasswordModalProps {
  onClose: () => void;
}

// Lets an already-logged-in admin change their own password. Requires the
// current password so a stolen-but-still-valid session token alone can't be
// used to lock the real owner out.
export const ChangePasswordModal: React.FC<ChangePasswordModalProps> = ({ onClose }) => {
  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [error, setError] = useState('');
  const [success, setSuccess] = useState(false);
  const [isBusy, setIsBusy] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    if (newPassword !== confirmPassword) {
      setError('New passwords do not match.');
      return;
    }
    if (newPassword.length < 8) {
      setError('New password must be at least 8 characters.');
      return;
    }
    setIsBusy(true);
    try {
      await api.changePassword(currentPassword, newPassword);
      setSuccess(true);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not change password.');
    } finally {
      setIsBusy(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 bg-black/50 flex items-center justify-center p-4" onClick={onClose}>
      <div
        className="bg-white border-4 border-[#2D3436] rounded-[2rem] p-6 w-full max-w-sm shadow-[8px_8px_0px_0px_rgba(45,52,54,1)]"
        onClick={e => e.stopPropagation()}
      >
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-lg font-black text-[#2D3436]">Change Password</h2>
          <button type="button" onClick={onClose} className="p-1 hover:opacity-60">
            <X className="w-5 h-5 text-[#2D3436]" />
          </button>
        </div>

        {success ? (
          <div className="text-center py-4">
            <ShieldCheck className="w-10 h-10 text-[#4ECDC4] mx-auto mb-2" />
            <p className="text-sm font-bold text-[#2D3436]">Password changed successfully.</p>
            <button
              type="button"
              onClick={onClose}
              className="mt-4 w-full py-2.5 rounded-xl font-black text-xs uppercase tracking-wider bg-[#4ECDC4] hover:bg-[#3dbdb5] text-[#2D3436] border-2 border-[#2D3436] shadow-[3px_3px_0px_0px_rgba(45,52,54,1)]"
            >
              Done
            </button>
          </div>
        ) : (
          <form onSubmit={handleSubmit} className="space-y-3">
            <div className="relative">
              <Lock className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-[#2D3436]/50 pointer-events-none" />
              <input
                type="password"
                autoFocus
                autoComplete="current-password"
                value={currentPassword}
                onChange={e => setCurrentPassword(e.target.value)}
                placeholder="Current password"
                className="w-full pl-9 pr-4 py-3 rounded-xl border-2 border-[#2D3436] font-bold text-sm focus:outline-none focus:ring-2 focus:ring-[#4ECDC4]"
              />
            </div>
            <div className="relative">
              <Lock className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-[#2D3436]/50 pointer-events-none" />
              <input
                type="password"
                autoComplete="new-password"
                value={newPassword}
                onChange={e => setNewPassword(e.target.value)}
                placeholder="New password (min 8 characters)"
                className="w-full pl-9 pr-4 py-3 rounded-xl border-2 border-[#2D3436] font-bold text-sm focus:outline-none focus:ring-2 focus:ring-[#4ECDC4]"
              />
            </div>
            <div className="relative">
              <Lock className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-[#2D3436]/50 pointer-events-none" />
              <input
                type="password"
                autoComplete="new-password"
                value={confirmPassword}
                onChange={e => setConfirmPassword(e.target.value)}
                placeholder="Confirm new password"
                className="w-full pl-9 pr-4 py-3 rounded-xl border-2 border-[#2D3436] font-bold text-sm focus:outline-none focus:ring-2 focus:ring-[#4ECDC4]"
              />
            </div>
            {error && <p className="text-xs font-bold text-[#FF6B6B]">{error}</p>}
            <button
              type="submit"
              disabled={isBusy || !currentPassword || !newPassword || !confirmPassword}
              className="w-full py-3 rounded-xl font-black text-xs uppercase tracking-wider bg-[#4ECDC4] hover:bg-[#3dbdb5] text-[#2D3436] border-2 border-[#2D3436] shadow-[3px_3px_0px_0px_rgba(45,52,54,1)] active:translate-y-0.5 active:shadow-none disabled:opacity-60"
            >
              {isBusy ? 'Changing...' : 'Change Password'}
            </button>
          </form>
        )}
      </div>
    </div>
  );
};
