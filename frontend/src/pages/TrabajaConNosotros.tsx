import { useRef, useState } from "react";
import { ChevronDown, Scale } from "lucide-react";
import { useTranslation } from "react-i18next";
import i18n from "@/i18n";
import { useCreateApplication } from "@/api/applications";
import Turnstile, { turnstileEnabled, type TurnstileHandle } from "@/components/Turnstile";
import {
  CheckboxField,
  Honeypot,
  SelectField,
  TextAreaField,
  TextField,
} from "@/components/forms/Fields";
import { getFormErrorMessage } from "@/lib/errors";

const PERK_KEYS = ["custom", "ai", "learning", "remote"] as const;

// Valores enviados al backend (no se traducen); la etiqueta se resuelve al renderizar.
const AREAS = [
  ["Desarrollo Backend", "backend"],
  ["Desarrollo Frontend", "frontend"],
  ["Datos e IA", "data"],
  ["Diseño UI/UX", "design"],
  ["Comercial/Ventas", "sales"],
  ["Otro", "other"],
] as const;
const LEVELS = [
  ["Estudiante", "student"],
  ["Junior", "junior"],
  ["Semi-senior", "semi"],
  ["Senior", "senior"],
] as const;
const AVAILABILITY = [
  ["Full-time", "full"],
  ["Part-time", "part"],
  ["Freelance", "freelance"],
  ["A definir", "tbd"],
] as const;

const MIN_MOTIVATION = 30;
const MAX_MOTIVATION = 3000;


const EMPLOYMENT_KEYS = ["indefinite", "fixedTerm", "eventual", "partTime", "seasonal", "freelance", "remote"] as const;

function EmploymentModalities() {
  const { t } = useTranslation();
  const [openItem, setOpenItem] = useState<string | null>("indefinite");

  return (
    <section className="mx-auto w-full max-w-6xl px-4 py-12 sm:px-6" aria-labelledby="employment-title">
      <div className="mb-6 max-w-3xl">
        <div className="mb-3 inline-flex items-center gap-2 text-xs font-bold uppercase tracking-[0.18em] text-cyan-200">
          <Scale className="h-4 w-4" aria-hidden="true" />{t("jobForm.modalities.eyebrow")}
        </div>
        <h2 id="employment-title" className="text-2xl font-bold tracking-tight text-white sm:text-3xl">{t("jobForm.modalities.title")}</h2>
        <p className="mt-3 text-sm leading-7 text-slate-300">{t("jobForm.modalities.intro")}</p>
      </div>
      <div className="grid gap-3 md:grid-cols-2">
        {EMPLOYMENT_KEYS.map((key, index) => {
          const isOpen = openItem === key;
          const panelId = `employment-panel-${key}`;
          return (
            <article key={key} className="ajr-employment-card" data-open={isOpen}>
              <h3>
                <button type="button" className="ajr-employment-trigger" aria-expanded={isOpen} aria-controls={panelId} onClick={() => setOpenItem(isOpen ? null : key)}>
                  <span className="flex min-w-0 items-center gap-3 text-left">
                    <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg border border-cyan-300/20 bg-cyan-300/[0.08] text-xs font-bold text-cyan-100">0{index + 1}</span>
                    <span className="min-w-0">
                      <span className="block text-sm font-semibold text-white">{t(`jobForm.modalities.items.${key}.title`)}</span>
                      <span className="mt-0.5 block text-xs text-slate-400">{t(`jobForm.modalities.items.${key}.basis`)}</span>
                    </span>
                  </span>
                  <ChevronDown className={`h-4 w-4 shrink-0 text-cyan-200 transition-transform duration-200 ${isOpen ? "rotate-180" : ""}`} aria-hidden="true" />
                </button>
              </h3>
              <div id={panelId} hidden={!isOpen} className="ajr-employment-content"><p>{t(`jobForm.modalities.items.${key}.description`)}</p></div>
            </article>
          );
        })}
      </div>
      <div className="mt-5 rounded-xl border border-white/10 bg-white/[0.03] p-4 text-xs leading-6 text-slate-400">
        <p>{t("jobForm.modalities.note")}</p>
        <p className="mt-2 flex flex-wrap gap-x-4 gap-y-1">
          <a href="https://www.argentina.gob.ar/normativa/nacional/25552/actualizacion" target="_blank" rel="noreferrer noopener" className="font-semibold text-cyan-200 underline underline-offset-4">Texto actualizado de la LCT</a>
          <a href="https://www.argentina.gob.ar/normativa/nacional/ley-27555-341093/texto" target="_blank" rel="noreferrer noopener" className="font-semibold text-cyan-200 underline underline-offset-4">Ley de Teletrabajo 27.555</a>
        </p>
      </div>
    </section>
  );
}

/* ------------------------------------------------------------------ formulario */
const initialForm = {
  full_name: "",
  email: "",
  phone: "",
  location: "",
  area: "",
  experience_level: "",
  linkedin_url: "",
  github_url: "",
  cv_url: "",
  motivation: "",
  availability: "",
  consent: false,
};
type FormState = typeof initialForm;
type Errors = Partial<Record<keyof FormState | "turnstile", string>>;

const isHttpUrl = (value: string) => /^https?:\/\/\S+$/i.test(value.trim());

function validate(form: FormState): Errors {
  const errors: Errors = {};
  if (form.full_name.trim().length < 2) errors.full_name = i18n.t("jobForm.errors.fullName");
  if (!form.email.trim()) {
    errors.email = i18n.t("jobForm.errors.emailRequired");
  } else if (!/^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(form.email.trim())) {
    errors.email = i18n.t("jobForm.errors.emailInvalid");
  }
  if (form.phone.trim() && !/^[\d+\-().\s]+$/.test(form.phone.trim())) {
    errors.phone = i18n.t("jobForm.errors.phone");
  }
  if (form.location.trim().length < 2) errors.location = i18n.t("jobForm.errors.location");
  if (!form.area) errors.area = i18n.t("jobForm.errors.area");
  for (const field of ["linkedin_url", "github_url", "cv_url"] as const) {
    if (form[field].trim() && !isHttpUrl(form[field])) {
      errors[field] = i18n.t("jobForm.errors.url");
    }
  }
  if (form.motivation.trim().length < MIN_MOTIVATION) {
    errors.motivation = i18n.t("jobForm.errors.motivation", { min: MIN_MOTIVATION });
  }
  if (!form.consent) errors.consent = i18n.t("jobForm.errors.consent");
  return errors;
}

export default function TrabajaConNosotros() {
  const { t } = useTranslation();
  const createApplication = useCreateApplication();
  const turnstileRef = useRef<TurnstileHandle>(null);
  const [form, setForm] = useState<FormState>(initialForm);
  const [honeypot, setHoneypot] = useState("");
  const [token, setToken] = useState<string | null>(null);
  const [errors, setErrors] = useState<Errors>({});
  const [submitted, setSubmitted] = useState(false);

  function handleChange(
    e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>
  ) {
    const { name, value, type } = e.target;
    const checked = type === "checkbox" ? (e.target as HTMLInputElement).checked : undefined;
    const next = { ...form, [name]: checked ?? value };
    setForm(next);
    if (submitted) setErrors(validate(next));
  }

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setSubmitted(true);
    const found = validate(form);
    if (turnstileEnabled && !token) found.turnstile = t("turnstile.required");
    setErrors(found);
    if (Object.keys(found).length > 0) return;

    const optional = (value: string) => value.trim() || undefined;
    createApplication.mutate(
      {
        full_name: form.full_name.trim(),
        email: form.email.trim(),
        phone: optional(form.phone),
        location: form.location.trim(),
        area: form.area,
        experience_level: optional(form.experience_level),
        linkedin_url: optional(form.linkedin_url),
        github_url: optional(form.github_url),
        cv_url: optional(form.cv_url),
        motivation: form.motivation.trim(),
        availability: optional(form.availability),
        consent: form.consent,
        turnstile_token: token ?? undefined,
        website: honeypot,
      },
      { onError: () => turnstileRef.current?.reset() }
    );
  }

  if (createApplication.isSuccess) {
    return (
      <div className="mx-auto max-w-xl px-6 py-24 text-center">
        <h1 className="text-2xl font-bold text-fg">
          {t("jobForm.thanks")}
        </h1>
        <p className="mt-3 text-fg-muted">
          {t("jobForm.thanksText")}
        </p>
      </div>
    );
  }

  return (
    <div>
      {/* Hero */}
      <section className="border-b bg-surface-2">
        <div className="mx-auto max-w-3xl px-6 py-16 text-center">
          <h1 className="text-4xl font-bold text-fg">{t("jobForm.heroTitle")}</h1>
          <p className="mt-5 text-lg text-fg-muted">{t("jobForm.heroIntro")}</p>
          <p className="mt-4 text-fg-muted">{t("jobForm.heroOutro")}</p>
          <ul className="mt-10 grid gap-4 text-left sm:grid-cols-2">
            {PERK_KEYS.map((perk) => (
              <li key={perk} className="rounded-lg border bg-surface p-4">
                <h2 className="font-semibold text-accent">{t(`jobForm.perks.${perk}.title`)}</h2>
                <p className="mt-1 text-sm text-fg-muted">{t(`jobForm.perks.${perk}.text`)}</p>
              </li>
            ))}
          </ul>
        </div>
      </section>

      <EmploymentModalities />

      {/* Formulario */}
      <section className="mx-auto max-w-xl px-6 py-14">
        <h2 className="text-2xl font-bold text-fg">{t("jobForm.applyTitle")}</h2>
        <p className="mt-1 text-sm text-fg-subtle">{t("jobForm.requiredNote")}</p>

        <form onSubmit={handleSubmit} noValidate className="relative mt-8 space-y-4">
          <TextField label={t("jobForm.fullName")} name="full_name" value={form.full_name} onChange={handleChange} required maxLength={150} autoComplete="name" error={errors.full_name} />
          <TextField label={t("jobForm.email")} name="email" type="email" value={form.email} onChange={handleChange} required maxLength={320} autoComplete="email" error={errors.email} />
          <TextField label={t("jobForm.phone")} name="phone" value={form.phone} onChange={handleChange} maxLength={50} autoComplete="tel" error={errors.phone} />
          <TextField label={t("jobForm.location")} name="location" value={form.location} onChange={handleChange} required maxLength={150} placeholder={t("jobForm.locationPlaceholder")} error={errors.location} />
          <SelectField label={t("jobForm.area")} name="area" value={form.area} onChange={handleChange} options={AREAS.map(([v, k]) => ({ value: v, label: t(`jobForm.areas.${k}`) }))} required error={errors.area} />
          <SelectField label={t("jobForm.level")} name="experience_level" value={form.experience_level} onChange={handleChange} options={LEVELS.map(([v, k]) => ({ value: v, label: t(`jobForm.levels.${k}`) }))} />
          <TextField label={t("jobForm.linkedin")} name="linkedin_url" type="url" value={form.linkedin_url} onChange={handleChange} maxLength={500} placeholder="https://linkedin.com/in/..." error={errors.linkedin_url} />
          <TextField label={t("jobForm.github")} name="github_url" type="url" value={form.github_url} onChange={handleChange} maxLength={500} placeholder="https://github.com/..." error={errors.github_url} />
          <TextField
            label={t("jobForm.cv")}
            name="cv_url"
            type="url"
            value={form.cv_url}
            onChange={handleChange}
            maxLength={500}
            placeholder="https://drive.google.com/..."
            hint={t("jobForm.cvHint")}
            error={errors.cv_url}
          />
          <TextAreaField label={t("jobForm.motivation")} name="motivation" value={form.motivation} onChange={handleChange} required maxLength={MAX_MOTIVATION} minLength={MIN_MOTIVATION} error={errors.motivation} />
          <SelectField label={t("jobForm.availabilityLabel")} name="availability" value={form.availability} onChange={handleChange} options={AVAILABILITY.map(([v, k]) => ({ value: v, label: t(`jobForm.availability.${k}`) }))} />

          <CheckboxField name="consent" checked={form.consent} onChange={handleChange} error={errors.consent}>
            {t("jobForm.consent")}
          </CheckboxField>

          <Honeypot value={honeypot} onChange={(e) => setHoneypot(e.target.value)} />

          <div>
            <Turnstile ref={turnstileRef} onToken={setToken} />
            {errors.turnstile && (
              <p role="alert" className="mt-1 text-sm text-red-600 dark:text-red-400">
                {errors.turnstile}
              </p>
            )}
          </div>

          <button
            type="submit"
            disabled={createApplication.isPending || (turnstileEnabled && !token)}
            className="w-full rounded-md bg-brand px-6 py-3 font-medium text-white hover:bg-brand-dark disabled:opacity-50"
          >
            {createApplication.isPending ? t("jobForm.sending") : t("jobForm.submit")}
          </button>

          {createApplication.isError && (
            <p role="alert" className="text-sm text-red-600 dark:text-red-400">
              {getFormErrorMessage(createApplication.error, "application")}
            </p>
          )}
        </form>
      </section>
    </div>
  );
}
