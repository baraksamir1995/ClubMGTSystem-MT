import { NextRequest, NextResponse } from "next/server";
import { cleanPhone as normalizePhone, PHONE_ERROR } from "@/lib/phone";

const NOTES_MAX = 2000;

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { name, phone, gymName, branches, notes, source } = body ?? {};

    // Basic validation
    if (!name || typeof name !== "string" || name.trim().length < 2) {
      return NextResponse.json(
        { ok: false, error: "Please enter your name." },
        { status: 400 }
      );
    }

    const cleanPhone = normalizePhone(String(phone ?? ""));
    if (!cleanPhone) {
      return NextResponse.json(
        { ok: false, error: PHONE_ERROR },
        { status: 400 }
      );
    }

    if (!gymName || typeof gymName !== "string" || gymName.trim().length < 2) {
      return NextResponse.json(
        { ok: false, error: "Please tell us your gym or club name." },
        { status: 400 }
      );
    }

    const lead = {
      name: name.trim(),
      phone: cleanPhone,
      gymName: gymName.trim(),
      branches: Number(branches) || 1,
      // Same cap as clby-api (LeadController: notes max:2000).
      notes: (notes ?? "").toString().slice(0, NOTES_MAX),
      source: source ?? "landing-hero",
      createdAt: new Date().toISOString(),
      userAgent: req.headers.get("user-agent") ?? "",
    };

    // Forward to Laravel backend for persistence
    const BACKEND_URL = process.env.BACKEND_URL || "http://localhost:8081";
    try {
      const res = await fetch(`${BACKEND_URL}/api/leads`, {
        method: "POST",
        headers: { "Content-Type": "application/json", Accept: "application/json" },
        body: JSON.stringify(lead),
      });
      if (!res.ok) {
        console.error("[CLBY lead] backend error", await res.text());
        return NextResponse.json(
          { ok: false, error: "Could not save your request. Please try again." },
          { status: 500 }
        );
      }
    } catch (err) {
      console.error("[CLBY lead] backend unreachable", err);
      return NextResponse.json(
        { ok: false, error: "Service unavailable. Please try again." },
        { status: 503 }
      );
    }

    return NextResponse.json({ ok: true });
  } catch (err) {
    console.error("[CLBY lead] error", err);
    return NextResponse.json(
      { ok: false, error: "Something went wrong. Please try again." },
      { status: 500 }
    );
  }
}
