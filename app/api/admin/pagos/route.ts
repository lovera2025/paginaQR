import { NextResponse } from "next/server";
import { requireAuth } from "@/lib/auth/cookies";
import { getAppUrl } from "@/lib/config";
import { getMpCredentialsForAdmin, getMpWebhookUrl, saveMpCredentials } from "@/lib/mercadopago/credentials";
import {
  getTaloCredentialsForAdmin,
  saveTaloCredentials,
  type TaloEnvironment,
} from "@/lib/talo/credentials";
import { getTaloWebhookUrl } from "@/lib/talo/client";
import { getModoPagos } from "@/lib/payments/modo";

export async function GET() {
  if (!(await requireAuth("admin"))) {
    return NextResponse.json({ error: "No autorizado" }, { status: 401 });
  }

  const [talo, mp, modo] = await Promise.all([
    getTaloCredentialsForAdmin(),
    getMpCredentialsForAdmin(),
    getModoPagos(),
  ]);

  return NextResponse.json({
    talo: {
      ...talo,
      webhookUrl: getTaloWebhookUrl(),
    },
    mp: {
      ...mp,
      webhookUrl: getMpWebhookUrl(),
    },
    methods: modo.methods,
    modo: { simulate: modo.simulate, sandbox: modo.sandbox, sinMedios: modo.sinMedios, appMode: modo.appMode },
    appUrl: getAppUrl(),
  });
}

export async function POST(request: Request) {
  if (!(await requireAuth("admin"))) {
    return NextResponse.json({ error: "No autorizado" }, { status: 401 });
  }

  const body = await request.json();
  const provider = body.provider === "mp" ? "mp" : "talo";

  if (provider === "mp") {
    const environment =
      body.environment === "auto" ? "auto" : body.environment === "sandbox" ? "sandbox" : "production";

    const result = await saveMpCredentials({
      accessToken: body.accessToken ? String(body.accessToken) : undefined,
      environment,
      enabled: body.enabled !== false,
    });

    if ("error" in result) {
      return NextResponse.json({ error: result.error }, { status: 400 });
    }

    return NextResponse.json({ ok: true, environment: result.environment });
  }

  const environment: TaloEnvironment =
    body.environment === "sandbox" ? "sandbox" : "production";

  const result = await saveTaloCredentials({
    userId: String(body.userId ?? ""),
    clientId: String(body.clientId ?? ""),
    clientSecret: body.clientSecret ? String(body.clientSecret) : undefined,
    environment,
    enabled: body.enabled !== false,
  });

  if ("error" in result) {
    return NextResponse.json({ error: result.error }, { status: 400 });
  }

  return NextResponse.json({ ok: true });
}
