import i18n from "@/i18n";

/** Política de contraseñas nuevas. Debe coincidir con `validate_password_strength` del backend. */
export const PASSWORD_MIN_LENGTH = 8;
export const PASSWORD_MAX_BYTES = 72; // bcrypt solo mira los primeros 72 bytes

export interface PasswordRule {
  id: "length" | "upper" | "digit" | "special";
  label: string;
  test: (value: string) => boolean;
}

export const PASSWORD_RULES: PasswordRule[] = [
  // `label` es un getter: se traduce al idioma activo cada vez que se lee.
  { id: "length", get label() { return i18n.t("password.rules.length"); }, test: (v) => v.length >= PASSWORD_MIN_LENGTH },
  { id: "upper", get label() { return i18n.t("password.rules.upper"); }, test: (v) => /[A-Z]/.test(v) },
  { id: "digit", get label() { return i18n.t("password.rules.digit"); }, test: (v) => /\d/.test(v) },
  { id: "special", get label() { return i18n.t("password.rules.special"); }, test: (v) => /[^A-Za-z0-9\s]/.test(v) },
];

export const isPasswordTooLong = (value: string) => new TextEncoder().encode(value).length > PASSWORD_MAX_BYTES;

/** Devuelve el mensaje de error de la primera regla que falla, o null si la contraseña es válida. */
export function getPasswordError(value: string): string | null {
  if (isPasswordTooLong(value)) return i18n.t("password.errors.tooLong");
  if (value.length < PASSWORD_MIN_LENGTH) return i18n.t("password.errors.minLength");
  if (!/[A-Z]/.test(value)) return i18n.t("password.errors.upper");
  if (!/\d/.test(value)) return i18n.t("password.errors.digit");
  if (!/[^A-Za-z0-9\s]/.test(value)) return i18n.t("password.errors.special");
  return null;
}
