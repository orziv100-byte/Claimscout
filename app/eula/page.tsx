import { LegalDocument } from "@/components/legal-document";
import { EULA_SECTIONS, EULA_TITLE, EULA_VERSION } from "@/lib/legal";

export const metadata = { title: "EULA" };

export default function EulaPage() {
  return <LegalDocument title={EULA_TITLE} version={EULA_VERSION} sections={EULA_SECTIONS} />;
}
