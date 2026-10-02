import { useState } from "react";
import { MAX_MESSAGE_LENGTH, useCreateSupportTicket } from "@/api/support";
import { getServerDetail } from "@/lib/errors";

const MIN_TITLE = 3;
const MAX_TITLE = 120;

/** Para iniciar un chat hace falta un título (y el primer mensaje). */
export default function NewChatForm({
  onCreated,
  onCancel,
}: {
  onCreated: (ticketId: number) => void;
  onCancel?: () => void;
}) {
  const create = useCreateSupportTicket();
  const [title, setTitle] = useState("");
  const [message, setMessage] = useState("");
  const [touched, setTouched] = useState(false);

  const titleOk = title.trim().length >= MIN_TITLE;
  const messageOk = message.trim().length > 0;

  function submit(e: React.FormEvent) {
    e.preventDefault();
    setTouched(true);
    if (!titleOk || !messageOk || create.isPending) return;
    create.mutate({ title: title.trim(), message: message.trim() }, { onSuccess: (t) => onCreated(t.id) });
  }

  const field = "mt-1 w-full rounded-md border bg-surface px-3 py-2 text-sm text-fg focus:border-brand focus:outline-none focus:ring-1 focus:ring-brand";

  return (
    <form onSubmit={submit} noValidate className="flex h-full flex-col gap-4 overflow-y-auto p-4">
      <div>
        <label htmlFor="chat-title" className="block text-sm font-medium text-fg-muted">
          Título del chat <span className="text-red-500 dark:text-red-400">*</span>
        </label>
        <input
          id="chat-title"
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          maxLength={MAX_TITLE}
          placeholder="Ej.: Consulta sobre mi pedido"
          aria-invalid={touched && !titleOk}
          className={field}
        />
        {touched && !titleOk && (
          <p role="alert" className="mt-1 text-xs text-red-600 dark:text-red-400">
            Poné un título de al menos {MIN_TITLE} caracteres.
          </p>
        )}
      </div>

      <div>
        <label htmlFor="chat-message" className="block text-sm font-medium text-fg-muted">
          Mensaje <span className="text-red-500 dark:text-red-400">*</span>
        </label>
        <textarea
          id="chat-message"
          value={message}
          onChange={(e) => setMessage(e.target.value)}
          maxLength={MAX_MESSAGE_LENGTH}
          rows={6}
          placeholder="Contanos en qué podemos ayudarte…"
          aria-invalid={touched && !messageOk}
          className={field}
        />
        <p className="mt-1 text-right text-xs text-fg-subtle" aria-live="polite">
          {message.length}/{MAX_MESSAGE_LENGTH}
        </p>
        {touched && !messageOk && (
          <p role="alert" className="text-xs text-red-600 dark:text-red-400">Escribí tu mensaje.</p>
        )}
      </div>

      {create.isError && (
        <p role="alert" className="text-sm text-red-600 dark:text-red-400">
          {getServerDetail(create.error) ?? "No pudimos iniciar el chat. Probá de nuevo."}
        </p>
      )}

      <div className="mt-auto flex gap-2">
        {onCancel && (
          <button type="button" onClick={onCancel} className="rounded-md border px-4 py-2 text-sm font-medium text-fg-muted hover:bg-surface-2">
            Cancelar
          </button>
        )}
        <button
          type="submit"
          disabled={create.isPending}
          className="flex-1 rounded-md bg-brand px-4 py-2 text-sm font-medium text-white hover:bg-brand-dark disabled:opacity-50"
        >
          {create.isPending ? "Iniciando…" : "Iniciar chat"}
        </button>
      </div>
    </form>
  );
}
