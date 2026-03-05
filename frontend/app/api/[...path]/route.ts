import { NextRequest, NextResponse } from 'next/server';

/**
 * Same-origin API proxy: forwards /api/* to the backend via Render Private Network.
 * Browser only talks to the frontend domain; cookies stay first-party (no CORS).
 *
 * Env (server-only): INTERNAL_API_URL = 'http://<backend-service-name>:<port>'
 * Example: INTERNAL_API_URL = 'http://unified-line-oa-inbox:10000'
 */

const SKIP_HEADERS = new Set(['host', 'connection', 'keep-alive', 'transfer-encoding']);
const COOKIE_HEADER = 'cookie';
const SET_COOKIE_HEADER = 'set-cookie';

function getBackendBaseUrl(): string {
  const base = process.env.INTERNAL_API_URL;
  if (!base || typeof base !== 'string') {
    throw new Error('INTERNAL_API_URL is not set. Set it to backend Private Network URL (e.g. http://unified-line-oa-inbox:10000).');
  }
  return base.replace(/\/+$/, '');
}

/** Strip Domain= from Set-Cookie so the cookie is stored for the frontend (response) host. */
function rewriteSetCookieForFrontend(cookieValue: string): string {
  return cookieValue.replace(/\s*Domain=[^;]+;?/gi, ';').replace(/;+\s*$/, '');
}

export async function GET(request: NextRequest, context: { params: Promise<{ path: string[] }> }) {
  return proxy(request, context);
}

export async function POST(request: NextRequest, context: { params: Promise<{ path: string[] }> }) {
  return proxy(request, context);
}

export async function PUT(request: NextRequest, context: { params: Promise<{ path: string[] }> }) {
  return proxy(request, context);
}

export async function PATCH(request: NextRequest, context: { params: Promise<{ path: string[] }> }) {
  return proxy(request, context);
}

export async function DELETE(request: NextRequest, context: { params: Promise<{ path: string[] }> }) {
  return proxy(request, context);
}

export async function HEAD(request: NextRequest, context: { params: Promise<{ path: string[] }> }) {
  return proxy(request, context);
}

async function proxy(request: NextRequest, context: { params: Promise<{ path: string[] }> }) {
  const { path } = await context.params;
  if (!path?.length) {
    return NextResponse.json({ error: 'Not found' }, { status: 404 });
  }

  const base = getBackendBaseUrl();
  const pathSegments = path.join('/');
  const backendPath = `/api/${pathSegments}`;
  const url = new URL(request.url);
  const queryString = url.searchParams.toString();
  const backendUrl = `${base}${backendPath}${queryString ? `?${queryString}` : ''}`;

  const headers = new Headers();
  request.headers.forEach((value, key) => {
    const lower = key.toLowerCase();
    if (!SKIP_HEADERS.has(lower)) {
      headers.set(key, value);
    }
  });
  if (request.headers.get(COOKIE_HEADER)) {
    headers.set(COOKIE_HEADER, request.headers.get(COOKIE_HEADER)!);
  }

  let body: string | undefined;
  if (request.method !== 'GET' && request.method !== 'HEAD') {
    try {
      body = await request.text();
    } catch {
      body = undefined;
    }
  }

  const backendResponse = await fetch(backendUrl, {
    method: request.method,
    headers,
    body: body ?? undefined,
  });

  const responseHeaders = new Headers();
  backendResponse.headers.forEach((value, key) => {
    const lower = key.toLowerCase();
    if (lower === SET_COOKIE_HEADER) return;
    responseHeaders.set(key, value);
  });

  const setCookies = backendResponse.headers.getSetCookie?.() ?? [];
  for (const c of setCookies) {
    responseHeaders.append(SET_COOKIE_HEADER, rewriteSetCookieForFrontend(c));
  }

  const responseBody = backendResponse.body;
  return new NextResponse(responseBody ?? null, {
    status: backendResponse.status,
    statusText: backendResponse.statusText,
    headers: responseHeaders,
  });
}
