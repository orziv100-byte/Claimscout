import { LegalDocument } from "@/components/legal-document";
import { DISCLAIMER_SECTIONS, DISCLAIMER_TITLE, DISCLAIMER_VERSION } from "@/lib/legal";

export const metadata = { title: "Disclaimer" };

export default function DisclaimerPage() {
  return <LegalDocument title={DISCLAIMER_TITLE} version={DISCLAIMER_VERSION} sections={DISCLAIMER_SECTIONS} />;
}
