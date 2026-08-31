import React, { useState } from 'react';
import { X, ShieldCheck } from 'lucide-react';
import { api } from '../services/api';
import { PasswordInput } from './PasswordInput';
import { PasswordStrengthMeter } from './PasswordStrengthMeter';

interface ChangePasswordModalProps {
  onClose: () => void;
}

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
    <div className="fixed inset-0 z-50 bg-[#111111]/75 backdrop-blur-xs flex items-center justify-center p-4" onClick={onClose}>
      <div
        className="bg-[var(--card)] border-3 border-[var(--border)] rounded-[1.5rem] p-6 w-full max-w-sm shadow-[8px_8px_0px_0px_var(--border)] text-[var(--foreground)]"
        onClick={e => e.stopPropagation()}
      >
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-lg font-display font-extrabold text-[var(--foreground)]">Change Password</h2>
          <button
            type="button"
            id="password-modal-close"
            data-testid="password-modal-close"
            onClick={onClose}
            className="p-1 text-[var(--foreground)] hover:opacity-60"
          >
            <X className="w-5 h-5 stroke-[2.5]" />
          </button>
        </div>

        {success ? (
          <div className="text-center py-4">
            <ShieldCheck className="w-10 h-10 text-[#4ECDC4] mx-auto mb-2" />
            <p className="text-sm font-bold text-[var(--foreground)]">Password changed successfully.</p>
            <button
              type="button"
              onClick={onClose}
              className="mt-4 w-full py-2.5 rounded-xl font-black text-xs uppercase tracking-wider bg-[#FFE600] text-[#111111] border-2 border-[#111111] shadow-[3px_3px_0px_0px_#111111]"
            >
              Done
            </button>
          </div>
        ) : (
          <form onSubmit={handleSubmit} className="space-y-3">
            <PasswordInput
              id="password-field-0"
              data-testid="password-field-0"
              value={currentPassword}
              onChange={setCurrentPassword}
              placeholder="Current password"
              autoComplete="current-password"
              autoFocus
            />
            <div className="space-y-1.5">
              <PasswordInput
                id="password-field-1"
                data-testid="password-field-1"
                value={newPassword}
                onChange={setNewPassword}
                placeholder="New password (min 8 characters)"
                autoComplete="new-password"
              />
              <PasswordStrengthMeter password={newPassword} />
            </div>
            <PasswordInput
              id="password-field-2"
              data-testid="password-field-2"
              value={confirmPassword}
              onChange={setConfirmPassword}
              placeholder="Confirm new password"
              autoComplete="new-password"
            />
            {error && <p className="text-xs font-bold text-[#FF5722]">{error}</p>}
            <button
              type="submit"
              id="save-password-button"
              data-testid="save-password-button"
              disabled={isBusy || !currentPassword || !newPassword || !confirmPassword}
              className="w-full py-3 rounded-xl font-black text-xs uppercase tracking-wider bg-[#FF5722] hover:bg-[#e84e1b] text-white border-2 border-[#111111] shadow-[3px_3px_0px_0px_#111111] active:translate-y-0.5 active:shadow-none disabled:opacity-60"
            >
              {isBusy ? 'Changing...' : 'Change Password'}
            </button>
          </form>
        )}
      </div>
    </div>
  );
};

