import { NextResponse } from "next/server";
import { requireAuth } from "@/lib/auth/cookies";
import { getAppUrl } from "@/lib/config";
import {
  getTaloCredentialsForAdmin,
  saveTaloCredentials,
  type TaloEnvironment,
} from "@/lib/talo/credentials";
import { getTaloWebhookUrl } from "@/lib/talo/client";

export async function GET() {
  if (!(await requireAuth("admin"))) {
    return NextResponse.json({ error: "No autorizado" }, { status: 401 });
  }

  const info = await getTaloCredentialsForAdmin();

  return NextResponse.json({
    ...info,
    webhookUrl: getTaloWebhookUrl(),
    appUrl: getAppUrl(),
  });
}

export async function POST(request: Request) {
  if (!(await requireAuth("admin"))) {
    return NextResponse.json({ error: "No autorizado" }, { status: 401 });
  }

  const body = await request.json();
  const environment: TaloEnvironment =
    body.environment === "sandbox" ? "sandbox" : "production";

  const result = await saveTaloCredentials({
    userId: String(body.userId ?? ""),
    clientId: String(body.clientId ?? ""),
    clientSecret: body.clientSecret ? String(body.clientSecret) : undefined,
    environment,
  });

  if ("error" in result) {
    return NextResponse.json({ error: result.error }, { status: 400 });
  }

  return NextResponse.json({ ok: true });
}
