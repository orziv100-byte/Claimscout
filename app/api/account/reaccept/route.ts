import { NextResponse } from "next/server";
import { APP_VERSION } from "@/lib/app-info";
import { acceptCurrentLegal } from "@/lib/deletion";
import { PRIVACY_VERSION, TERMS_VERSION } from "@/lib/legal";
import { guardFailed, isResponse, requireUser } from "@/lib/request-guard";

export const runtime = "nodejs";

export async function POST(request: Request) {
  const authed = requireUser(request, { allowUnverified: true });
  if (isResponse(authed)) return authed;
  const body = (await request.json().catch(() => ({}))) as { acceptTerms?: boolean; acceptPrivacy?: boolean };
  if (!body.acceptTerms || !body.acceptPrivacy) {
    return NextResponse.json(
      { error: "Accept the current Terms and Privacy Notice to continue.", code: "TERMS_REQUIRED", version: APP_VERSION },
      { status: 400 },
    );
  }
  try {
    const accepted = acceptCurrentLegal(authed.user.id);
    return NextResponse.json({
      ok: true,
      version: APP_VERSION,
      current: { termsVersion: TERMS_VERSION, privacyVersion: PRIVACY_VERSION },
      accepted,
    });
  } catch (err) {
    return guardFailed(err);
  }
}
