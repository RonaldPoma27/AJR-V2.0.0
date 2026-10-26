import { useEffect, useId, useRef, useState } from "react";
import { Trans, useTranslation } from "react-i18next";
import { Check } from "lucide-react";
import { Link, useLocation, useSearchParams } from "react-router-dom";
import i18n from "@/i18n";
import { useMe } from "@/api/auth";
import { useCreateOrder } from "@/api/orders";
import Turnstile, { turnstileEnabled, type TurnstileHandle } from "@/components/Turnstile";
import { Honeypot, SelectField, TextAreaField, TextField } from "@/components/forms/Fields";
import { getFormErrorMessage } from "@/lib/errors";
import {
  BUDGET_SLUGS,
  isPlanSlug,
  PLAN_PRICE_USD,
  PLAN_SLUGS,
  TIMELINE_SLUGS,
  type BudgetSlug,
  type PlanSlug,
  type TimelineSlug,
} from "@/lib/plans";
import { toast } from "@/lib/toast";
import { cn } from "@/lib/utils";

const MAX_DESCRIPTION = 5000;
const MIN_DESCRIPTION = 10;

/** Pasos del formulario, en orden. El índice es el estado `step`. */
const STEPS = ["plan", "project", "contact"] as const;
const LAST_STEP = STEPS.length - 1;

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
type ChoiceErrors = Partial<Record<"plan" | "budget" | "timeline" | "domain", string>>;

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

/** Plan que viene de la URL (?plan=…, lo que sobrevive al login) o del estado del router. */
function usePlanFromLocation(): PlanSlug | null {
  const [params] = useSearchParams();
  const location = useLocation();
  const fromUrl = params.get("plan");
  if (isPlanSlug(fromUrl)) return fromUrl;
  const fromState = (location.state as { plan?: unknown } | null)?.plan;
  return isPlanSlug(fromState) ? fromState : null;
}

export default function ProjectRequestForm() {
  const { t } = useTranslation();
  const { data: me } = useMe();
  const [, setSearchParams] = useSearchParams();
  const createOrder = useCreateOrder();
  const turnstileRef = useRef<TurnstileHandle>(null);
  const headingRef = useRef<HTMLHeadingElement>(null);
  const firstRender = useRef(true);

  const planFromLocation = usePlanFromLocation();
  const [plan, setPlan] = useState<PlanSlug | null>(planFromLocation);
  // Si ya llegó con un plan elegido (desde las tarjetas), arranca en "Tu proyecto".
  const [step, setStep] = useState(planFromLocation ? 1 : 0);
  const [budget, setBudget] = useState<BudgetSlug | "">("");
  const [timeline, setTimeline] = useState<TimelineSlug | "">("");
  const [hasDomain, setHasDomain] = useState<boolean | null>(null);
  const [choiceErrors, setChoiceErrors] = useState<ChoiceErrors>({});

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

  // Al cambiar de paso, el foco va al título del paso (lectores de pantalla y teclado).
  useEffect(() => {
    if (firstRender.current) {
      firstRender.current = false;
      return;
    }
    headingRef.current?.focus();
  }, [step]);

  function choosePlan(slug: PlanSlug) {
    setPlan(slug);
    setChoiceErrors((e) => ({ ...e, plan: undefined }));
    // Deja el plan en la URL: si recarga la página o comparte el link, la selección se mantiene.
    setSearchParams({ plan: slug }, { replace: true });
  }

  /** Errores de las elecciones propias de un paso (el de contacto usa `validate`). */
  function validateChoices(index: number): ChoiceErrors {
    const found: ChoiceErrors = {};
    if (index === 0 && !plan) found.plan = t("requestForm.errors.plan");
    if (index === 1) {
      if (!budget) found.budget = t("requestForm.errors.budget");
      if (!timeline) found.timeline = t("requestForm.errors.timeline");
      if (hasDomain === null) found.domain = t("requestForm.errors.domain");
    }
    return found;
  }

  function goNext() {
    const found = validateChoices(step);
    setChoiceErrors(found);
    if (Object.keys(found).length === 0) setStep((s) => Math.min(s + 1, LAST_STEP));
  }

  function handleChange(e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) {
    const { name, value } = e.target;
    const next = { ...form, [name]: value };
    setForm(next);
    if (submitted) setErrors(validate(next)); // una vez que intentó enviar, valida en vivo
  }

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    // Enter en los primeros pasos avanza; solo el último envía.
    if (step < LAST_STEP) {
      goNext();
      return;
    }
    setSubmitted(true);

    // Por si algo quedó incompleto en pasos anteriores: se vuelve al primero que falte.
    for (let i = 0; i < LAST_STEP; i++) {
      const missing = validateChoices(i);
      if (Object.keys(missing).length > 0) {
        setChoiceErrors(missing);
        setStep(i);
        return;
      }
    }

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
        plan: plan ?? undefined,
        budget: budget || undefined,
        timeline: timeline || undefined,
        has_domain: hasDomain ?? undefined,
        turnstile_token: token ?? undefined,
        website: honeypot,
      },
      {
        // El token de Turnstile es de un solo uso: hay que pedir otro tras cada intento.
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
    setSubmitted(false);
    setPlan(null);
    setBudget("");
    setTimeline("");
    setHasDomain(null);
    setChoiceErrors({});
    setStep(0);
    setSearchParams({}, { replace: true });
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

  const isLast = step === LAST_STEP;

  return (
    <div className="mx-auto max-w-xl px-6 py-16">
      <h1 className="text-3xl font-bold text-fg">{t("orderForm.title")}</h1>
      <p className="mt-2 text-fg-muted">{t("orderForm.subtitle")}</p>

      <StepIndicator step={step} onGoTo={(i) => i < step && setStep(i)} />

      <form onSubmit={handleSubmit} noValidate className="relative mt-8">
        <div key={step} className="animate-chat-in space-y-5 motion-reduce:animate-none">
          <h2 ref={headingRef} tabIndex={-1} className="text-xl font-semibold text-fg focus:outline-none">
            {t(`requestForm.heading.${STEPS[step]}`)}
          </h2>

          {step === 0 && <PlanStep plan={plan} onChoose={choosePlan} error={choiceErrors.plan} />}

          {step === 1 && (
            <>
              {plan && <PlanSummary plan={plan} onChange={() => setStep(0)} />}
              <SelectField
                label={t("requestForm.budget.label")}
                name="budget"
                value={budget}
                onChange={(e) => {
                  setBudget(e.target.value as BudgetSlug | "");
                  setChoiceErrors((c) => ({ ...c, budget: undefined }));
                }}
                options={BUDGET_SLUGS.map((slug) => ({ value: slug, label: t(`requestForm.budget.options.${slug}`) }))}
                required
                error={choiceErrors.budget}
              />
              <SelectField
                label={t("requestForm.timeline.label")}
                name="timeline"
                value={timeline}
                onChange={(e) => {
                  setTimeline(e.target.value as TimelineSlug | "");
                  setChoiceErrors((c) => ({ ...c, timeline: undefined }));
                }}
                options={TIMELINE_SLUGS.map((slug) => ({ value: slug, label: t(`requestForm.timeline.options.${slug}`) }))}
                required
                error={choiceErrors.timeline}
              />
              <YesNoToggle
                label={t("requestForm.domain.label")}
                hint={t("requestForm.domain.hint")}
                yesLabel={t("requestForm.domain.yes")}
                noLabel={t("requestForm.domain.no")}
                value={hasDomain}
                onChange={(v) => {
                  setHasDomain(v);
                  setChoiceErrors((c) => ({ ...c, domain: undefined }));
                }}
                error={choiceErrors.domain}
              />
            </>
          )}

          {step === 2 && (
            <>
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
            </>
          )}
        </div>

        <div className="mt-8 flex items-center gap-3">
          {step > 0 && (
            <button
              type="button"
              onClick={() => setStep((s) => Math.max(s - 1, 0))}
              className="rounded-md border px-5 py-3 font-medium text-fg hover:bg-surface-2"
            >
              {t("requestForm.back")}
            </button>
          )}
          {isLast ? (
            <button
              type="submit"
              disabled={createOrder.isPending || (turnstileEnabled && !token)}
              className="btn-cta flex-1 rounded-md bg-brand px-6 py-3 font-medium text-white hover:bg-brand-dark disabled:opacity-50"
            >
              {createOrder.isPending ? t("orderForm.sending") : t("orderForm.submit")}
            </button>
          ) : (
            <button
              type="submit"
              className="btn-cta flex-1 rounded-md bg-brand px-6 py-3 font-medium text-white hover:bg-brand-dark"
            >
              {t("requestForm.next")}
            </button>
          )}
        </div>

        {createOrder.isError && (
          <p role="alert" className="mt-4 text-sm text-red-600 dark:text-red-400">
            {getFormErrorMessage(createOrder.error, "order")}
          </p>
        )}
      </form>
    </div>
  );
}

/** Indicador de los 3 pasos. Los ya completados son botones para volver atrás. */
function StepIndicator({ step, onGoTo }: { step: number; onGoTo: (index: number) => void }) {
  const { t } = useTranslation();
  return (
    <nav aria-label={t("requestForm.progress")} className="mt-8">
      <ol className="flex items-center gap-2">
        {STEPS.map((key, index) => {
          const done = index < step;
          const active = index === step;
          const body = (
            <>
              <span
                className={cn(
                  "flex h-7 w-7 shrink-0 items-center justify-center rounded-full border-2 text-xs font-semibold",
                  done && "border-emerald-500 bg-emerald-500 text-white",
                  active && "border-accent bg-surface text-accent",
                  !done && !active && "border-line bg-surface-2 text-fg-subtle"
                )}
              >
                {done ? <Check className="h-4 w-4" strokeWidth={3} aria-hidden /> : index + 1}
              </span>
              <span className={cn("text-sm", active ? "font-semibold text-fg" : done ? "text-fg-muted" : "text-fg-subtle")}>
                {t(`requestForm.steps.${key}`)}
              </span>
            </>
          );
          return (
            <li key={key} aria-current={active ? "step" : undefined} className="flex items-center gap-2">
              {index > 0 && <span aria-hidden className={cn("h-px w-6 sm:w-10", done || active ? "bg-emerald-500" : "bg-line")} />}
              {done ? (
                <button type="button" onClick={() => onGoTo(index)} className="flex items-center gap-2 rounded-md hover:opacity-80">
                  {body}
                </button>
              ) : (
                <span className="flex items-center gap-2">{body}</span>
              )}
            </li>
          );
        })}
      </ol>
      <p className="sr-only" aria-live="polite">
        {t("requestForm.stepOf", { current: step + 1, total: STEPS.length })}
      </p>
    </nav>
  );
}

/** Paso 1: tarjetas seleccionables (radio) con los tres planes. */
function PlanStep({
  plan,
  onChoose,
  error,
}: {
  plan: PlanSlug | null;
  onChoose: (slug: PlanSlug) => void;
  error?: string;
}) {
  const { t } = useTranslation();
  return (
    <div>
      <div role="radiogroup" aria-label={t("requestForm.plan.label")} className="grid gap-3">
        {PLAN_SLUGS.map((slug) => {
          const selected = plan === slug;
          return (
            <button
              key={slug}
              type="button"
              role="radio"
              aria-checked={selected}
              onClick={() => onChoose(slug)}
              className={cn(
                "flex items-start justify-between gap-4 rounded-xl border bg-surface/60 p-4 text-left backdrop-blur transition",
                "hover:border-indigo-500/60 hover:bg-surface",
                selected && "border-transparent bg-surface ring-2 ring-indigo-500/60"
              )}
            >
              <span className="min-w-0">
                <span className="block font-semibold text-fg">{t(`pricing.plans.${slug}.name`)}</span>
                <span className="mt-0.5 block text-sm text-fg-muted">{t(`pricing.plans.${slug}.tagline`)}</span>
              </span>
              <span className="shrink-0 text-right">
                <span className="block text-xs text-fg-subtle">{t("pricing.from")}</span>
                <span className="block font-bold text-fg">{t("pricing.price", { amount: PLAN_PRICE_USD[slug] })}</span>
              </span>
            </button>
          );
        })}
      </div>
      {error && (
        <p role="alert" className="mt-2 text-sm text-red-600 dark:text-red-400">
          {error}
        </p>
      )}
    </div>
  );
}

/** Plan elegido, con acceso para cambiarlo sin perder lo demás. */
function PlanSummary({ plan, onChange }: { plan: PlanSlug; onChange: () => void }) {
  const { t } = useTranslation();
  return (
    <div className="flex items-center justify-between gap-3 rounded-xl border bg-surface-2 px-4 py-3 text-sm">
      <p className="min-w-0 text-fg-muted">
        {t("requestForm.plan.chosen")}{" "}
        <span className="font-semibold text-fg">{t(`pricing.plans.${plan}.name`)}</span>{" "}
        <span className="text-fg-subtle">· {t("pricing.from")} {t("pricing.price", { amount: PLAN_PRICE_USD[plan] })}</span>
      </p>
      <button type="button" onClick={onChange} className="shrink-0 font-medium text-accent hover:underline">
        {t("requestForm.plan.change")}
      </button>
    </div>
  );
}

/** Sí / No como dos botones (radio): más rápido que un select para una pregunta binaria. */
function YesNoToggle({
  label,
  hint,
  yesLabel,
  noLabel,
  value,
  onChange,
  error,
}: {
  label: string;
  hint?: string;
  yesLabel: string;
  noLabel: string;
  value: boolean | null;
  onChange: (value: boolean) => void;
  error?: string;
}) {
  const labelId = useId();
  const options: [boolean, string][] = [
    [true, yesLabel],
    [false, noLabel],
  ];
  return (
    <div>
      <p id={labelId} className="block text-sm font-medium text-fg-muted">
        {label}
        <span className="text-red-500 dark:text-red-400"> *</span>
      </p>
      <div role="radiogroup" aria-labelledby={labelId} className="mt-1 grid grid-cols-2 gap-3">
        {options.map(([optionValue, text]) => {
          const selected = value === optionValue;
          return (
            <button
              key={String(optionValue)}
              type="button"
              role="radio"
              aria-checked={selected}
              onClick={() => onChange(optionValue)}
              className={cn(
                "rounded-md border px-4 py-2.5 text-sm font-medium transition-colors",
                selected ? "border-accent bg-accent/10 text-accent" : "bg-surface text-fg-muted hover:bg-surface-2"
              )}
            >
              {text}
            </button>
          );
        })}
      </div>
      {error ? (
        <p role="alert" className="mt-1 text-sm text-red-600 dark:text-red-400">
          {error}
        </p>
      ) : (
        hint && <p className="mt-1 text-xs text-fg-subtle">{hint}</p>
      )}
    </div>
  );
}
