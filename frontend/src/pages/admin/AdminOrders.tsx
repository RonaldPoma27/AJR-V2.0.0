import { useEffect, useState } from "react";
import { useTranslation } from "react-i18next";
import { Trash2 } from "lucide-react";
import { useMe } from "@/api/auth";
import { useOrders, useTrashOrder, useUpdateOrderStatus, type ClientOrder, type OrderStatus } from "@/api/orders";
import { PAGE_SIZE } from "@/api/types";
import DetailRow from "@/components/admin/DetailRow";
import ConfirmButton from "@/components/ui/ConfirmButton";
import Pager from "@/components/admin/Pager";
import StatusChips from "@/components/admin/StatusChips";
import StatusSelect from "@/components/admin/StatusSelect";
import { getServerDetail } from "@/lib/errors";
import { formatDateTime } from "@/lib/format";
import { ORDER_STATUS_LABELS, STATUS_BADGE } from "@/lib/status";
import { timeAgo, useNow } from "@/lib/time";
import { cn } from "@/lib/utils";

export default function AdminOrders() {
  const { t } = useTranslation();
  const [status, setStatus] = useState<OrderStatus | null>(null);
  const [page, setPage] = useState(0);
  const [expanded, setExpanded] = useState<number | null>(null);
  const { data, isLoading, isError, isFetching, refetch } = useOrders({ page, status });
  const update = useUpdateOrderStatus();
  const trash = useTrashOrder();
  const { data: me } = useMe();
  const isAdmin = me?.role === "ADMIN"; // solo ADMIN envía a la papelera
  const now = useNow();

  // Si al cambiar un estado la página actual queda vacía, volvemos a la anterior.
  useEffect(() => {
    if (data && data.page === page && data.items.length === 0 && page > 0) setPage(page - 1);
  }, [data, page]);

  function selectStatus(next: string | null) {
    setStatus(next as OrderStatus | null);
    setPage(0);
    setExpanded(null);
  }

  return (
    <div className="mx-auto max-w-4xl space-y-5">
      <div>
        <h1 className="text-2xl font-bold text-fg">{t("adminOrders.title")}</h1>
        <p className="text-sm text-fg-subtle">{t("adminOrders.subtitle")}</p>
      </div>

      {data && (
        <StatusChips counts={data.counts} labels={ORDER_STATUS_LABELS} active={status} onSelect={selectStatus} />
      )}

      {isLoading && <p className="text-fg-subtle">{t("adminOrders.loading")}</p>}
      {isError && (
        <p role="alert" className="text-red-600 dark:text-red-400">
          {t("adminOrders.loadError")}{" "}
          <button onClick={() => refetch()} className="font-medium underline">{t("adminCommon.retry")}</button>
        </p>
      )}
      {update.isError && (
        <p role="alert" className="text-sm text-red-600 dark:text-red-400">
          {getServerDetail(update.error) ?? t("adminCommon.statusChangeError")}
        </p>
      )}
      {trash.isError && (
        <p role="alert" className="text-sm text-red-600 dark:text-red-400">
          {getServerDetail(trash.error) ?? t("adminOrders.trashError")}
        </p>
      )}
      {data && data.total === 0 && (
        <p className="rounded-md border bg-surface p-6 text-center text-fg-subtle">
          {status ? t("adminOrders.emptyFiltered") : t("adminOrders.empty")}
        </p>
      )}

      <ul className={cn("space-y-3", isFetching && "opacity-70")}>
        {data?.items.map((order) => (
          <OrderCard
            key={order.id}
            order={order}
            open={expanded === order.id}
            onToggle={() => setExpanded(expanded === order.id ? null : order.id)}
            onStatus={(next) => update.mutate({ id: order.id, status: next })}
            saving={update.isPending && update.variables?.id === order.id}
            now={now}
            onTrash={isAdmin ? () => trash.mutate(order.id) : undefined}
            trashing={trash.isPending && trash.variables === order.id}
          />
        ))}
      </ul>

      {data && (
        <Pager page={data.page} pageSize={PAGE_SIZE} total={data.total} onPage={(p) => { setPage(p); setExpanded(null); }} disabled={isFetching} />
      )}
    </div>
  );
}

function OrderCard({
  order,
  open,
  onToggle,
  onStatus,
  saving,
  now,
  onTrash,
  trashing,
}: {
  order: ClientOrder;
  open: boolean;
  onToggle: () => void;
  onStatus: (status: OrderStatus) => void;
  saving: boolean;
  now: number;
  /** Solo se pasa para ADMIN. */
  onTrash?: () => void;
  trashing: boolean;
}) {
  const { t } = useTranslation();
  return (
    <li className="overflow-hidden rounded-lg border bg-surface">
      <div className="flex flex-wrap items-start justify-between gap-3 p-4">
        <button
          type="button"
          onClick={onToggle}
          aria-expanded={open}
          className="min-w-0 flex-1 text-left"
        >
          <p className="font-semibold text-fg">{order.company_name}</p>
          <p className="text-sm text-fg-subtle">
            {order.contact_name} · {order.industry} · {t("adminOrders.received", { time: timeAgo(order.created_at, now) })}
          </p>
          {!open && <p className="mt-1 line-clamp-2 text-sm text-fg-muted">{order.problem_description}</p>}
          <span className="mt-1 inline-block text-xs font-medium text-accent">{open ? t("adminCommon.seeLess") : t("adminCommon.seeAll")}</span>
        </button>
        <div className="flex items-center gap-2">
          <span className={cn("rounded-full px-2 py-0.5 text-xs font-medium", STATUS_BADGE[order.status])}>
            {ORDER_STATUS_LABELS[order.status]}
          </span>
          <StatusSelect
            value={order.status}
            labels={ORDER_STATUS_LABELS}
            onChange={onStatus}
            disabled={saving}
            label={t("adminOrders.changeStatusLabel", { name: order.company_name })}
          />
        </div>
      </div>

      {open && (
        <dl className="space-y-3 border-t bg-surface-2 p-4">
          <DetailRow label={t("adminOrders.company")}>{order.company_name}</DetailRow>
          <DetailRow label={t("adminOrders.contact")}>{order.contact_name}</DetailRow>
          <DetailRow label={t("adminCommon.email")}>
            <a href={`mailto:${order.contact_email}`} className="text-accent hover:underline">
              {order.contact_email}
            </a>
          </DetailRow>
          <DetailRow label={t("adminOrders.phone")}>
            {order.contact_phone && (
              <a href={`tel:${order.contact_phone.replace(/[^\d+]/g, "")}`} className="text-accent hover:underline">
                {order.contact_phone}
              </a>
            )}
          </DetailRow>
          <DetailRow label={t("adminOrders.industry")}>{order.industry}</DetailRow>
          <DetailRow label={t("adminOrders.problem")}>
            <span className="whitespace-pre-wrap">{order.problem_description}</span>
          </DetailRow>
          <DetailRow label={t("adminOrders.clientAccount")}>
            {order.user_id ? t("adminOrders.registeredUser", { id: order.user_id }) : t("adminOrders.noAccount")}
          </DetailRow>
          <DetailRow label={t("adminOrders.receivedLabel")}>{formatDateTime(order.created_at)} ({timeAgo(order.created_at, now)})</DetailRow>
          <DetailRow label={t("adminCommon.lastUpdate")}>{formatDateTime(order.updated_at)} ({timeAgo(order.updated_at, now)})</DetailRow>
          {onTrash && (
            <div className="pt-2">
              <ConfirmButton
                label={t("adminCommon.sendToTrash")}
                question={t("adminCommon.trashQuestion")}
                confirmLabel={t("adminCommon.trashConfirm")}
                onConfirm={onTrash}
                disabled={trashing}
                icon={<Trash2 className="h-4 w-4" aria-hidden />}
              />
            </div>
          )}
        </dl>
      )}
    </li>
  );
}
