import { useState } from "react";
import { Link, useSearchParams } from "react-router-dom";
import { useTranslation } from "react-i18next";
import { ArrowLeft, CheckCircle2, CircleAlert, ClipboardCheck, ShieldCheck } from "lucide-react";
import { useSubmitOrderRegret } from "@/api/orders";
import { getServerDetail } from "@/lib/errors";
import { dateLocale } from "@/i18n";

function getRegretError(error: unknown): string {
  const detail = getServerDetail(error);
  if (detail) return detail;
  const status = (error as { response?: { status?: number } })?.response?.status;
  if (status === 404) return "No pudimos asociar un pedido con ese número y email. Revisá los datos e intentá nuevamente.";
  if (status === 429) return "Se realizaron demasiados intentos. Volvé a probar más tarde.";
  if (status === 422) return "Revisá el número de pedido y el formato del email.";
  return "No pudimos enviar la solicitud. Comprobá tu conexión e intentá nuevamente.";
}

export default function Arrepentimiento() {
  const { t } = useTranslation();
  const [searchParams] = useSearchParams();
  const [orderId, setOrderId] = useState(searchParams.get("pedido") ?? "");
  const [email, setEmail] = useState(searchParams.get("email") ?? "");
  const submitRegret = useSubmitOrderRegret();
  const [submitted, setSubmitted] = useState(false);

  const validOrderId = /^\d+$/.test(orderId.trim()) && Number(orderId) > 0 && Number.isSafeInteger(Number(orderId));
  const validEmail = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(email.trim());
  const canSubmit = !submitRegret.isPending;

  function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setSubmitted(true);
    if (!validOrderId || !validEmail) return;
    submitRegret.mutate({ order_id: Number(orderId), contact_email: email.trim() });
  }

  return (
    <div className="mx-auto w-full max-w-5xl px-1 py-5 sm:px-3 sm:py-8">
      <Link to="/" className="mb-5 inline-flex items-center gap-2 text-sm text-slate-400 transition hover:text-cyan-200">
        <ArrowLeft className="h-4 w-4" aria-hidden="true" />{t("regret.backHome")}
      </Link>
      <div className="grid gap-5 lg:grid-cols-[minmax(0,1fr)_20rem]">
        <section className="ajr-regret-panel rounded-[1.6rem] border border-white/10 p-6 shadow-[0_20px_70px_rgba(0,0,0,.25)] sm:p-9" aria-labelledby="regret-title">
          <div className="mb-5 inline-flex h-12 w-12 items-center justify-center rounded-2xl border border-cyan-300/20 bg-cyan-300/10 text-cyan-200">
            <ClipboardCheck className="h-6 w-6" aria-hidden="true" />
          </div>
          <p className="text-xs font-bold uppercase tracking-[0.18em] text-cyan-200">AJR DATA · ATENCIÓN AL CLIENTE</p>
          <h1 id="regret-title" className="mt-3 text-3xl font-bold tracking-tight text-white sm:text-4xl">{t("regret.title")}</h1>
          <p className="mt-3 max-w-2xl text-sm leading-7 text-slate-300">{t("regret.intro")}</p>

          {submitRegret.data ? (
            <div className="mt-8 rounded-2xl border border-emerald-300/25 bg-emerald-300/[0.07] p-5" role="status" aria-live="polite">
              <div className="flex items-center gap-3 text-emerald-200">
                <CheckCircle2 className="h-6 w-6" aria-hidden="true" />
                <h2 className="text-lg font-semibold">{t("regret.successTitle")}</h2>
              </div>
              <p className="mt-2 text-sm leading-6 text-slate-200">{t("regret.successText")}</p>
              <div className="mt-4 rounded-xl border border-white/10 bg-black/20 p-4">
                <p className="text-xs uppercase tracking-wider text-slate-400">{t("regret.codeLabel")}</p>
                <p className="mt-1 break-all font-mono text-xl font-bold tracking-wide text-white">{submitRegret.data.request_code}</p>
                <p className="mt-2 text-xs text-slate-400">{new Intl.DateTimeFormat(dateLocale(), { dateStyle: "long", timeStyle: "short" }).format(new Date(submitRegret.data.requested_at))}</p>
              </div>
              <button type="button" onClick={() => { submitRegret.reset(); setSubmitted(false); }} className="mt-5 rounded-xl border border-white/15 px-4 py-2.5 text-sm font-semibold text-white transition hover:bg-white/5">{t("regret.newRequest")}</button>
            </div>
          ) : (
            <form onSubmit={handleSubmit} noValidate className="mt-8 space-y-5">
              <div>
                <label htmlFor="regret-order-id" className="mb-2 block text-sm font-medium text-slate-200">{t("regret.orderId")}</label>
                <input id="regret-order-id" name="order_id" type="number" inputMode="numeric" min="1" step="1" required value={orderId} onChange={(event) => setOrderId(event.target.value)} aria-invalid={submitted && !validOrderId} aria-describedby="regret-order-help" className="ajr-input w-full rounded-xl border border-white/10 bg-black/20 px-4 py-3 text-white outline-none transition placeholder:text-slate-500 focus:border-cyan-300/60 focus:ring-2 focus:ring-cyan-300/10" placeholder="Ej. 1042" />
                <p id="regret-order-help" className="mt-2 text-xs text-slate-500">{t("regret.orderHelp")}</p>
                {submitted && !validOrderId && <p className="mt-1 text-xs text-rose-300" role="alert">{t("regret.invalidOrder")}</p>}
              </div>
              <div>
                <label htmlFor="regret-email" className="mb-2 block text-sm font-medium text-slate-200">{t("regret.email")}</label>
                <input id="regret-email" name="contact_email" type="email" autoComplete="email" maxLength={320} required value={email} onChange={(event) => setEmail(event.target.value)} aria-invalid={submitted && !validEmail} className="ajr-input w-full rounded-xl border border-white/10 bg-black/20 px-4 py-3 text-white outline-none transition placeholder:text-slate-500 focus:border-cyan-300/60 focus:ring-2 focus:ring-cyan-300/10" placeholder="nombre@empresa.com" />
                {submitted && !validEmail && <p className="mt-1 text-xs text-rose-300" role="alert">{t("regret.invalidEmail")}</p>}
              </div>
              {submitRegret.isError && <div role="alert" className="flex gap-2 rounded-xl border border-rose-300/20 bg-rose-300/[0.06] p-3 text-sm text-rose-100"><CircleAlert className="mt-0.5 h-4 w-4 shrink-0" aria-hidden="true" />{getRegretError(submitRegret.error)}</div>}
              <button type="submit" disabled={!canSubmit} className="ajr-gradient-button flex min-h-12 w-full items-center justify-center gap-2 rounded-xl px-5 py-3 text-sm font-bold text-white transition hover:brightness-110 disabled:cursor-not-allowed disabled:opacity-50">
                {submitRegret.isPending ? t("regret.sending") : t("regret.submit")}
                {!submitRegret.isPending && <ArrowLeft className="h-4 w-4 rotate-180" aria-hidden="true" />}
              </button>
              <p className="text-xs leading-6 text-slate-400">{t("regret.noAccount")}</p>
            </form>
          )}
        </section>

        <aside className="space-y-4">
          <div className="rounded-[1.4rem] border border-white/10 bg-[#0c1422]/85 p-5">
            <div className="mb-3 flex items-center gap-2 text-cyan-200"><ShieldCheck className="h-5 w-5" aria-hidden="true" /><h2 className="text-sm font-semibold">{t("regret.privacyTitle")}</h2></div>
            <p className="text-sm leading-6 text-slate-300">{t("regret.privacyText")}</p>
          </div>
          <div className="rounded-[1.4rem] border border-white/10 bg-[#0c1422]/85 p-5">
            <h2 className="text-sm font-semibold text-white">{t("regret.legalTitle")}</h2>
            <p className="mt-2 text-sm leading-6 text-slate-300">{t("regret.legalText")}</p>
            <Link to="/terms" className="mt-3 inline-flex text-xs font-semibold text-cyan-200 underline underline-offset-4">{t("regret.readTerms")}</Link>
          </div>
        </aside>
      </div>
    </div>
  );
}
