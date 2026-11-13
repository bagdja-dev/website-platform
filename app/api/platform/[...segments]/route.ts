import { NextRequest, NextResponse } from "next/server";

import { getSessionToken } from "@/lib/session";

type RouteContext = {
  params: Promise<{ segments: string[] }>;
};

const UUID_PATTERN = /^[0-9a-f-]{36}$/i;

/** Route template submission (Website API `api/website-platform/templates/*`). */
const TEMPLATE_SUBMISSION_ACTIONS: Record<string, readonly string[]> = {
  submit: ["POST"],
  check: ["POST"],
  review: ["POST"],
  "retry-publish": ["POST"],
  deprecate: ["POST"],
  revoke: ["POST"],
  preview: ["GET"],
  "client-source": ["GET"],
  "pinned-websites": ["GET"],
  discussion: ["GET", "POST"],
};

function isAllowedTemplateRoute(method: string, rest: string[]): boolean {
  if (rest.length === 1) {
    if (["review-queue", "packages", "discussions"].includes(rest[0])) return method === "GET";
    if (rest[0] === "submissions") return method === "POST";
    // Tim penguji designer (template-candidate-trial-plan §2.2).
    if (rest[0] === "testers") return method === "GET" || method === "POST";
    return false;
  }
  if (rest[0] === "testers") {
    return rest.length === 2 && UUID_PATTERN.test(rest[1]) && method === "DELETE";
  }
  if (rest[0] !== "submissions") return false;
  if (rest.length === 2) {
    if (rest[1] === "mine") return method === "GET";
    return UUID_PATTERN.test(rest[1]) && (method === "GET" || method === "PATCH");
  }
  if (!UUID_PATTERN.test(rest[1])) return false;
  if (rest.length === 3) return TEMPLATE_SUBMISSION_ACTIONS[rest[2]]?.includes(method) ?? false;
  return rest.length === 4 && rest[2] === "discussion" && rest[3] === "start" && method === "POST";
}

function isAllowedRoute(method: string, segments: string[]): boolean {
  if (segments.length === 1 && segments[0] === "access") {
    return method === "GET";
  }
  if (segments[0] === "templates") {
    return isAllowedTemplateRoute(method, segments.slice(1));
  }
  if (segments.length === 1 && segments[0] === "audit-logs") {
    return method === "GET";
  }
  if (segments.length === 1 && segments[0] === "access-requests") {
    return method === "GET" || method === "POST";
  }
  if (
    segments.length === 2 &&
    segments[0] === "access-requests" &&
    segments[1] === "discussions"
  ) {
    return method === "GET";
  }
  if (
    segments.length === 2 &&
    segments[0] === "access-requests" &&
    segments[1] === "mine"
  ) {
    return method === "GET";
  }
  if (
    segments.length === 3 &&
    segments[0] === "access-requests" &&
    segments[1] === "mine" &&
    segments[2] === "discussion"
  ) {
    return method === "GET" || method === "POST";
  }
  if (
    segments.length === 2 &&
    segments[0] === "access-requests" &&
    /^[0-9a-f-]{36}$/i.test(segments[1])
  ) {
    return method === "GET" || method === "PATCH";
  }
  if (
    segments.length === 3 &&
    segments[0] === "access-requests" &&
    /^[0-9a-f-]{36}$/i.test(segments[1]) &&
    segments[2] === "discussion"
  ) {
    return method === "GET" || method === "POST";
  }
  if (segments.length === 1 && segments[0] === "invitations") {
    return method === "GET" || method === "POST";
  }
  if (
    segments.length === 2 &&
    segments[0] === "invitations" &&
    segments[1] === "accept"
  ) {
    return method === "POST";
  }
  return (
    segments.length === 2 &&
    segments[0] === "invitations" &&
    /^[0-9a-f-]{36}$/i.test(segments[1]) &&
    method === "DELETE"
  );
}

async function proxy(
  request: NextRequest,
  context: RouteContext,
): Promise<NextResponse> {
  const { segments } = await context.params;
  if (!isAllowedRoute(request.method, segments)) {
    return NextResponse.json({ message: "Not found" }, { status: 404 });
  }

  const token = await getSessionToken();
  if (!token) {
    return NextResponse.json(
      { message: "Authentication required" },
      { status: 401 },
    );
  }

  const apiUrl =
    process.env.BAGDJA_WEBSITE_API_URL ??
    process.env.NEXT_PUBLIC_API_URL ??
    "http://localhost:5003";
  const target = new URL(
    "/api/website-platform/" + segments.map(encodeURIComponent).join("/"),
    apiUrl,
  );
  target.search = request.nextUrl.search;
  const headers = new Headers();
  if (token) headers.set("Authorization", "Bearer " + token);
  const contentType = request.headers.get("content-type");
  if (contentType && request.method !== "GET" && request.method !== "DELETE") {
    headers.set("Content-Type", contentType);
  }

  try {
    const response = await fetch(target, {
      method: request.method,
      headers,
      body:
        request.method === "GET" || request.method === "DELETE"
          ? undefined
          : await request.arrayBuffer(),
      cache: "no-store",
    });
    const responseBody = await response.text();
    return new NextResponse(responseBody, {
      status: response.status,
      headers: {
        "Content-Type":
          response.headers.get("Content-Type") ?? "application/json",
        "Cache-Control": "no-store",
      },
    });
  } catch (error) {
    console.error("Website Platform API request failed:", error);
    return NextResponse.json(
      { message: "Website Platform API is unavailable" },
      { status: 502 },
    );
  }
}

export async function GET(request: NextRequest, context: RouteContext) {
  return proxy(request, context);
}

export async function POST(request: NextRequest, context: RouteContext) {
  return proxy(request, context);
}

export async function PATCH(request: NextRequest, context: RouteContext) {
  return proxy(request, context);
}

export async function DELETE(request: NextRequest, context: RouteContext) {
  return proxy(request, context);
}
