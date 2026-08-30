import React from 'react';
import { getPasswordStrength } from '../utils/passwordStrength';

interface PasswordStrengthMeterProps {
  password: string;
  email?: string;
}

const BAR_COLORS: Record<number, string> = {
  0: '#FF6B6B',
  1: '#FF6B6B',
  2: '#FFE66D',
  3: '#95E1D3',
  4: '#4ECDC4',
};

export const PasswordStrengthMeter: React.FC<PasswordStrengthMeterProps> = ({ password, email }) => {
  const { score, label, warnings } = getPasswordStrength(password, email);
  if (!password) return null;

  return (
    <div className="space-y-1.5">
      <div className="flex gap-1">
        {[0, 1, 2, 3].map(i => (
          <div
            key={i}
            className="h-1.5 flex-1 rounded-full transition-colors"
            style={{ backgroundColor: i <= score - 1 || (score === 0 && i === 0) ? BAR_COLORS[score] : '#E5E5E5' }}
          />
        ))}
      </div>
      <div className="flex items-center justify-between">
        <span className="text-[10px] font-black uppercase tracking-wider" style={{ color: BAR_COLORS[score] }}>
          {label}
        </span>
      </div>
      {warnings.length > 0 && (
        <ul className="text-[10px] font-semibold text-[#2D3436]/60 space-y-0.5">
          {warnings.map((w, i) => (
            <li key={i}>• {w}</li>
          ))}
        </ul>
      )}
    </div>
  );
};
