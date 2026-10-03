import { useRef, useState } from "react";
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

/* ------------------------------------------------------------------ copy editable */
const HERO = {
  title: "Formá parte de la familia AJR",
  intro:
    "Somos un equipo chico que resuelve problemas reales de PyMEs con software a medida: " +
    "desde sistemas de gestión hasta asistentes con IA que le devuelven horas de trabajo a un negocio. " +
    "Nos importa más entender bien el problema que usar la última moda, y nos gusta hacerlo en buena compañía.",
  outro:
    "Si disfrutás construir cosas útiles, preguntar “¿para qué?” y crecer con gente que te banca cuando algo se traba, " +
    "contanos quién sos. Todas las postulaciones las lee una persona del equipo.",
  perks: [
    {
      title: "Desarrollo a medida",
      text: "Nada de plantillas: cada proyecto arranca escuchando cómo trabaja el negocio.",
    },
    {
      title: "IA aplicada",
      text: "Chatbots, agentes y automatizaciones que las PyMEs usan desde el primer día.",
    },
    {
      title: "Aprendizaje continuo",
      text: "Tiempo y espacio para probar tecnologías nuevas y equivocarnos en compañía.",
    },
    {
      title: "Remoto y flexible",
      text: "Trabajás desde donde rindas mejor, con acuerdos claros y sin microgestión.",
    },
  ],
};

const AREAS = [
  "Desarrollo Backend",
  "Desarrollo Frontend",
  "Datos e IA",
  "Diseño UI/UX",
  "Comercial/Ventas",
  "Otro",
] as const;
const LEVELS = ["Estudiante", "Junior", "Semi-senior", "Senior"] as const;
const AVAILABILITY = ["Full-time", "Part-time", "Freelance", "A definir"] as const;

const MIN_MOTIVATION = 30;
const MAX_MOTIVATION = 3000;

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
  if (form.full_name.trim().length < 2) errors.full_name = "Contanos tu nombre y apellido.";
  if (!form.email.trim()) {
    errors.email = "Necesitamos un email para escribirte.";
  } else if (!/^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(form.email.trim())) {
    errors.email = "Revisá el email: parece que tiene un error.";
  }
  if (form.phone.trim() && !/^[\d+\-().\s]+$/.test(form.phone.trim())) {
    errors.phone = "Usá solo números, espacios y + - ( ).";
  }
  if (form.location.trim().length < 2) errors.location = "Decinos desde qué ciudad y país nos escribís.";
  if (!form.area) errors.area = "Elegí un área de interés.";
  for (const field of ["linkedin_url", "github_url", "cv_url"] as const) {
    if (form[field].trim() && !isHttpUrl(form[field])) {
      errors[field] = "El link tiene que empezar con http:// o https://";
    }
  }
  if (form.motivation.trim().length < MIN_MOTIVATION) {
    errors.motivation = `Contanos un poco más (mínimo ${MIN_MOTIVATION} caracteres).`;
  }
  if (!form.consent) errors.consent = "Tenés que aceptar el tratamiento de tus datos para postularte.";
  return errors;
}

export default function TrabajaConNosotros() {
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
    if (turnstileEnabled && !token) found.turnstile = "Completá la verificación anti-spam.";
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
          ¡Gracias por querer sumarte a la familia AJR!
        </h1>
        <p className="mt-3 text-fg-muted">
          Recibimos tu postulación y te mandamos un mail de confirmación. La vamos a leer con
          atención y, si hay match, te escribimos para conocernos.
        </p>
      </div>
    );
  }

  return (
    <div>
      {/* Hero */}
      <section className="border-b bg-surface-2">
        <div className="mx-auto max-w-3xl px-6 py-16 text-center">
          <h1 className="text-4xl font-bold text-fg">{HERO.title}</h1>
          <p className="mt-5 text-lg text-fg-muted">{HERO.intro}</p>
          <p className="mt-4 text-fg-muted">{HERO.outro}</p>
          <ul className="mt-10 grid gap-4 text-left sm:grid-cols-2">
            {HERO.perks.map((perk) => (
              <li key={perk.title} className="rounded-lg border bg-surface p-4">
                <h2 className="font-semibold text-accent">{perk.title}</h2>
                <p className="mt-1 text-sm text-fg-muted">{perk.text}</p>
              </li>
            ))}
          </ul>
        </div>
      </section>

      {/* Formulario */}
      <section className="mx-auto max-w-xl px-6 py-14">
        <h2 className="text-2xl font-bold text-fg">Postulate</h2>
        <p className="mt-1 text-sm text-fg-subtle">Los campos con * son obligatorios.</p>

        <form onSubmit={handleSubmit} noValidate className="relative mt-8 space-y-4">
          <TextField label="Nombre y apellido" name="full_name" value={form.full_name} onChange={handleChange} required maxLength={150} autoComplete="name" error={errors.full_name} />
          <TextField label="Email" name="email" type="email" value={form.email} onChange={handleChange} required maxLength={320} autoComplete="email" error={errors.email} />
          <TextField label="Teléfono / WhatsApp (opcional)" name="phone" value={form.phone} onChange={handleChange} maxLength={50} autoComplete="tel" error={errors.phone} />
          <TextField label="Ciudad y país" name="location" value={form.location} onChange={handleChange} required maxLength={150} placeholder="Ej: Rosario, Argentina" error={errors.location} />
          <SelectField label="Área de interés" name="area" value={form.area} onChange={handleChange} options={AREAS} required error={errors.area} />
          <SelectField label="Nivel de experiencia" name="experience_level" value={form.experience_level} onChange={handleChange} options={LEVELS} />
          <TextField label="LinkedIn (opcional)" name="linkedin_url" type="url" value={form.linkedin_url} onChange={handleChange} maxLength={500} placeholder="https://linkedin.com/in/..." error={errors.linkedin_url} />
          <TextField label="GitHub o portfolio (opcional)" name="github_url" type="url" value={form.github_url} onChange={handleChange} maxLength={500} placeholder="https://github.com/..." error={errors.github_url} />
          <TextField
            label="Link a tu CV (opcional)"
            name="cv_url"
            type="url"
            value={form.cv_url}
            onChange={handleChange}
            maxLength={500}
            placeholder="https://drive.google.com/..."
            hint="Subilo a Drive o Dropbox y pegá el link (con permiso de lectura para quien tenga el enlace)."
            error={errors.cv_url}
          />
          <TextAreaField label="Contanos por qué querés sumarte" name="motivation" value={form.motivation} onChange={handleChange} required maxLength={MAX_MOTIVATION} minLength={MIN_MOTIVATION} error={errors.motivation} />
          <SelectField label="Disponibilidad" name="availability" value={form.availability} onChange={handleChange} options={AVAILABILITY} />

          <CheckboxField name="consent" checked={form.consent} onChange={handleChange} error={errors.consent}>
            Acepto que AJR Data trate mis datos personales para evaluar mi postulación y contactarme.
            Puedo pedir que los borren escribiéndonos.
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
            {createApplication.isPending ? "Enviando..." : "Enviar postulación"}
          </button>

          {createApplication.isError && (
            <p role="alert" className="text-sm text-red-600 dark:text-red-400">
              {getFormErrorMessage(createApplication.error, "postulación")}
            </p>
          )}
        </form>
      </section>
    </div>
  );
}
