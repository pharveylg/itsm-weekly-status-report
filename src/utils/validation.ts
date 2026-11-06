/**
 * Minimal syntactic email check. It catches typos before a digest is sent;
 * it is not a deliverability test.
 */
export const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export function isValidEmail(value: string): boolean {
  return EMAIL_PATTERN.test(value.trim());
}
