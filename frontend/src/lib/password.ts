/** Política de contraseñas nuevas. Debe coincidir con `validate_password_strength` del backend. */
export const PASSWORD_MIN_LENGTH = 8;
export const PASSWORD_MAX_BYTES = 72; // bcrypt solo mira los primeros 72 bytes

export interface PasswordRule {
  id: "length" | "upper" | "digit" | "special";
  label: string;
  test: (value: string) => boolean;
}

export const PASSWORD_RULES: PasswordRule[] = [
  { id: "length", label: "8 caracteres o más", test: (v) => v.length >= PASSWORD_MIN_LENGTH },
  { id: "upper", label: "Una mayúscula", test: (v) => /[A-Z]/.test(v) },
  { id: "digit", label: "Un número", test: (v) => /\d/.test(v) },
  { id: "special", label: "Un carácter especial (! ? # $ %…)", test: (v) => /[^A-Za-z0-9\s]/.test(v) },
];

export const isPasswordTooLong = (value: string) => new TextEncoder().encode(value).length > PASSWORD_MAX_BYTES;

/** Devuelve el mensaje de error de la primera regla que falla, o null si la contraseña es válida. */
export function getPasswordError(value: string): string | null {
  if (isPasswordTooLong(value)) return "Es demasiado larga (máximo 72 bytes).";
  if (value.length < PASSWORD_MIN_LENGTH) return "Tiene que tener al menos 8 caracteres.";
  if (!/[A-Z]/.test(value)) return "Tiene que incluir al menos una mayúscula.";
  if (!/\d/.test(value)) return "Tiene que incluir al menos un número.";
  if (!/[^A-Za-z0-9\s]/.test(value)) return "Tiene que incluir al menos un carácter especial (por ejemplo ! ? # $ %).";
  return null;
}
