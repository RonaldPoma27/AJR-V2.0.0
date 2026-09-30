import { useRef, useState } from "react";
import { useCreateOrder } from "@/api/orders";
import Turnstile, { turnstileEnabled, type TurnstileHandle } from "@/components/Turnstile";
import { Honeypot, TextAreaField, TextField } from "@/components/forms/Fields";
import { getFormErrorMessage } from "@/lib/errors";

const MAX_DESCRIPTION = 5000;
const MIN_DESCRIPTION = 10;

const initialForm = {
  company_name: "",
  contact_name: "",
  contact_email: "",
  contact_phone: "",
  industry: "",
  problem_description: "",
};
type FormState = typeof initialForm;
type Errors = Partial<Record<keyof FormState | "turnstile", string>>;

function validate(form: FormState): Errors {
  const errors: Errors = {};
  if (!form.company_name.trim()) errors.company_name = "Contanos el nombre de tu PyME.";
  if (!form.contact_name.trim()) errors.contact_name = "Necesitamos tu nombre para escribirte.";
  if (!form.contact_email.trim()) {
    errors.contact_email = "Necesitamos un email para responderte.";
  } else if (!/^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(form.contact_email.trim())) {
    errors.contact_email = "Revisá el email: parece que tiene un error.";
  }
  if (form.contact_phone.trim() && !/^[\d+\-().\s]+$/.test(form.contact_phone.trim())) {
    errors.contact_phone = "Usá solo números, espacios y + - ( ).";
  }
  if (!form.industry.trim()) errors.industry = "Contanos a qué rubro se dedica tu negocio.";
  if (form.problem_description.trim().length < MIN_DESCRIPTION) {
    errors.problem_description = `Contanos un poquito más (mínimo ${MIN_DESCRIPTION} caracteres).`;
  }
  return errors;
}

export default function OrderForm() {
  const createOrder = useCreateOrder();
  const turnstileRef = useRef<TurnstileHandle>(null);
  const [form, setForm] = useState<FormState>(initialForm);
  const [honeypot, setHoneypot] = useState("");
  const [token, setToken] = useState<string | null>(null);
  const [errors, setErrors] = useState<Errors>({});
  const [submitted, setSubmitted] = useState(false);

  function handleChange(e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) {
    const { name, value } = e.target;
    const next = { ...form, [name]: value };
    setForm(next);
    if (submitted) setErrors(validate(next)); // una vez que intentó enviar, valida en vivo
  }

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setSubmitted(true);
    const found = validate(form);
    if (turnstileEnabled && !token) found.turnstile = "Completá la verificación anti-spam.";
    setErrors(found);
    if (Object.keys(found).length > 0) return;

    createOrder.mutate(
      {
        company_name: form.company_name.trim(),
        contact_name: form.contact_name.trim(),
        contact_email: form.contact_email.trim(),
        contact_phone: form.contact_phone.trim() || undefined,
        industry: form.industry.trim(),
        problem_description: form.problem_description.trim(),
        turnstile_token: token ?? undefined,
        website: honeypot,
      },
      {
        // El token de Turnstile es de un solo uso: hay que pedir otro tras cada intento.
        onError: () => turnstileRef.current?.reset(),
      }
    );
  }

  function sendAnother() {
    createOrder.reset();
    setForm(initialForm);
    setHoneypot("");
    setToken(null);
    setErrors({});
    setSubmitted(false);
  }

  if (createOrder.isSuccess) {
    return (
      <div className="mx-auto max-w-xl px-6 py-24 text-center">
        <h1 className="text-2xl font-bold text-gray-900">¡Gracias!</h1>
        <p className="mt-2 text-gray-600">
          Recibimos tu pedido. Te mandamos un mail de confirmación y te vamos a contactar a la
          brevedad.
        </p>
        <button
          type="button"
          onClick={sendAnother}
          className="mt-8 rounded-md border border-brand px-6 py-2 font-medium text-brand hover:bg-brand hover:text-white"
        >
          Enviar otro pedido
        </button>
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-xl px-6 py-16">
      <h1 className="text-3xl font-bold text-gray-900">Contacto — Solicitar proyecto</h1>
      <p className="mt-2 text-gray-600">Contanos el problema de tu negocio y lo vemos juntos.</p>

      <form onSubmit={handleSubmit} noValidate className="relative mt-8 space-y-4">
        <TextField label="Nombre de la PyME" name="company_name" value={form.company_name} onChange={handleChange} required maxLength={200} error={errors.company_name} />
        <TextField label="Tu nombre" name="contact_name" value={form.contact_name} onChange={handleChange} required maxLength={200} autoComplete="name" error={errors.contact_name} />
        <TextField label="Email de contacto" name="contact_email" type="email" value={form.contact_email} onChange={handleChange} required maxLength={320} autoComplete="email" error={errors.contact_email} />
        <TextField label="Teléfono (opcional)" name="contact_phone" value={form.contact_phone} onChange={handleChange} maxLength={50} autoComplete="tel" error={errors.contact_phone} />
        <TextField label="Rubro de tu negocio" name="industry" value={form.industry} onChange={handleChange} required maxLength={120} error={errors.industry} />
        <TextAreaField label="Describí el problema a resolver" name="problem_description" value={form.problem_description} onChange={handleChange} required maxLength={MAX_DESCRIPTION} minLength={MIN_DESCRIPTION} error={errors.problem_description} />

        <Honeypot value={honeypot} onChange={(e) => setHoneypot(e.target.value)} />

        <div>
          <Turnstile ref={turnstileRef} onToken={setToken} />
          {errors.turnstile && (
            <p role="alert" className="mt-1 text-sm text-red-600">
              {errors.turnstile}
            </p>
          )}
        </div>

        <button
          type="submit"
          disabled={createOrder.isPending || (turnstileEnabled && !token)}
          className="w-full rounded-md bg-brand px-6 py-3 font-medium text-white hover:bg-brand-dark disabled:opacity-50"
        >
          {createOrder.isPending ? "Enviando..." : "Enviar pedido"}
        </button>

        {createOrder.isError && (
          <p role="alert" className="text-sm text-red-600">
            {getFormErrorMessage(createOrder.error, "pedido")}
          </p>
        )}
      </form>
    </div>
  );
}
