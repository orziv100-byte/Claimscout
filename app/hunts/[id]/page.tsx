import { HuntDetail } from "@/components/hunt-detail";

export const metadata = {
  title: "Hunt",
};

export default async function HuntPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  return <HuntDetail huntId={id} />;
}
