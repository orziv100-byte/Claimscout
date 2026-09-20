import { LegalDocument } from "@/components/legal-document";
import { ACCESSIBILITY_SECTIONS, ACCESSIBILITY_TITLE, ACCESSIBILITY_VERSION } from "@/lib/legal";

export const metadata = { title: "Accessibility" };

export default function AccessibilityPage() {
  return (
    <LegalDocument title={ACCESSIBILITY_TITLE} version={ACCESSIBILITY_VERSION} sections={ACCESSIBILITY_SECTIONS} />
  );
}
