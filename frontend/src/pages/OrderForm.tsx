import { useEffect, useRef, useState } from "react";
import { Trans, useTranslation } from "react-i18next";
import { Link, useLocation } from "react-router-dom";
import i18n from "@/i18n";
import { getToken, useMe } from "@/api/auth";
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
  if (!form.company_name.trim()) errors.company_name = i18n.t("orderForm.errors.company");
  if (!form.contact_name.trim()) errors.contact_name = i18n.t("orderForm.errors.name");
  if (!form.contact_email.trim()) {
    errors.contact_email = i18n.t("orderForm.errors.emailRequired");
  } else if (!/^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(form.contact_email.trim())) {
    errors.contact_email = i18n.t("orderForm.errors.emailInvalid");
  }
  if (form.contact_phone.trim() && !/^[\d+\-().\s]+$/.test(form.contact_phone.trim())) {
    errors.contact_phone = i18n.t("orderForm.errors.phone");
  }
  if (!form.industry.trim()) errors.industry = i18n.t("orderForm.errors.industry");
  if (form.problem_description.trim().length < MIN_DESCRIPTION) {
    errors.problem_description = i18n.t("orderForm.errors.description", { min: MIN_DESCRIPTION });
  }
  return errors;
}

export default function OrderForm() {
  const { t } = useTranslation();
  const location = useLocation();
  const { data: me } = useMe();
  const createOrder = useCreateOrder();
  const turnstileRef = useRef<TurnstileHandle>(null);
  const [form, setForm] = useState<FormState>(initialForm);
  const [honeypot, setHoneypot] = useState("");
  const [token, setToken] = useState<string | null>(null);
  const [errors, setErrors] = useState<Errors>({});
  const [submitted, setSubmitted] = useState(false);

  // Con la sesión iniciada, precargamos nombre y email (se pueden editar).
  useEffect(() => {
    if (!me) return;
    setForm((f) => ({
      ...f,
      contact_name: f.contact_name || me.full_name || "",
      contact_email: f.contact_email || me.email,
    }));
  }, [me]);

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
    if (turnstileEnabled && !token) found.turnstile = t("turnstile.required");
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
    setForm({ ...initialForm, contact_name: me?.full_name ?? "", contact_email: me?.email ?? "" });
    setHoneypot("");
    setToken(null);
    setErrors({});
    setSubmitted(false);
  }

  // El pedido queda asociado a la cuenta del cliente: hace falta iniciar sesión.
  if (!getToken()) {
    return (
      <div className="mx-auto max-w-xl px-6 py-20 text-center">
        <h1 className="text-2xl font-bold text-fg">{t("orderForm.loginTitle")}</h1>
        <p className="mt-2 text-fg-muted">
          {t("orderForm.loginText")}
        </p>
        <div className="mt-8 flex flex-wrap justify-center gap-3">
          <Link to="/login" state={{ from: location.pathname }} className="rounded-md bg-brand px-6 py-2.5 font-medium text-white hover:bg-brand-dark">
            {t("orderForm.login")}
          </Link>
          <Link to="/registro" state={{ from: location.pathname }} className="rounded-md border px-6 py-2.5 font-medium text-fg hover:bg-surface-2">
            {t("orderForm.register")}
          </Link>
        </div>
      </div>
    );
  }

  if (createOrder.isSuccess) {
    return (
      <div className="mx-auto max-w-xl px-6 py-24 text-center">
        <h1 className="text-2xl font-bold text-fg">{t("orderForm.thanks")}</h1>
        <p className="mt-2 text-fg-muted">
          <Trans
            i18nKey="orderForm.successText"
            components={{ 1: <Link to="/cuenta/pedidos" className="font-medium text-accent hover:underline" /> }}
          />
        </p>
        <button
          type="button"
          onClick={sendAnother}
          className="mt-8 rounded-md border border-brand px-6 py-2 font-medium text-accent hover:bg-brand hover:text-white"
        >
          {t("orderForm.sendAnother")}
        </button>
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-xl px-6 py-16">
      <h1 className="text-3xl font-bold text-fg">{t("orderForm.title")}</h1>
      <p className="mt-2 text-fg-muted">{t("orderForm.subtitle")}</p>

      <form onSubmit={handleSubmit} noValidate className="relative mt-8 space-y-4">
        <TextField label={t("orderForm.company")} name="company_name" value={form.company_name} onChange={handleChange} required maxLength={200} error={errors.company_name} />
        <TextField label={t("orderForm.name")} name="contact_name" value={form.contact_name} onChange={handleChange} required maxLength={200} autoComplete="name" error={errors.contact_name} />
        <TextField label={t("orderForm.email")} name="contact_email" type="email" value={form.contact_email} onChange={handleChange} required maxLength={320} autoComplete="email" error={errors.contact_email} />
        <TextField label={t("orderForm.phone")} name="contact_phone" value={form.contact_phone} onChange={handleChange} maxLength={50} autoComplete="tel" error={errors.contact_phone} />
        <TextField label={t("orderForm.industry")} name="industry" value={form.industry} onChange={handleChange} required maxLength={120} error={errors.industry} />
        <TextAreaField label={t("orderForm.description")} name="problem_description" value={form.problem_description} onChange={handleChange} required maxLength={MAX_DESCRIPTION} minLength={MIN_DESCRIPTION} error={errors.problem_description} />

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
          disabled={createOrder.isPending || (turnstileEnabled && !token)}
          className="w-full rounded-md bg-brand px-6 py-3 font-medium text-white hover:bg-brand-dark disabled:opacity-50"
        >
          {createOrder.isPending ? t("orderForm.sending") : t("orderForm.submit")}
        </button>

        {createOrder.isError && (
          <p role="alert" className="text-sm text-red-600 dark:text-red-400">
            {getFormErrorMessage(createOrder.error, "order")}
          </p>
        )}
      </form>
    </div>
  );
}
