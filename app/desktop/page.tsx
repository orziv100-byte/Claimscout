import { redirect } from "next/navigation";

export const metadata = {
  title: "Windows client",
};

export default function DesktopPage() {
  redirect("/download");
}
