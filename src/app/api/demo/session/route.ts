import { NextResponse } from "next/server";
import { demoCookie, hostedDemoOrigin, inviteAccounts } from "../../../../lib/hosted-demo";

export async function POST(request: Request) {
  if (!hostedDemoOrigin(request)) return new Response("Forbidden", { status: 403 });

  const form = await request.formData();
  const code = form.get("code");
  if (typeof code !== "string" || !inviteAccounts(code.trim())) {
    return new NextResponse(null, { status: 303, headers: { location: "/demo?invite=invalid#live-demo" } });
  }

  const response = new NextResponse(null, { status: 303, headers: { location: "/demo" } });
  response.cookies.set(demoCookie, code.trim(), {
    httpOnly: true, secure: true, sameSite: "strict", path: "/", maxAge: 7 * 24 * 60 * 60,
  });
  return response;
}
