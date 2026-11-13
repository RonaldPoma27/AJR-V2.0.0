import { useRef, useState, type FormEvent } from "react";
import { isAxiosError } from "axios";
import { Link } from "react-router-dom";
import { CheckCircle2, Undo2 } from "lucide-react";
import { useTranslation } from "react-i18next";
import { useRegretPublic, type RegretReceipt } from "@/api/orders";
import Turnstile, { turnstileEnabled, type TurnstileHandle } from "@/components/Turnstile";
import { Honeypot, TextAreaField, TextField } from "@/components/forms/Fields";
import { BentoCard, BentoGrid } from "@/components/ui/Bento";

/**
 * /arrepentimiento — Botón de arrepentimiento SIN cuenta (Res. 424/2020).
 * Identifica el pedido con número + email de contacto. El backend responde 404 genérico si no
 * coinciden (no revela qué pedidos existen) y 409 si venció el plazo de 10 días corridos.
 */
export default function Arrepentimiento() {
  const { t } = useTranslation();
  const regret = useRegretPublic();
  const turnstileRef = useRef<TurnstileHandle>(null);
  const [orderId, setOrderId] = useState("");
  const [email, setEmail] = useState("");
  const [reason, setReason] = useState("");
  const [honeypot, setHoneypot] = useState("");
  const [token, setToken] = useState<string | null>(null); // <- Corregido aquí para aceptar null
  const [errors, setErrors] = useState<{ order?: string; email?: string }>({});
  const [receipt, setReceipt] = useState<RegretReceipt | null>(null);
  const [serverError, setServerError] = useState<string | null>(null);

  const submit = (event: FormEvent) => {
    event.preventDefault();
    setServerError(null);
    const id = Number(orderId.trim().replace(/^#/, ""));
    const next: typeof errors = {};
    if (!Number.isInteger(id) || id <= 0) next.order = t("orderRegret.invalidOrder");
    if (!/^\S+@\S+\.\S+$/.test(email.trim())) next.email = t("orderRegret.invalidEmail");
    setErrors(next);
    if (next.order || next.email) return;

    regret.mutate(
      { order_id: id, contact_email: email.trim(), reason: reason.trim() || undefined, turnstile_token: token || undefined, website: honeypot || undefined },
      {
        onSuccess: setReceipt,
        onError: (error) => {
          turnstileRef.current?.reset();
          const status = isAxiosError(error) ? error.response?.status : undefined;
          setServerError(status === 404 ? t("orderRegret.notFound") : status === 409 ? t("orderRegret.expired") : t("orderRegret.generic"));
        },
      }
    );
  };

  return (
    <div className="mx-auto max-w-4xl px-5 py-10 sm:px-6 lg:px-8 lg:py-14">
      <BentoGrid>
        <BentoCard cols={6} accent="cyan" scrollReveal={false}>
          <span className="inline-flex h-11 w-11 items-center justify-center rounded-xl bg-rose-500/20 text-rose-200" aria-hidden><Undo2 className="h-5 w-5" /></span>
          <h1 className="mt-4 text-3xl font-extrabold">{t("orderRegret.title")}</h1>
          <p className="mt-3 max-w-2xl text-fg-muted">{t("orderRegret.intro")}</p>
          <p className="mt-2 text-sm text-fg-subtle">{t("orderRegret.legalNote")}</p>
        </BentoCard>

        <BentoCard cols={6} accent="violet" scrollReveal={false}>
          {receipt ? (
            <div role="status" className="space-y-3">
              <h2 className="flex items-center gap-2 text-xl font-bold text-fg"><CheckCircle2 className="h-6 w-6 text-emerald-400" aria-hidden />{t("orderRegret.doneTitle")}</h2>
              <p className="text-fg-muted">{receipt.already_requested ? t("orderRegret.already") : t("orderRegret.doneText", { id: receipt.order_id })}</p>
              <p className="rounded-lg border border-white/10 bg-black/30 p-4 text-center">
                <span className="block text-xs uppercase tracking-widest text-fg-subtle">{t("orderRegret.code")}</span>
                <span className="mt-1 block select-all font-mono text-2xl font-bold text-accent">{receipt.code}</span>
                <span className="mt-1 block text-xs text-fg-subtle">{t("orderRegret.keepCode")}</span>
              </p>
              <Link to="/" className="inline-block text-sm text-accent hover:underline">{t("legalPages.back")}</Link>
            </div>
          ) : (
            <form onSubmit={submit} noValidate className="mx-auto max-w-lg space-y-4">
              <TextField label={t("orderRegret.orderId")} name="order_id" value={orderId} onChange={(e) => setOrderId(e.target.value)} required maxLength={12} error={errors.order} hint={t("orderRegret.orderIdHint")} />
              <TextField label={t("orderRegret.email")} name="contact_email" type="email" value={email} onChange={(e) => setEmail(e.target.value)} required maxLength={320} autoComplete="email" error={errors.email} />
              <TextAreaField label={t("orderRegret.reason")} name="reason" value={reason} onChange={(e) => setReason(e.target.value)} maxLength={1000} />
              <Honeypot value={honeypot} onChange={(e) => setHoneypot(e.target.value)} />
              <Turnstile ref={turnstileRef} onToken={setToken} />
              <button type="submit" disabled={regret.isPending || (turnstileEnabled && !token)} className="w-full rounded-md bg-rose-600 px-6 py-3 font-semibold text-white hover:bg-rose-500 disabled:opacity-50">
                {regret.isPending ? t("orderRegret.sending") : t("orderRegret.submit")}
              </button>
              {serverError && <p role="alert" className="text-sm text-red-400">{serverError}</p>}
            </form>
          )}
        </BentoCard>
      </BentoGrid>
    </div>
  );
}
