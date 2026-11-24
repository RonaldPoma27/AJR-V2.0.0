import { useState } from "react";
import { Link } from "react-router-dom";
import { useTranslation } from "react-i18next";
import { Undo2 } from "lucide-react";
import { useMyOrders, useRegretFromAccount, type ClientOrder } from "@/api/orders";
import ProjectStepper from "@/components/ui/ProjectStepper";
import { formatDateTime } from "@/lib/format";
import { canRegret, regretDeadline } from "@/lib/regret";
import { toast } from "@/lib/toast";
import { ORDER_STATUS_LABELS, STATUS_BADGE } from "@/lib/status";
import { timeAgo, useNow } from "@/lib/time";
import { cn } from "@/lib/utils";

/**
 * Botón de arrepentimiento de acción directa (Res. 424/2020). Se habilita SOLO si el pedido tiene
 * menos de 10 días corridos; confirma en el mismo lugar (sin cambiar de pantalla) y el backend
 * detiene el tablero Scrumban, audita y envía la constancia por email.
 */
function RegretAction({ order, now }: { order: ClientOrder; now: number }) {
  const { t } = useTranslation();
  const regret = useRegretFromAccount();
  const [confirming, setConfirming] = useState(false);
  const enabled = canRegret(order.created_at, now, order.regret_requested_at);

  if (order.regret_requested_at) {
    return (
      <p role="status" className="mt-4 rounded-md border border-rose-400/30 bg-rose-500/10 p-3 text-sm text-fg-muted">
        {t("orderRegret.requestedAt", { date: formatDateTime(order.regret_requested_at), code: order.regret_code ?? "—" })}
      </p>
    );
  }

  const confirm = () =>
    regret.mutate(order.id, {
      onSuccess: (receipt) => {
        setConfirming(false);
        toast.success(t("orderRegret.done", { code: receipt.code }));
      },
      onError: () => toast.error(t("orderRegret.generic")),
    });

  return (
    <div className="mt-4 border-t border-white/10 pt-4">
      {!confirming ? (
        <button
          type="button"
          disabled={!enabled}
          onClick={() => setConfirming(true)}
          aria-describedby={`regret-hint-${order.id}`}
          className="inline-flex items-center gap-2 rounded-md border border-rose-400/60 bg-rose-500/15 px-3 py-2 text-sm font-semibold text-rose-100 transition hover:bg-rose-500/30 disabled:cursor-not-allowed disabled:opacity-45"
        >
          <Undo2 className="h-4 w-4" aria-hidden />
          {t("orderRegret.button")}
        </button>
      ) : (
        <div role="group" aria-label={t("orderRegret.confirmTitle", { id: order.id })} className="rounded-md border border-rose-400/40 bg-rose-500/10 p-3">
          <p className="font-medium text-fg">{t("orderRegret.confirmTitle", { id: order.id })}</p>
          <p className="mt-1 text-sm text-fg-muted">{t("orderRegret.confirmText")}</p>
          <div className="mt-3 flex gap-2">
            <button type="button" onClick={confirm} disabled={regret.isPending} className="rounded-md bg-rose-600 px-3 py-1.5 text-sm font-semibold text-white hover:bg-rose-500 disabled:opacity-60">
              {regret.isPending ? t("orderRegret.sending") : t("orderRegret.confirmYes")}
            </button>
            <button type="button" onClick={() => setConfirming(false)} disabled={regret.isPending} className="rounded-md border px-3 py-1.5 text-sm text-fg-muted hover:bg-white/5">
              {t("orderRegret.confirmNo")}
            </button>
          </div>
        </div>
      )}
      <p id={`regret-hint-${order.id}`} className="mt-2 text-xs text-fg-subtle">
        {enabled
          ? t("orderRegret.deadline", { date: formatDateTime(regretDeadline(order.created_at).toISOString()) })
          : t("orderRegret.expiredShort")}
      </p>
    </div>
  );
}

function OrderCard({ order, now }: { order: ClientOrder; now: number }) {
  const { t } = useTranslation();
  const [open, setOpen] = useState(false);
  return (
    <li className="rounded-lg border bg-surface p-5">
      <div className="flex flex-wrap items-start justify-between gap-2">
        <div className="min-w-0">
          <h2 className="font-semibold text-fg">{order.company_name}</h2>
          <p className="text-sm text-fg-subtle">
            {t("myOrders.meta", { id: order.id, industry: order.industry, date: formatDateTime(order.created_at) })}
          </p>
        </div>
        <span className={cn("rounded-full px-2.5 py-0.5 text-xs font-medium", STATUS_BADGE[order.status])}>
          {ORDER_STATUS_LABELS[order.status]}
        </span>
      </div>

      <div className="my-6 rounded-lg bg-surface-2/70 p-4">
        <p className="mb-4 text-xs font-semibold uppercase tracking-wide text-fg-subtle">{t("myOrders.projectProgress")}</p>
        {order.status === "descartado" ? (
          <p role="status" className="text-sm text-fg-muted">{t("myOrders.discardedProgress")}</p>
        ) : (
          <ProjectStepper currentStep={order.status === "finalizado" ? 5 : order.status === "contactado" ? 2 : 1} />
        )}
        <p className="mt-3 text-xs leading-relaxed text-fg-subtle">{t("myOrders.progressNote")}</p>
      </div>

      <p className="text-xs text-fg-subtle">{t("myOrders.lastUpdate", { time: timeAgo(order.updated_at, now) })}</p>
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        aria-expanded={open}
        className="mt-2 text-sm font-medium text-accent hover:underline"
      >
        {open ? t("myOrders.hideDetail") : t("myOrders.showDetail")}
      </button>
      {open && (
        <div className="mt-3 rounded-md bg-surface-2 p-4 text-sm text-fg-muted">
          <p className="font-medium text-fg">{t("myOrders.problem")}</p>
          <p className="mt-1 whitespace-pre-wrap">{order.problem_description}</p>
          <p className="mt-3 text-fg-subtle">{t("myOrders.contact", { name: order.contact_name, email: order.contact_email })}{order.contact_phone ? t("myOrders.contactPhone", { phone: order.contact_phone }) : ""}</p>
          <RegretAction order={order} now={now} />
        </div>
      )}
    </li>
  );
}

export default function MisPedidos() {
  const { t } = useTranslation();
  const { data, isLoading, isError, refetch } = useMyOrders();
  const now = useNow();

  return (
    <div className="mx-auto max-w-3xl space-y-5 p-4 md:p-8">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold text-fg">{t("myOrders.title")}</h1>
          <p className="text-sm text-fg-subtle">{t("myOrders.subtitle")}</p>
        </div>
        <Link to="/solicitar-proyecto" className="rounded-md bg-brand px-4 py-2 text-sm font-medium text-white hover:bg-brand-dark">
          {t("myOrders.newOrder")}
        </Link>
      </div>

      {isLoading && <p className="text-fg-subtle">{t("myOrders.loading")}</p>}
      {isError && (
        <p role="alert" className="text-red-600 dark:text-red-400">
          {t("myOrders.loadError")} <button onClick={() => refetch()} className="font-medium underline">{t("myOrders.retry")}</button>
        </p>
      )}
      {data && data.length === 0 && (
        <div className="rounded-lg border border-dashed p-10 text-center">
          <p className="font-medium text-fg">{t("myOrders.emptyTitle")}</p>
          <p className="mt-1 text-sm text-fg-subtle">{t("myOrders.emptyText")}</p>
          <Link to="/solicitar-proyecto" className="mt-4 inline-block rounded-md bg-brand px-4 py-2 text-sm font-medium text-white hover:bg-brand-dark">
            {t("myOrders.requestProject")}
          </Link>
        </div>
      )}
      <ul className="space-y-4">{data?.map((o) => <OrderCard key={o.id} order={o} now={now} />)}</ul>
    </div>
  );
}
