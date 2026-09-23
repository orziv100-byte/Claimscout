import { NextResponse } from "next/server";
import { APP_VERSION, BRAND_NAME } from "@/lib/app-info";
import { macosInstaller, windowsInstaller } from "@/lib/windows-installer";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET() {
  const installer = windowsInstaller();
  const mac = macosInstaller();
  return NextResponse.json(
    {
      name: BRAND_NAME,
      version: APP_VERSION,
      signed: false,
      platform: "win32",
      arch: "x64",
      installer: installer.published ? installer.href : null,
      filename: installer.filename,
      feed: "/downloads/latest.yml",
      windows: {
        published: installer.published,
        installer: installer.published ? installer.href : null,
        filename: installer.filename,
        signed: false,
      },
      macos: {
        published: mac.published,
        installer: mac.published ? mac.href : null,
        filename: mac.filename,
        signed: false,
        feed: "/downloads/latest-mac.yml",
      },
    },
    { headers: { "Cache-Control": "no-store" } },
  );
}
