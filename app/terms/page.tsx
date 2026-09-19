import { LegalDocument } from "@/components/legal-document";
import { TERMS_SECTIONS, TERMS_TITLE, TERMS_VERSION } from "@/lib/legal";

export const metadata = { title: "Terms of Use" };

export default function TermsPage() {
  return <LegalDocument title={TERMS_TITLE} version={TERMS_VERSION} sections={TERMS_SECTIONS} />;
}
