/**
 * Additive same-origin proxy for the HOARE GitHub governance boundary.
 *
 * Provenance: 2026-09-13 — HOARE GitHub governance UI implementation.
 *
 * The browser never receives or stores the GitHub credential. The proxy forwards
 * the existing HOARE authentication context to the configured HOARE Agent API.
 * Set HOARE_API_BASE_URL in the deployment environment; local development
 * defaults to the existing HOARE HTTP service on 127.0.0.1:8080.
 */
import { NextRequest, NextResponse } from "next/server";

const HOARE_API_BASE_URL =
  process.env.HOARE_API_BASE_URL?.replace(/\/$/, "") || "http://127.0.0.1:8080";

const FORWARDED_REQUEST_HEADERS = [
  "authorization",
  "cookie",
  "content-type",
  "x-api-key",
  "x-tenant-id",
  "x-request-id",
] as const;

function upstreamUrl(path: string[]) {
  const suffix = path.map((segment) => encodeURIComponent(segment)).join("/");
  return `${HOARE_API_BASE_URL}/integrations/github/${suffix}`;
}

async function proxy(request: NextRequest, path: string[]) {
  const headers = new Headers();
  for (const name of FORWARDED_REQUEST_HEADERS) {
    const value = request.headers.get(name);
    if (value) headers.set(name, value);
  }

  const init: RequestInit = {
    method: request.method,
    headers,
    redirect: "manual",
  };

  if (request.method !== "GET" && request.method !== "HEAD") {
    init.body = await request.text();
  }

  try {
    const upstream = await fetch(upstreamUrl(path), init);
    const body = await upstream.text();
    const responseHeaders = new Headers();
    const contentType = upstream.headers.get("content-type");
    if (contentType) responseHeaders.set("content-type", contentType);

    return new NextResponse(body, {
      status: upstream.status,
      headers: responseHeaders,
    });
  } catch (error) {
    const detail = error instanceof Error ? error.message : "Unknown upstream error";
    return NextResponse.json(
      {
        error: "HOARE GitHub governance API is unreachable",
        detail,
      },
      { status: 502 },
    );
  }
}

export async function GET(
  request: NextRequest,
  context: { params: Promise<{ path: string[] }> },
) {
  const { path } = await context.params;
  return proxy(request, path);
}

export async function POST(
  request: NextRequest,
  context: { params: Promise<{ path: string[] }> },
) {
  const { path } = await context.params;
  return proxy(request, path);
}
