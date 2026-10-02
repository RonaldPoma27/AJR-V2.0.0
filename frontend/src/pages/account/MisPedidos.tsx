import { useState } from "react";
import { Link } from "react-router-dom";
import { useMyOrders, type ClientOrder } from "@/api/orders";
import OrderStepper from "@/components/ui/OrderStepper";
import { formatDateTime } from "@/lib/format";
import { ORDER_STATUS_LABELS, STATUS_BADGE } from "@/lib/status";
import { timeAgo, useNow } from "@/lib/time";
import { cn } from "@/lib/utils";

function OrderCard({ order, now }: { order: ClientOrder; now: number }) {
  const [open, setOpen] = useState(false);
  return (
    <li className="rounded-lg border bg-surface p-5">
      <div className="flex flex-wrap items-start justify-between gap-2">
        <div className="min-w-0">
          <h2 className="font-semibold text-fg">{order.company_name}</h2>
          <p className="text-sm text-fg-subtle">
            Pedido #{order.id} · {order.industry} · enviado {formatDateTime(order.created_at)}
          </p>
        </div>
        <span className={cn("rounded-full px-2.5 py-0.5 text-xs font-medium", STATUS_BADGE[order.status])}>
          {ORDER_STATUS_LABELS[order.status]}
        </span>
      </div>

      <div className="my-6">
        <OrderStepper status={order.status} />
      </div>

      <p className="text-xs text-fg-subtle">Última actualización {timeAgo(order.updated_at, now)}</p>
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        aria-expanded={open}
        className="mt-2 text-sm font-medium text-accent hover:underline"
      >
        {open ? "Ocultar detalle" : "Ver detalle del pedido"}
      </button>
      {open && (
        <div className="mt-3 rounded-md bg-surface-2 p-4 text-sm text-fg-muted">
          <p className="font-medium text-fg">Problema a resolver</p>
          <p className="mt-1 whitespace-pre-wrap">{order.problem_description}</p>
          <p className="mt-3 text-fg-subtle">Contacto: {order.contact_name} · {order.contact_email}{order.contact_phone ? ` · ${order.contact_phone}` : ""}</p>
        </div>
      )}
    </li>
  );
}

export default function MisPedidos() {
  const { data, isLoading, isError, refetch } = useMyOrders();
  const now = useNow();

  return (
    <div className="mx-auto max-w-3xl space-y-5 p-4 md:p-8">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold text-fg">Mis pedidos</h1>
          <p className="text-sm text-fg-subtle">Seguí el avance de tus proyectos. Te avisamos por mail cuando cambie el estado.</p>
        </div>
        <Link to="/solicitar-proyecto" className="rounded-md bg-brand px-4 py-2 text-sm font-medium text-white hover:bg-brand-dark">
          Nuevo pedido
        </Link>
      </div>

      {isLoading && <p className="text-fg-subtle">Cargando tus pedidos…</p>}
      {isError && (
        <p role="alert" className="text-red-600 dark:text-red-400">
          No pudimos cargar tus pedidos. <button onClick={() => refetch()} className="font-medium underline">Reintentar</button>
        </p>
      )}
      {data && data.length === 0 && (
        <div className="rounded-lg border border-dashed p-10 text-center">
          <p className="font-medium text-fg">Todavía no hiciste ningún pedido</p>
          <p className="mt-1 text-sm text-fg-subtle">Contanos el problema de tu negocio y lo vemos juntos.</p>
          <Link to="/solicitar-proyecto" className="mt-4 inline-block rounded-md bg-brand px-4 py-2 text-sm font-medium text-white hover:bg-brand-dark">
            Solicitar un proyecto
          </Link>
        </div>
      )}
      <ul className="space-y-4">{data?.map((o) => <OrderCard key={o.id} order={o} now={now} />)}</ul>
    </div>
  );
}
