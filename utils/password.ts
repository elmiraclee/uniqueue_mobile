/**
 * Password rule shared with the web (auth/signup.php, parent-signup.php,
 * activate-student.php, parent-profile.php, forgot-password.php):
 * 8+ chars, upper + lower case, a number and a special character.
 */
export const PASSWORD_RULE_TEXT =
  'Password must be at least 8 characters and include upper/lowercase letters, a number, and a special character.';

export type PasswordCheck = { label: string; ok: boolean };

export function passwordChecks(pw: string): PasswordCheck[] {
  return [
    { label: 'At least 8 characters', ok: pw.length >= 8 },
    { label: 'Uppercase letter', ok: /[A-Z]/.test(pw) },
    { label: 'Lowercase letter', ok: /[a-z]/.test(pw) },
    { label: 'Number', ok: /[0-9]/.test(pw) },
    { label: 'Special character', ok: /[^a-zA-Z0-9]/.test(pw) },
  ];
}

/** Returns an error message, or null when the password is strong enough. */
export function passwordError(pw: string): string | null {
  return passwordChecks(pw).every((c) => c.ok) ? null : PASSWORD_RULE_TEXT;
}
