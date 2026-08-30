// Lightweight, dependency-free password strength check. Shared between
// ChangePasswordModal and OwnerGate's reset flow. Mirrors (a subset of) the
// server-side checks in server.ts's isPasswordAcceptable — this file is for
// live UX feedback only; the server is the real enforcement point.

const COMMON_PASSWORDS = new Set([
  'password', 'password1', 'password123', '12345678', '123456789', '1234567890',
  'qwerty123', 'qwertyui', 'letmein1', 'admin123', 'welcome1', 'iloveyou',
  'monkey123', 'football1', 'starwars1', 'dragon123', 'sunshine1', 'princess1',
  'abc123456', 'trustno1', 'baseball1', 'superman1', 'whatever1', 'changeme',
  'letmein', 'password!', 'qazwsx123',
]);

export type PasswordStrengthLevel = 'very-weak' | 'weak' | 'fair' | 'good' | 'strong';

export interface PasswordStrengthResult {
  score: number; // 0-4
  level: PasswordStrengthLevel;
  label: string;
  warnings: string[];
}

function hasSequentialRun(password: string, runLength = 4): boolean {
  const lower = password.toLowerCase();
  for (let i = 0; i <= lower.length - runLength; i++) {
    let ascending = true;
    let descending = true;
    let repeated = true;
    for (let j = 0; j < runLength - 1; j++) {
      const a = lower.charCodeAt(i + j);
      const b = lower.charCodeAt(i + j + 1);
      if (b !== a + 1) ascending = false;
      if (b !== a - 1) descending = false;
      if (b !== a) repeated = false;
    }
    if (ascending || descending || repeated) return true;
  }
  return false;
}

// Does the password meaningfully overlap with the account's email? Checks
// the local-part (before @) since that's what people tend to reuse.
function overlapsWithEmail(password: string, email?: string): boolean {
  if (!email) return false;
  const localPart = email.split('@')[0]?.toLowerCase();
  if (!localPart || localPart.length < 3) return false;
  const lowerPassword = password.toLowerCase();
  return lowerPassword.includes(localPart) || localPart.includes(lowerPassword);
}

export function getPasswordStrength(password: string, email?: string): PasswordStrengthResult {
  const warnings: string[] = [];
  let score = 0;

  if (password.length === 0) {
    return { score: 0, level: 'very-weak', label: '', warnings: [] };
  }

  if (password.length < 8) {
    warnings.push('Use at least 8 characters.');
  } else if (password.length >= 12) {
    score += 1;
  }

  const hasLower = /[a-z]/.test(password);
  const hasUpper = /[A-Z]/.test(password);
  const hasDigit = /[0-9]/.test(password);
  const hasSymbol = /[^a-zA-Z0-9]/.test(password);
  const varietyCount = [hasLower, hasUpper, hasDigit, hasSymbol].filter(Boolean).length;
  score += Math.max(0, varietyCount - 1); // up to +3

  if (COMMON_PASSWORDS.has(password.toLowerCase())) {
    warnings.push('This is a very common password — easy to guess.');
    score = 0;
  }

  if (hasSequentialRun(password)) {
    warnings.push('Avoid simple sequences (1234, abcd) or repeated characters.');
    score = Math.min(score, 1);
  }

  if (overlapsWithEmail(password, email)) {
    warnings.push("Don't base your password on your email address.");
    score = Math.min(score, 1);
  }

  if (password.length < 8) {
    score = 0;
  }

  score = Math.max(0, Math.min(4, score));
  const levels: { level: PasswordStrengthLevel; label: string }[] = [
    { level: 'very-weak', label: 'Very weak' },
    { level: 'weak', label: 'Weak' },
    { level: 'fair', label: 'Fair' },
    { level: 'good', label: 'Good' },
    { level: 'strong', label: 'Strong' },
  ];

  return { score, ...levels[score], warnings };
}
