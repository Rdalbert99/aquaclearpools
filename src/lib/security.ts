// Security utilities

export interface PasswordValidationResult {
  valid: boolean;
  errors: string[];
}

// Enforce strong passwords: min 12 chars, at least 3 of 4 categories
export function validatePasswordComplexity(password: string, email?: string): PasswordValidationResult {
  const errors: string[] = [];
  if (!password || password.trim().length === 0) {
    return { valid: false, errors: ['Password is required.'] };
  }

  const minLength = 12;
  if (password.length < minLength) {
    errors.push(`Password must be at least ${minLength} characters.`);
  }

  if (/\s/.test(password)) {
    errors.push('Password must not contain spaces.');
  }

  const hasLower = /[a-z]/.test(password);
  const hasUpper = /[A-Z]/.test(password);
  const hasNumber = /[0-9]/.test(password);
  const hasSpecial = /[^A-Za-z0-9]/.test(password);
  const categories = [hasLower, hasUpper, hasNumber, hasSpecial].filter(Boolean).length;
  if (categories < 3) {
    errors.push('Use at least 3 of: uppercase, lowercase, number, special character.');
  }

  if (email) {
    const local = email.split('@')[0];
    if (local && local.length >= 3 && password.toLowerCase().includes(local.toLowerCase())) {
      errors.push('Password should not include your email/username.');
    }
  }

  return { valid: errors.length === 0, errors };
}
