import document from "../../../../docs/legal/TERMS.md?raw";
import LegalDocumentPage from "./LegalDocumentPage";
export default function Terms() {
  return <LegalDocumentPage title="Términos de Uso" eyebrow="Condiciones de utilización" updatedAt="Borrador revisado el 12 de noviembre de 2026" document={document} />;
}
