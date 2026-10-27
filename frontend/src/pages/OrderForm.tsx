import ProjectRequestForm from "@/components/forms/ProjectRequestForm";

/**
 * /solicitar-proyecto. La ruta está envuelta en <ProtectedRoute> (ver App.tsx): sin sesión se redirige
 * a /login guardando la URL (con `?plan=`) para volver acá después de entrar.
 */
export default function OrderForm() {
  return <ProjectRequestForm />;
}
