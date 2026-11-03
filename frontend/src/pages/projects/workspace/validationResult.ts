export type ValidationResult = 'Pass' | 'Fail' | 'Pending';

export function calculateValidationResult(required: string, tolerance: string, observed: string): ValidationResult {
  if (!required.trim() || !tolerance.trim() || !observed.trim()) return 'Pending';
  const target = Number(required);
  const allowedDeviation = Number(tolerance);
  const measured = Number(observed);
  if (![target, allowedDeviation, measured].every(Number.isFinite) || allowedDeviation < 0) return 'Pending';
  return Math.abs(measured - target) <= allowedDeviation ? 'Pass' : 'Fail';
}
