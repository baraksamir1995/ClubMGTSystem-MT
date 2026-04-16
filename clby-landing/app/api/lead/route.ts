import { NextRequest, NextResponse } from "next/server";

// Simple Egyptian phone validation: +20, 01X, etc.
const EG_PHONE = /^(\+?20|0)?1[0125]\d{8}$/;

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

    const cleanPhone = String(phone ?? "").replace(/\s|-/g, "");
    if (!EG_PHONE.test(cleanPhone)) {
      return NextResponse.json(
        { ok: false, error: "Please enter a valid Egyptian mobile number." },
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
      notes: (notes ?? "").toString().slice(0, 500),
      source: source ?? "landing-hero",
      createdAt: new Date().toISOString(),
      userAgent: req.headers.get("user-agent") ?? "",
    };

    // TODO: replace this block with your Supabase insert:
    //
    //   import { createClient } from "@supabase/supabase-js";
    //   const supabase = createClient(
    //     process.env.SUPABASE_URL!,
    //     process.env.SUPABASE_SERVICE_ROLE_KEY!
    //   );
    //   const { error } = await supabase.from("leads").insert(lead);
    //   if (error) throw error;
    //
    // Optionally fire a WhatsApp notification via your backend or an
    // automation tool (Zapier / Make / n8n) so you get pinged instantly.

    console.log("[CLBY lead]", lead);

    return NextResponse.json({ ok: true });
  } catch (err) {
    console.error("[CLBY lead] error", err);
    return NextResponse.json(
      { ok: false, error: "Something went wrong. Please try again." },
      { status: 500 }
    );
  }
}
