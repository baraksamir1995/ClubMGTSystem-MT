/**
 * Real product screenshots (gym dashboard, member app, coaches app),
 * captured from the actual apps running against a seeded demo gym
 * ("Forge Athletic Club"); files live in /public/screens.
 */
import { Container, SectionHeader } from "@/components/site/ui";
import Reveal from "@/components/site/Reveal";

/** Admin dashboard in a full-width browser frame (screenshot keeps 16:10). */
export function DashboardShot() {
  return (
    <figure>
      <div className="overflow-hidden rounded-[18px] border border-[#D9DBD3] bg-card shadow-product ring-1 ring-black/[0.02]">
        <div className="flex h-11 items-center gap-4 border-b border-line bg-[#FBFBF8] px-5" aria-hidden>
          <span className="flex gap-2">
            <span className="h-3 w-3 rounded-full bg-[#E1E3DB]" />
            <span className="h-3 w-3 rounded-full bg-[#E1E3DB]" />
            <span className="h-3 w-3 rounded-full bg-[#E1E3DB]" />
          </span>
        </div>
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          src="/screens/dashboard-attendance.webp"
          alt="CLBY gym dashboard: Attendance & Access live feed showing the latest QR check-in and recent check-ins by branch"
          width={2000}
          height={1250}
          className="block h-auto w-full"
          fetchPriority="high"
        />
      </div>
      <figcaption className="mt-5 text-center text-[15px] text-fg-muted">Your gym operations, all in one dashboard.</figcaption>
    </figure>
  );
}

/**
 * Full-length app screen: fixed header + bottom bar overlays with the
 * stitched scroll content between them, exactly as the app lays it out.
 * Heights are px at the exported 600px width (screen = 600×1305).
 */
type AppScreen = {
  name: string;
  caption: string;
  detail: string;
  alt: string;
  top?: number;
  body: number;
  bottom?: number;
};

const SCREEN_H = 1305;
const pct = (px: number) => `${(px / SCREEN_H) * 100}%`;

/**
 * iPhone-style device (brushed-metal edge, bezel, side buttons) whose
 * screen scrolls like the real app.
 */
function ScrollPhone({ s }: { s: AppScreen }) {
  const base = `/screens/app/${s.name}`;
  const scrolls = s.body > SCREEN_H - (s.top ?? 0) - (s.bottom ?? 0) + 2;
  return (
    <div className="relative">
      <span aria-hidden className="absolute -left-[3px] top-[19%] h-[7%] w-[4px] rounded-l-sm bg-[#3a3d38]" />
      <span aria-hidden className="absolute -left-[3px] top-[28%] h-[7%] w-[4px] rounded-l-sm bg-[#3a3d38]" />
      <span aria-hidden className="absolute -right-[3px] top-[24%] h-[11%] w-[4px] rounded-r-sm bg-[#3a3d38]" />
      <div className="rounded-[15%/7%] bg-[linear-gradient(145deg,#6b6e68,#2b2d2a_40%,#4a4d47)] p-[2.5px] shadow-[0_2px_4px_rgba(23,26,22,0.08),0_36px_60px_-28px_rgba(23,26,22,0.45)]">
        <div className="rounded-[14.4%/6.7%] bg-[#0c0d0c] p-[3.6%]">
          <div className="relative aspect-[600/1305] overflow-hidden rounded-[11.5%/5.3%] bg-white">
            {s.top ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={`${base}-top.webp`} alt="" aria-hidden width={600} height={s.top} loading="lazy" className="absolute inset-x-0 top-0 z-10 w-full" />
            ) : null}
            <div
              className={`absolute inset-x-0 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden ${scrolls ? "overflow-y-auto" : "overflow-hidden"}`}
              style={{ top: pct(s.top ?? 0), bottom: pct(s.bottom ?? 0) }}
              {...(scrolls ? { tabIndex: 0, role: "region", "aria-label": `${s.caption} screen. Scroll to see more.` } : {})}
            >
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={`${base}-body.webp`} alt={s.alt} width={600} height={s.body} loading="lazy" className="block w-full" />
            </div>
            {s.bottom ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={`${base}-bottom.webp`} alt="" aria-hidden width={600} height={s.bottom} loading="lazy" className="absolute inset-x-0 bottom-0 z-10 w-full" />
            ) : null}
          </div>
        </div>
      </div>
    </div>
  );
}

function AppShowcase({
  id,
  tag,
  title,
  body,
  screens,
}: {
  id: string;
  tag: string;
  title: string;
  body: string;
  screens: AppScreen[];
}) {
  return (
    <div>
      <Reveal className="grid grid-cols-1 gap-10 lg:grid-cols-[minmax(0,0.9fr)_minmax(0,1.1fr)] lg:items-end lg:gap-16">
        <div>
          <p className="text-[15px] font-medium text-fg-muted">{tag}</p>
          <h3 id={id} className="mt-2 font-display text-[2.25rem] leading-[1.1] tracking-[-0.02em] text-fg">
            {title}
          </h3>
          <p className="mt-4 max-w-xl text-body text-fg-muted">{body}</p>
        </div>
        <ol className="grid grid-cols-1 gap-x-10 gap-y-5 sm:grid-cols-2">
          {screens.map((s) => (
            <li key={s.name} className="border-l-2 border-line-strong/40 pl-4">
              <span>
                <span className="block text-[17px] font-semibold text-fg">{s.caption}</span>
                <span className="mt-0.5 block text-[15px] leading-relaxed text-fg-muted">{s.detail}</span>
              </span>
            </li>
          ))}
        </ol>
      </Reveal>

      {/* Phones: a scroll-snap strip below lg (contained, so the page never
          scrolls sideways); a centred row of equal-size devices from lg up. */}
      <div
        className="-mx-5 mt-12 flex snap-x snap-mandatory gap-6 overflow-x-auto px-5 pb-6 pt-2 sm:-mx-8 sm:px-8 lg:mx-0 lg:mt-16 lg:justify-center lg:overflow-visible lg:px-0 lg:pb-0"
        role="group"
        aria-labelledby={id}
      >
        {screens.map((s) => (
          <figure key={s.name} className="w-[260px] flex-shrink-0 snap-center lg:w-[calc((100%-6rem)/5)]">
            <ScrollPhone s={s} />
            <figcaption className="mt-5 text-center text-[15px] font-semibold text-fg">{s.caption}</figcaption>
          </figure>
        ))}
      </div>
    </div>
  );
}

const MEMBER_SCREENS: AppScreen[] = [
  { name: "home", caption: "Home", detail: "Banners, plan and days left, today's classes, live gym capacity and your locations.", alt: "Member app home: promo banner, Quarterly membership with 55 days left, today's classes with photos, monthly visits, gym capacity at 50%, quick access and the gym's locations", top: 177, body: 2042, bottom: 147 },
  { name: "explore", caption: "Explore", detail: "Plans, offers, coaches, physio and nutrition, programs and partners in one place.", alt: "Member app explore: membership plans, current offers, specialists, services, programs, session packages and partners", top: 177, body: 2584, bottom: 147 },
  { name: "schedule", caption: "Class schedule", detail: "Browse classes by day and branch, and reserve a spot.", alt: "Member app schedule: day picker, branch and class filters, and today's classes with capacity", top: 499, body: 1130, bottom: 147 },
  { name: "checkin", caption: "Attendance & check-in", detail: "Scan the gym's QR code at the door. Every visit is logged.", alt: "Member app attendance: membership card, Scan QR to check in, and check-in history", top: 177, body: 1625, bottom: 147 },
  { name: "checkout", caption: "Checkout", detail: "Pay in the app by card, valU or Apple Pay, with promo codes and a clear price breakdown.", alt: "Member app checkout: Quarterly plan, promo code field, price breakdown with VAT, and card, valU and Apple Pay options", top: 177, body: 1047, bottom: 212 },
];

const COACH_SCREENS: AppScreen[] = [
  { name: "c-log", caption: "Attendance", detail: "Today's logged sessions, with each client's sessions left.", alt: "Coaches app attendance: four sessions logged today with each client's sessions left", body: 1305 },
  { name: "c-members", caption: "Member management", detail: "Every client's package, sessions used and renewal alerts.", alt: "Coaches app roster: clients with sessions used out of ten and renewal warnings", top: 264, body: 2041, bottom: 75 },
  { name: "c-home", caption: "Session management", detail: "Members scan the coach's QR code to log a session, or log it manually.", alt: "Coaches app: the coach's QR code members scan to log a session, and manual session log", body: 1305 },
];

export default function AppScreens() {
  return (
    <section aria-labelledby="apps-title" className="bg-page-alt pb-24 pt-16 md:pb-32 md:pt-24">
      <Container>
        <SectionHeader
          id="apps-title"
          title={<>An app for your members.<br className="hidden md:block" /> And one for your coaches.</>}
          lead="Give every part of your gym a dedicated experience, connected to the same management platform. Scroll inside each phone to see the full screen."
        />

        <div className="mt-16 space-y-28 lg:mt-24 lg:space-y-36">
          <AppShowcase
            id="member-app-title"
            tag="For members"
            title="Member app"
            body="Members see their plan and days left, book classes, check in at the door with a QR code, and pay in the app."
            screens={MEMBER_SCREENS}
          />
          <AppShowcase
            id="coach-app-title"
            tag="For coaches"
            title="Coaches app"
            body="Personal trainers and physios log sessions from their phone. Each client's remaining sessions update as they go."
            screens={COACH_SCREENS}
          />
        </div>
      </Container>
    </section>
  );
}
