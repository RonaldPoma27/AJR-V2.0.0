import ProjectRequestForm from "@/components/forms/ProjectRequestForm";

/**
 * /solicitar-proyecto. La ruta está envuelta en <ProtectedRoute> (ver App.tsx): sin sesión se
 * redirige a /login y se vuelve acá con `?plan=` intacto. El formulario por pasos vive en
 * components/forms/ProjectRequestForm.tsx.
 */
export default function OrderForm() {
  return <ProjectRequestForm />;
}
