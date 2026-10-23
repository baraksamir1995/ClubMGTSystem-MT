import { NextRequest, NextResponse } from "next/server";

// Forwards the /register onboarding form (multipart, optional logo) to the
// Laravel API, which validates everything and creates a *pending* gym
// request. The API is the source of truth for validation; this route only
// rate-limits and relays the response (including field errors) verbatim.

const BACKEND_URL = process.env.BACKEND_URL || "http://localhost:8081";

const MAX_LOGO_BYTES = 2 * 1024 * 1024;

// Best-effort per-client limit. The API rate-limits too, but sees every
// submission as coming from this server, so per-applicant limiting has to
// happen here where the client IP is known.
const WINDOW_MS = 60 * 60 * 1000;
const MAX_PER_WINDOW = 10;
const hits = new Map<string, { count: number; resetAt: number }>();

// The client controls everything it puts in X-Forwarded-For; the reverse
// proxy in front of this container (Traefik) *appends* the address it saw.
// So the rightmost entry is the only one we can trust.
function clientIp(req: NextRequest): string {
  const parts = (req.headers.get("x-forwarded-for") ?? "").split(",").map((p) => p.trim()).filter(Boolean);
  return parts[parts.length - 1] ?? req.headers.get("x-real-ip") ?? "unknown";
}

function rateLimited(ip: string): boolean {
  const now = Date.now();
  const entry = hits.get(ip);
  if (!entry || entry.resetAt < now) {
    hits.set(ip, { count: 1, resetAt: now + WINDOW_MS });
    if (hits.size > 5000) {
      for (const [k, v] of hits) if (v.resetAt < now) hits.delete(k);
    }
    return false;
  }
  entry.count += 1;
  return entry.count > MAX_PER_WINDOW;
}

export async function POST(req: NextRequest) {
  const ip = clientIp(req);
  if (rateLimited(ip)) {
    return NextResponse.json(
      { message: "Too many attempts. Please try again in a little while." },
      { status: 429 }
    );
  }

  let form: FormData;
  try {
    form = await req.formData();
  } catch {
    return NextResponse.json({ message: "Invalid submission." }, { status: 400 });
  }

  const logo = form.get("logo");
  if (logo instanceof File && logo.size > MAX_LOGO_BYTES) {
    return NextResponse.json(
      { message: "Logo must be 2 MB or smaller.", errors: { logo: ["Logo must be 2 MB or smaller."] } },
      { status: 422 }
    );
  }
  if (logo !== null && !(logo instanceof File && logo.size > 0)) {
    form.delete("logo");
  }

  try {
    const res = await fetch(`${BACKEND_URL}/api/gym-requests`, {
      method: "POST",
      headers: {
        Accept: "application/json",
        "User-Agent": req.headers.get("user-agent") ?? "clby-landing",
        // Lets the API rate-limit per applicant instead of per this server
        // (GymRequestController::trustedClientIp). Ignored without the secret.
        ...(process.env.LANDING_PROXY_SECRET && ip !== "unknown"
          ? { "X-CLBY-Proxy-Secret": process.env.LANDING_PROXY_SECRET, "X-CLBY-Client-IP": ip }
          : {}),
      },
      body: form,
    });
    const body = await res.json().catch(() => null);
    if (res.status >= 500 || !body) {
      console.error("[CLBY gym-request] backend error", res.status);
      return NextResponse.json(
        { message: "We couldn't submit your request right now. Please try again." },
        { status: 502 }
      );
    }
    return NextResponse.json(body, { status: res.status });
  } catch (err) {
    console.error("[CLBY gym-request] network error", err);
    return NextResponse.json(
      { message: "We couldn't submit your request right now. Please try again." },
      { status: 502 }
    );
  }
}
