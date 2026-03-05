import { NextResponse } from 'next/server';

/**
 * Runtime config so API URL works without NEXT_PUBLIC_ at build time (e.g. in Docker on Render).
 * Set NEXT_PUBLIC_API_URL or API_URL in the Frontend service environment.
 */
export async function GET() {
  const apiUrl =
    process.env.NEXT_PUBLIC_API_URL ||
    process.env.API_URL ||
    '';
  return NextResponse.json({ apiUrl });
}
