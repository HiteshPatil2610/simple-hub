import React, { useState } from 'react';
import { X, ShieldCheck } from 'lucide-react';
import { api } from '../services/api';
import { PasswordInput } from './PasswordInput';
import { PasswordStrengthMeter } from './PasswordStrengthMeter';

interface ChangePasswordModalProps {
  onClose: () => void;
}

// Lets an already-logged-in admin change their own password. Requires the
// current password so a stolen-but-still-valid session token alone can't be
// used to lock the real owner out. The server independently re-validates
// strength/reuse rules — the meter here is UX feedback, not enforcement.
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
            <PasswordInput
              value={currentPassword}
              onChange={setCurrentPassword}
              placeholder="Current password"
              autoComplete="current-password"
              autoFocus
            />
            <div className="space-y-1.5">
              <PasswordInput
                value={newPassword}
                onChange={setNewPassword}
                placeholder="New password (min 8 characters)"
                autoComplete="new-password"
              />
              <PasswordStrengthMeter password={newPassword} />
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
