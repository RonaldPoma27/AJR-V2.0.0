import { useEffect, useRef, useState } from "react";
import { Trans, useTranslation } from "react-i18next";
import { Link, useLocation, useSearchParams } from "react-router-dom";
import { Check } from "lucide-react";
import i18n from "@/i18n";
import { useMe } from "@/api/auth";
import { useCreateOrder } from "@/api/orders";
import Turnstile, { turnstileEnabled, type TurnstileHandle } from "@/components/Turnstile";
import { Honeypot, SelectField, TextAreaField, TextField } from "@/components/forms/Fields";
import { getFormErrorMessage } from "@/lib/errors";
import {
  BUDGET_KEYS,
  PLAN_KEYS,
  PLAN_PRICE_USD,
  TIMELINE_KEYS,
  isPlanKey,
  type BudgetKey,
  type PlanKey,
  type TimelineKey,
} from "@/lib/plans";
import { toast } from "@/lib/toast";
import { cn } from "@/lib/utils";

const MAX_DESCRIPTION = 5000;
const MIN_DESCRIPTION = 10;
const STEPS = ["project", "business", "detail"] as const;

interface FormState {
  plan: PlanKey | "";
  budget: BudgetKey | "";
  timeline: TimelineKey | "";
  has_domain: boolean | null;
  company_name: string;
  contact_name: string;
  contact_email: string;
  contact_phone: string;
  industry: string;
  problem_description: string;
}
type Errors = Partial<Record<keyof FormState | "turnstile", string>>;

const initialForm: FormState = {
  plan: "",
  budget: "",
  timeline: "",
  has_domain: null,
  company_name: "",
  contact_name: "",
  contact_email: "",
  contact_phone: "",
  industry: "",
  problem_description: "",
};

/** Valida solo los campos del paso indicado (los textos salen del idioma activo). */
function validate(form: FormState, step: number): Errors {
  const e: Errors = {};
  if (step === 0) {
    if (!form.plan) e.plan = i18n.t("requestForm.errors.plan");
    if (!form.budget) e.budget = i18n.t("requestForm.errors.budget");
    if (!form.timeline) e.timeline = i18n.t("requestForm.errors.timeline");
    if (form.has_domain === null) e.has_domain = i18n.t("requestForm.errors.domain");
  }
  if (step === 1) {
    if (!form.company_name.trim()) e.company_name = i18n.t("orderForm.errors.company");
    if (!form.contact_name.trim()) e.contact_name = i18n.t("orderForm.errors.name");
    if (!form.contact_email.trim()) {
      e.contact_email = i18n.t("orderForm.errors.emailRequired");
    } else if (!/^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(form.contact_email.trim())) {
      e.contact_email = i18n.t("orderForm.errors.emailInvalid");
    }
    if (form.contact_phone.trim() && !/^[\d+\-().\s]+$/.test(form.contact_phone.trim())) {
      e.contact_phone = i18n.t("orderForm.errors.phone");
    }
    if (!form.industry.trim()) e.industry = i18n.t("orderForm.errors.industry");
  }
  if (step === 2 && form.problem_description.trim().length < MIN_DESCRIPTION) {
    e.problem_description = i18n.t("orderForm.errors.description", { min: MIN_DESCRIPTION });
  }
  return e;
}

/** Botón-opción (radio visual) para plan y dominio. */
function ChoiceButton({
  selected,
  onClick,
  children,
  className,
}: {
  selected: boolean;
  onClick: () => void;
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <button
      type="button"
      role="radio"
      aria-checked={selected}
      onClick={onClick}
      className={cn(
        "rounded-lg border bg-surface px-4 py-3 text-left text-sm transition-all duration-200 hover:-translate-y-0.5 hover:border-brand",
        selected && "border-brand bg-surface-2 ring-2 ring-brand/40",
        className
      )}
    >
      {children}
    </button>
  );
}

/**
 * Formulario de pedido por pasos: 1) proyecto (plan, presupuesto, plazo, dominio), 2) negocio y
 * contacto, 3) detalle + anti-spam. El plan puede venir preseleccionado en `?plan=` o en el estado
 * del router (tarjetas de precios). Maneja también la pantalla de "¡Gracias!".
 */
export default function ProjectRequestForm() {
  const { t } = useTranslation();
  const location = useLocation();
  const [searchParams] = useSearchParams();
  const { data: me } = useMe();
  const createOrder = useCreateOrder();
  const turnstileRef = useRef<TurnstileHandle>(null);
  const headingRef = useRef<HTMLHeadingElement>(null);

  const planFromUrl = searchParams.get("plan") ?? (location.state as { plan?: string } | null)?.plan ?? null;
  const [form, setForm] = useState<FormState>({ ...initialForm, plan: isPlanKey(planFromUrl) ? planFromUrl : "" });
  const [step, setStep] = useState(0);
  const [honeypot, setHoneypot] = useState("");
  const [token, setToken] = useState<string | null>(null);
  const [errors, setErrors] = useState<Errors>({});

  // Con la sesión iniciada, precargamos nombre y email (se pueden editar).
  useEffect(() => {
    if (!me) return;
    setForm((f) => ({ ...f, contact_name: f.contact_name || me.full_name || "", contact_email: f.contact_email || me.email }));
  }, [me]);

  // Al cambiar de paso, el foco va al título del paso (accesibilidad con teclado/lector).
  const firstRender = useRef(true);
  useEffect(() => {
    if (firstRender.current) {
      firstRender.current = false;
      return;
    }
    headingRef.current?.focus();
  }, [step]);

  function set<K extends keyof FormState>(key: K, value: FormState[K]) {
    setForm((f) => ({ ...f, [key]: value }));
    setErrors((e) => ({ ...e, [key]: undefined }));
  }
  function handleText(e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) {
    set(e.target.name as keyof FormState, e.target.value as never);
  }

  function next() {
    const found = validate(form, step);
    setErrors(found);
    if (Object.keys(found).length === 0) setStep((s) => Math.min(s + 1, STEPS.length - 1));
  }

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (step < STEPS.length - 1) return next(); // Enter en pasos 1 y 2 = Continuar

    const found: Errors = { ...validate(form, 0), ...validate(form, 1), ...validate(form, 2) };
    if (turnstileEnabled && !token) found.turnstile = t("turnstile.required");
    setErrors(found);
    if (Object.keys(found).length > 0) {
      // Si falta algo de un paso anterior, volvemos a ese paso.
      if (Object.keys(validate(form, 0)).length) setStep(0);
      else if (Object.keys(validate(form, 1)).length) setStep(1);
      return;
    }

    createOrder.mutate(
      {
        company_name: form.company_name.trim(),
        contact_name: form.contact_name.trim(),
        contact_email: form.contact_email.trim(),
        contact_phone: form.contact_phone.trim() || undefined,
        industry: form.industry.trim(),
        problem_description: form.problem_description.trim(),
        plan: form.plan || undefined,
        budget: form.budget || undefined,
        timeline: form.timeline || undefined,
        has_domain: form.has_domain ?? undefined,
        turnstile_token: token ?? undefined,
        website: honeypot,
      },
      {
        onSuccess: () => toast.success(t("orderForm.thanks")),
        onError: (err) => {
          turnstileRef.current?.reset();
          toast.error(getFormErrorMessage(err, "order"));
        },
      }
    );
  }

  function sendAnother() {
    createOrder.reset();
    setForm({ ...initialForm, contact_name: me?.full_name ?? "", contact_email: me?.email ?? "" });
    setHoneypot("");
    setToken(null);
    setErrors({});
    setStep(0);
  }

  if (createOrder.isSuccess) {
    return (
      <div className="mx-auto max-w-xl px-6 py-24 text-center">
        <h1 className="text-2xl font-bold text-fg">{t("orderForm.thanks")}</h1>
        <p className="mt-2 text-fg-muted">
          <Trans
            i18nKey="orderForm.successText"
            components={{ 1: <Link viewTransition to="/cuenta/pedidos" className="font-medium text-accent hover:underline" /> }}
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

  const last = step === STEPS.length - 1;
  const budgetOptions = BUDGET_KEYS.map((k) => ({ value: k, label: t(`requestForm.budgets.${k}`) }));
  const timelineOptions = TIMELINE_KEYS.map((k) => ({ value: k, label: t(`requestForm.timelines.${k}`) }));

  return (
    <div className="mx-auto max-w-2xl px-6 py-16">
      <h1 className="text-3xl font-bold text-fg">{t("requestForm.title")}</h1>
      <p className="mt-2 text-fg-muted">{t("requestForm.subtitle")}</p>

      {/* Indicador de pasos */}
      <ol className="mt-8 flex items-center" aria-label={t("requestForm.stepLabel", { current: step + 1, total: STEPS.length })}>
        {STEPS.map((key, i) => (
          <li key={key} aria-current={i === step ? "step" : undefined} className={cn("flex items-center", i < STEPS.length - 1 && "flex-1")}>
            <span
              className={cn(
                "flex h-8 w-8 shrink-0 items-center justify-center rounded-full border-2 text-xs font-semibold transition-colors duration-300",
                i < step && "border-green-600 bg-green-600 text-white dark:border-green-500 dark:bg-green-500",
                i === step && "border-brand bg-surface text-accent",
                i > step && "border-line bg-surface text-fg-subtle"
              )}
            >
              {i < step ? <Check className="h-4 w-4" strokeWidth={2.5} aria-hidden /> : i + 1}
            </span>
            <span className={cn("ml-2 hidden text-sm sm:inline", i === step ? "font-semibold text-fg" : "text-fg-subtle")}>
              {t(`requestForm.steps.${key}`)}
            </span>
            {i < STEPS.length - 1 && <span aria-hidden className={cn("mx-3 h-0.5 flex-1 transition-colors duration-500", i < step ? "bg-green-600 dark:bg-green-500" : "bg-line")} />}
          </li>
        ))}
      </ol>

      <form onSubmit={handleSubmit} noValidate className="relative mt-8 rounded-xl border bg-surface p-6 sm:p-8">
        <h2 ref={headingRef} tabIndex={-1} className="text-lg font-semibold text-fg focus:outline-none">
          {t("requestForm.stepLabel", { current: step + 1, total: STEPS.length })} · {t(`requestForm.steps.${STEPS[step]}`)}
        </h2>

        <div key={step} className="mt-6 animate-chat-in space-y-5 motion-reduce:animate-none">
          {step === 0 && (
            <>
              <fieldset>
                <legend className="text-sm font-medium text-fg-muted">
                  {t("requestForm.project.plan")} <span className="text-red-500 dark:text-red-400">*</span>
                </legend>
                <div role="radiogroup" aria-label={t("requestForm.project.plan")} className="mt-2 grid gap-3 sm:grid-cols-3">
                  {PLAN_KEYS.map((k) => (
                    <ChoiceButton key={k} selected={form.plan === k} onClick={() => set("plan", k)}>
                      <span className="block font-semibold text-fg">{t(`pricing.plans.${k}.name`)}</span>
                      <span className="mt-0.5 block text-xs text-fg-subtle">
                        {t("pricing.from")} {t("pricing.currency")} {PLAN_PRICE_USD[k]}
                      </span>
                    </ChoiceButton>
                  ))}
                </div>
                {errors.plan && <p role="alert" className="mt-1 text-sm text-red-600 dark:text-red-400">{errors.plan}</p>}
              </fieldset>

              <div className="grid gap-5 sm:grid-cols-2">
                <SelectField label={t("requestForm.project.budget")} name="budget" value={form.budget} onChange={(e) => set("budget", e.target.value as BudgetKey | "")} options={budgetOptions} placeholder={t("requestForm.project.selectPlaceholder")} required error={errors.budget} />
                <SelectField label={t("requestForm.project.timeline")} name="timeline" value={form.timeline} onChange={(e) => set("timeline", e.target.value as TimelineKey | "")} options={timelineOptions} placeholder={t("requestForm.project.selectPlaceholder")} required error={errors.timeline} />
              </div>

              <fieldset>
                <legend className="text-sm font-medium text-fg-muted">
                  {t("requestForm.project.domain")} <span className="text-red-500 dark:text-red-400">*</span>
                </legend>
                <div role="radiogroup" aria-label={t("requestForm.project.domain")} className="mt-2 grid max-w-xs grid-cols-2 gap-3">
                  <ChoiceButton selected={form.has_domain === true} onClick={() => set("has_domain", true)} className="text-center font-medium text-fg">
                    {t("requestForm.project.yes")}
                  </ChoiceButton>
                  <ChoiceButton selected={form.has_domain === false} onClick={() => set("has_domain", false)} className="text-center font-medium text-fg">
                    {t("requestForm.project.no")}
                  </ChoiceButton>
                </div>
                {errors.has_domain && <p role="alert" className="mt-1 text-sm text-red-600 dark:text-red-400">{errors.has_domain}</p>}
              </fieldset>
            </>
          )}

          {step === 1 && (
            <>
              <TextField label={t("orderForm.company")} name="company_name" value={form.company_name} onChange={handleText} required maxLength={200} error={errors.company_name} />
              <TextField label={t("orderForm.name")} name="contact_name" value={form.contact_name} onChange={handleText} required maxLength={200} autoComplete="name" error={errors.contact_name} />
              <TextField label={t("orderForm.email")} name="contact_email" type="email" value={form.contact_email} onChange={handleText} required maxLength={320} autoComplete="email" error={errors.contact_email} />
              <TextField label={t("orderForm.phone")} name="contact_phone" value={form.contact_phone} onChange={handleText} maxLength={50} autoComplete="tel" error={errors.contact_phone} />
              <TextField label={t("orderForm.industry")} name="industry" value={form.industry} onChange={handleText} required maxLength={120} error={errors.industry} />
            </>
          )}

          {step === 2 && (
            <>
              <TextAreaField label={t("orderForm.description")} name="problem_description" value={form.problem_description} onChange={handleText} required maxLength={MAX_DESCRIPTION} minLength={MIN_DESCRIPTION} error={errors.problem_description} />
              <Honeypot value={honeypot} onChange={(e) => setHoneypot(e.target.value)} />
              <div>
                <Turnstile ref={turnstileRef} onToken={setToken} />
                {errors.turnstile && <p role="alert" className="mt-1 text-sm text-red-600 dark:text-red-400">{errors.turnstile}</p>}
              </div>
              {createOrder.isError && (
                <p role="alert" className="text-sm text-red-600 dark:text-red-400">{getFormErrorMessage(createOrder.error, "order")}</p>
              )}
            </>
          )}
        </div>

        <div className="mt-8 flex items-center justify-between gap-3">
          {step > 0 ? (
            <button type="button" onClick={() => setStep((s) => s - 1)} className="rounded-md border px-5 py-2.5 text-sm font-medium text-fg hover:bg-surface-2">
              {t("requestForm.back")}
            </button>
          ) : (
            <span />
          )}
          <button
            type="submit"
            disabled={last && (createOrder.isPending || (turnstileEnabled && !token))}
            className="btn-cta rounded-md bg-brand px-6 py-2.5 text-sm font-medium text-white hover:bg-brand-dark disabled:opacity-50"
          >
            {last ? (createOrder.isPending ? t("requestForm.sending") : t("requestForm.submit")) : t("requestForm.next")}
          </button>
        </div>
      </form>
    </div>
  );
}
