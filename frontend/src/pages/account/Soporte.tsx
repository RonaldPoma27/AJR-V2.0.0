import { useState } from "react";
import { ArrowLeft } from "lucide-react";
import { useTranslation } from "react-i18next";
import ChatHistory from "@/components/support/ChatHistory";
import ChatThread from "@/components/support/ChatThread";
import NewChatForm from "@/components/support/NewChatForm";
import { cn } from "@/lib/utils";

type View = { name: "history" } | { name: "new" } | { name: "thread"; id: number };

/** Soporte a pantalla completa: historial de chats a la izquierda y la conversación a la derecha. */
export default function Soporte() {
  const { t } = useTranslation();
  const [view, setView] = useState<View>({ name: "history" });
  const listVisibleOnMobile = view.name === "history";

  return (
    <div className="mx-auto max-w-5xl p-4 md:p-8">
      <h1 className="text-2xl font-bold text-fg">{t("supportPage.title")}</h1>
      <p className="mb-4 text-sm text-fg-subtle">{t("supportPage.subtitle")}</p>

      <div className="grid h-[calc(100vh-15rem)] min-h-[28rem] overflow-hidden rounded-lg border bg-surface md:grid-cols-[18rem_1fr]">
        <div className={cn("min-h-0 border-r", !listVisibleOnMobile && "hidden md:block")}>
          <ChatHistory
            selectedId={view.name === "thread" ? view.id : null}
            onNew={() => setView({ name: "new" })}
            onSelect={(id) => setView({ name: "thread", id })}
          />
        </div>

        <div className={cn("min-h-0 flex-col", listVisibleOnMobile ? "hidden md:flex" : "flex")}>
          {view.name !== "history" && (
            <button
              type="button"
              onClick={() => setView({ name: "history" })}
              className="flex items-center gap-2 border-b px-4 py-2 text-sm font-medium text-accent hover:underline md:hidden"
            >
              <ArrowLeft className="h-4 w-4" aria-hidden /> {t("supportPage.history")}
            </button>
          )}
          {view.name === "history" && (
            <div className="flex flex-1 items-center justify-center p-6 text-center text-sm text-fg-subtle">
              {t("supportPage.pick")}
            </div>
          )}
          {view.name === "new" && <NewChatForm onCreated={(id) => setView({ name: "thread", id })} onCancel={() => setView({ name: "history" })} />}
          {view.name === "thread" && <ChatThread key={view.id} ticketId={view.id} perspective="customer" className="flex-1" />}
        </div>
      </div>
    </div>
  );
}
