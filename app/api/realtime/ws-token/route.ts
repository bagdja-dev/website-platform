import { NextResponse } from "next/server";

const API_BASE =
  process.env.BAGDJA_WEBSITE_API_URL ??
  process.env.NEXT_PUBLIC_API_URL ??
  "http://localhost:5003";

export async function GET() {
  try {
    const response = await fetch(
      `${API_BASE.replace(/\/$/, "")}/api/public/realtime/ws-token`,
      { cache: "no-store" },
    );
    if (!response.ok) {
      return NextResponse.json(
        { message: "Realtime service is unavailable" },
        { status: response.status },
      );
    }

    return NextResponse.json(await response.json(), {
      headers: { "Cache-Control": "no-store" },
    });
  } catch (error) {
    console.error("[Website Platform ws-token proxy] fetch failed:", error);
    return NextResponse.json(
      { message: "Realtime service is unavailable" },
      { status: 502 },
    );
  }
}
