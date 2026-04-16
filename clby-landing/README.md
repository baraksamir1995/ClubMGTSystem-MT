# CLBY — Landing Page

Production-ready Next.js 14 (App Router) landing page for CLBY. Designed to convert gym owners into booked demos.

## What's included

- **Hero** with integrated lead capture form (name, WhatsApp, gym name, branches, notes)
- **Social proof** marquee of founding gym logos
- **Features grid** — 6 core product pillars
- **Before/After product showcase** — the conversion section
- **Pricing** — EGP 5,000 base + 2,000 per branch, with multi-branch calculator
- **Honest comparison** — Excel vs foreign SaaS vs CLBY
- **FAQ** with expandable cards
- **Final CTA** with WhatsApp alternative
- **API route** `/api/lead` to capture form submissions (ready for Supabase)

## Design system

- **Type:** Instrument Serif (display) + Geist (body) — loaded via `next/font/google`, zero layout shift
- **Palette:** warm off-white canvas (`#F5F2EC`), deep navy ink (`#0A0E1A`), electric indigo accent (`#4D3BFF`)
- **Motion:** staggered fade-ups on hero, marquee for logos, hover micro-interactions
- **No generic AI purple gradients.** Editorial feel, sporty undertone.

## Setup

```bash
npm install
npm run dev
```

Open [http://localhost:3000](http://localhost:3000).

## Drop it into your monorepo

Since this is destined for your CLBY repo:

1. Copy the `app/`, `components/`, and config files into your Next.js app (or merge with your existing admin dashboard setup).
2. If you already have Tailwind configured, merge `tailwind.config.ts` into yours (specifically the `colors`, `fontFamily`, `fontSize`, `animation`, and `keyframes` sections).
3. Merge the font loading from `app/layout.tsx` into your root layout.
4. Add the CSS variables + grain texture from `app/globals.css` to your global stylesheet.

## Wiring up lead capture

The `/api/lead/route.ts` currently logs submissions to the console. Swap in your Supabase insert:

```bash
npm install @supabase/supabase-js
```

Add to `.env.local`:

```
SUPABASE_URL=https://your-project.supabase.co
SUPABASE_SERVICE_ROLE_KEY=your-service-role-key
WHATSAPP_NOTIFY_NUMBER=+201000000000  # optional — your mobile for instant pings
```

Create the `leads` table in Supabase:

```sql
create table public.leads (
  id            uuid primary key default gen_random_uuid(),
  name          text not null,
  phone         text not null,
  gym_name      text not null,
  branches      int  not null default 1,
  notes         text,
  source        text default 'landing-hero',
  user_agent    text,
  status        text default 'new',   -- new | contacted | demo_booked | customer | lost
  created_at    timestamptz default now()
);

-- RLS: service role only (form writes via API, not client)
alter table public.leads enable row level security;
```

Then uncomment the Supabase block in `app/api/lead/route.ts`.

## Key things to update before shipping

- [ ] Replace the WhatsApp number `+201000000000` (used in 3 places) with your real one
- [ ] Replace the marquee logo list in `components/... → SocialProof` with your actual founding gyms
- [ ] Update the "6 of 10 spots remaining" counter as you close founding customers
- [ ] Swap the placeholder dashboard mockup with a real screenshot from your actual admin dashboard once it's polished enough
- [ ] Add real open-graph image at `/public/og.png` (1200x630) for link unfurls

## Performance notes

- Fonts loaded via `next/font` = zero FOUT, self-hosted
- No images above the fold (the dashboard is rendered in HTML/CSS)
- No JS heavy libraries — `lucide-react` for icons, that's it
- Expect 95+ Lighthouse score out of the box

## File structure

```
app/
  api/lead/route.ts     # lead-capture endpoint
  globals.css           # design tokens + grain texture
  layout.tsx            # root layout + font loading + metadata
  page.tsx              # the whole landing page
components/
  DashboardMockup.tsx   # stylized admin preview (pure CSS/SVG)
  LeadForm.tsx          # conversion-focused form w/ success state
```
