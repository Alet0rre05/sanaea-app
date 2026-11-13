/**
 * Reglas de contraseña del documento maestro, espejo de iam/validators.py.
 * El backend sigue siendo la fuente de verdad: esto solo da feedback visual.
 */
export const MIN_PASSWORD_LENGTH = 15;
const TRIPLE_REPEAT = /(.)\1\1/s;

export interface PasswordChecks {
  minLength: boolean;
  noTripleRepeat: boolean;
}

export function passwordChecks(password: string): PasswordChecks {
  return {
    minLength: password.length >= MIN_PASSWORD_LENGTH,
    noTripleRepeat: !TRIPLE_REPEAT.test(password),
  };
}
