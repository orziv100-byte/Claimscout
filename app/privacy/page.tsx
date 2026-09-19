import { LegalDocument } from "@/components/legal-document";
import { PRIVACY_SECTIONS, PRIVACY_TITLE, PRIVACY_VERSION } from "@/lib/legal";

export const metadata = { title: "Privacy Policy" };

export default function PrivacyPage() {
  return <LegalDocument title={PRIVACY_TITLE} version={PRIVACY_VERSION} sections={PRIVACY_SECTIONS} />;
}
