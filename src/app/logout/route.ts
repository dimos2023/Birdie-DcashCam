import { NextResponse, type NextRequest } from "next/server";

export async function GET(request: NextRequest) {
  const loginUrl = request.nextUrl.clone();
  loginUrl.pathname = "/login";
  loginUrl.search = "";
  return NextResponse.redirect(loginUrl);
}

export async function POST(request: NextRequest) {
  return GET(request);
}
