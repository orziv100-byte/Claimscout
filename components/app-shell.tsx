import { cookies, headers } from "next/headers";
import { AppChrome, AppFooter } from "@/components/app-chrome";
import { PATHNAME_HEADER } from "@/lib/pathname-header";
import { DESKTOP_COOKIE, isDesktopClient } from "@/lib/site-surface";

async function requestContext(): Promise<{ pathname: string; desktop: boolean }> {
  const headerList = await headers();
  const cookieStore = await cookies();
  return {
    pathname: headerList.get(PATHNAME_HEADER) || "",
    desktop: isDesktopClient({
      userAgent: headerList.get("user-agent"),
      desktopCookie: cookieStore.get(DESKTOP_COOKIE)?.value,
    }),
  };
}

export async function AppShellHeader() {
  const { pathname, desktop } = await requestContext();
  return <AppChrome initialPath={pathname} desktop={desktop} />;
}

export async function AppShellFooter() {
  const { pathname, desktop } = await requestContext();
  return <AppFooter initialPath={pathname} desktop={desktop} />;
}
