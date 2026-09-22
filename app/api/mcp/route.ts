import { handleMcp, handleMcpOptions } from "@/lib/engine/mcp-http";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 30;

export async function OPTIONS(request: Request) {
  return handleMcpOptions(request);
}

export async function GET(request: Request) {
  return handleMcp(request, {});
}

export async function POST(request: Request) {
  const body = (await request.json().catch(() => ({}))) as Record<string, unknown>;
  return handleMcp(request, body);
}
