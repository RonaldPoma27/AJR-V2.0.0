import document from "../../../../docs/legal/EULA.md?raw";
import LegalDocumentPage from "./LegalDocumentPage";
export default function Eula() {
  return <LegalDocumentPage title="Acuerdo de Licencia de Usuario Final" eyebrow="Licencia del CMS AJR Data" updatedAt="Borrador revisado el 12 de noviembre de 2026" document={document} />;
}
