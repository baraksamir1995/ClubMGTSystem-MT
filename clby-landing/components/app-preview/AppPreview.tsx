"use client";

/**
 * Live preview of the CLBY member app (gym_mobile_flutter), recreated in
 * React from the real screens:
 *   Splash   lib/features/splash/splash_screen.dart
 *   Home     lib/screens/home_screen.dart + widgets/gym_app_bar.dart
 *            + widgets/membership_card_unified.dart + screens/main_shell.dart
 *   Explore  lib/screens/explore_screen.dart
 *   Schedule lib/screens/schedule_screen.dart
 *   Checkout lib/screens/payment_summary_screen.dart
 * Sizes are the app's logical pixels (dp) on a 393×852 screen, then the
 * whole device is scaled. Only what the app actually brands is branded:
 * primary = buttons, selected nav item, links, card gradient start;
 * secondary = card gradient end; logo = app bar mark + splash mark.
 * Content (member, classes, prices, photos) is illustrative sample data;
 * photos live in /public/app-preview (Pexels, free licence) in both apps.
 *
 * MIRRORED FILE: keep identical to gym-admin/components/app-preview/.
 */

import { useEffect, useState, type ReactNode } from "react";
import {
  Apple,
  Bell,
  BookmarkCheck,
  Building2,
  CalendarCheck,
  CalendarDays,
  CalendarClock,
  ChevronLeft,
  ChevronRight,
  Clock,
  Compass,
  CreditCard,
  Dumbbell,
  Footprints,
  HeartPulse,
  Home,
  Lock,
  MapPin,
  QrCode,
  ReceiptText,
  RotateCcw,
  SlidersHorizontal,
  Tag,
  User,
  Users,
} from "lucide-react";
import { alpha, darken, safeHex, DEFAULT_PRIMARY, DEFAULT_SECONDARY, type AppBrand } from "./brand";

export type PreviewScreen = "splash" | "home" | "explore" | "schedule" | "checkout";

export const PREVIEW_SCREENS: { id: PreviewScreen; label: string }[] = [
  { id: "splash", label: "Splash" },
  { id: "home", label: "Home" },
  { id: "explore", label: "Explore" },
  { id: "schedule", label: "Schedule" },
  { id: "checkout", label: "Checkout" },
];

/** Sample photos, served from each app's /public/app-preview. */
const IMG = (name: string) => `/app-preview/${name}.webp`;

const W = 393;
const H = 852;
const FONT = '-apple-system, BlinkMacSystemFont, "SF Pro Text", "Segoe UI", Roboto, sans-serif';

/* ───────────────────────────── public component ───────────────────────────── */

export default function AppPreview({
  brand,
  scale = 0.72,
  fallbackLogoUrl = "/logo.png",
  screen: controlled,
  onScreenChange,
  showControls = true,
  tone = "dark",
}: {
  brand: AppBrand;
  scale?: number;
  /** Shown on the splash when the gym has no logo (the app's bundled CLBY mark). Null → gym initial. */
  fallbackLogoUrl?: string | null;
  screen?: PreviewScreen;
  onScreenChange?: (s: PreviewScreen) => void;
  showControls?: boolean;
  /** Background the controls sit on. */
  tone?: "dark" | "light";
}) {
  const [own, setOwn] = useState<PreviewScreen>("home");
  const screen = controlled ?? own;
  const setScreen = (s: PreviewScreen) => (onScreenChange ? onScreenChange(s) : setOwn(s));
  // Bumping this remounts the screen: replays the splash intro and resets scroll.
  const [nonce, setNonce] = useState(0);

  const b: AppBrand = {
    ...brand,
    primary: safeHex(brand.primary, DEFAULT_PRIMARY),
    secondary: safeHex(brand.secondary, DEFAULT_SECONDARY),
  };

  return (
    <div className="flex flex-col items-center">
      <style dangerouslySetInnerHTML={{ __html: KEYFRAMES }} />
      {showControls && (
        <div className="mb-4 flex items-center gap-2">
          <div role="tablist" aria-label="Preview screen" className={`inline-flex rounded-full p-1 ring-1 ${tone === "dark" ? "bg-white/[0.06] ring-white/10" : "bg-white ring-[#8B8F86]"}`}>
            {PREVIEW_SCREENS.map((s) => (
              <button
                key={s.id}
                type="button"
                role="tab"
                aria-selected={screen === s.id}
                onClick={() => { setScreen(s.id); setNonce((n) => n + 1); }}
                className={`min-h-[36px] rounded-full px-3 text-[13px] font-medium transition-colors ${
                  tone === "dark"
                    ? screen === s.id ? "bg-white text-black" : "text-white/70 hover:text-white"
                    : screen === s.id ? "bg-[#171A16] text-white" : "text-[#62665F] hover:text-[#171A16]"
                }`}
              >
                {s.label}
              </button>
            ))}
          </div>
          <button
            type="button"
            onClick={() => { setScreen("splash"); setNonce((n) => n + 1); }}
            title="Replay from the splash screen"
            aria-label="Reset preview"
            className={`flex h-[44px] w-[44px] items-center justify-center rounded-full ring-1 transition-colors ${
              tone === "dark" ? "text-white/70 ring-white/10 hover:text-white" : "bg-white text-[#62665F] ring-[#8B8F86] hover:text-[#171A16]"
            }`}
          >
            <RotateCcw className="h-4 w-4" />
          </button>
        </div>
      )}

      <PhoneFrame scale={scale} label={`Preview of ${b.gymName.trim() || "your gym"} in the CLBY member app: ${PREVIEW_SCREENS.find((x) => x.id === screen)?.label} screen`}>
        <div key={`${screen}-${nonce}`} className="absolute inset-0" style={{ animation: "clbyp-screen-in 260ms ease-out" }}>
          {screen === "splash" && <SplashScreen brand={b} fallbackLogoUrl={fallbackLogoUrl} />}
          {screen === "home" && <HomeScreen brand={b} onNavigate={(s) => { setScreen(s); setNonce((n) => n + 1); }} />}
          {screen === "explore" && <ExploreScreen brand={b} onNavigate={(s) => { setScreen(s); setNonce((n) => n + 1); }} />}
          {screen === "schedule" && <ScheduleScreen brand={b} onNavigate={(s) => { setScreen(s); setNonce((n) => n + 1); }} />}
          {screen === "checkout" && <CheckoutScreen brand={b} />}
        </div>
      </PhoneFrame>
    </div>
  );
}

const KEYFRAMES = `
@keyframes clbyp-screen-in { from { opacity: 0; transform: translateY(6px); } to { opacity: 1; transform: none; } }
@keyframes clbyp-mark-in { 0% { opacity: 0; transform: scale(0.6); } 70% { transform: scale(1.06); } 100% { opacity: 1; transform: scale(1); } }
@keyframes clbyp-fade-in { from { opacity: 0; } to { opacity: 1; } }
@keyframes clbyp-glow-in { from { opacity: 0; transform: scale(0.4); } to { opacity: 0.7; transform: scale(1); } }
@media (prefers-reduced-motion: reduce) { [style*="clbyp-"] { animation: none !important; } }
`;

/* ───────────────────────────── device ───────────────────────────── */

/**
 * The phone is a picture of the app: exposed to assistive tech as one
 * labelled image (its inner text is sample content, and the splash copies
 * the app's own faint footer text).
 */
function PhoneFrame({ scale, label, children }: { scale: number; label: string; children: ReactNode }) {
  const BEZEL = 12;
  const outerW = W + BEZEL * 2;
  const outerH = H + BEZEL * 2;
  return (
    <div role="img" aria-label={label} style={{ width: outerW * scale, height: outerH * scale }} className="relative flex-shrink-0">
      <div
        aria-hidden
        style={{ width: outerW, height: outerH, transform: `scale(${scale})`, transformOrigin: "top left", fontFamily: FONT }}
        className="absolute left-0 top-0"
      >
        {/* side buttons */}
        <div className="absolute -left-[3px] top-[150px] h-[34px] w-[4px] rounded-l bg-[#2a2a2e]" />
        <div className="absolute -left-[3px] top-[210px] h-[64px] w-[4px] rounded-l bg-[#2a2a2e]" />
        <div className="absolute -left-[3px] top-[285px] h-[64px] w-[4px] rounded-l bg-[#2a2a2e]" />
        <div className="absolute -right-[3px] top-[240px] h-[100px] w-[4px] rounded-r bg-[#2a2a2e]" />
        {/* body */}
        <div
          className="relative h-full w-full rounded-[64px] bg-[#0b0b0d]"
          style={{ padding: BEZEL, boxShadow: "0 0 0 2px #3a3a3f, 0 40px 80px -30px rgba(0,0,0,0.7)" }}
        >
          <div className="relative h-full w-full overflow-hidden rounded-[52px] bg-white">
            {children}
            {/* Dynamic Island */}
            <div className="pointer-events-none absolute left-1/2 top-[11px] z-30 h-[34px] w-[122px] -translate-x-1/2 rounded-full bg-black" />
          </div>
        </div>
      </div>
    </div>
  );
}

function StatusBar({ dark = true }: { dark?: boolean }) {
  const c = dark ? "#000" : "#fff";
  return (
    <div className="relative z-20 flex h-[54px] items-center justify-between px-[34px] pt-[6px]" style={{ color: c }}>
      <span className="text-[17px] font-semibold tracking-tight">9:41</span>
      <span className="flex items-center gap-[6px]">
        <svg width="19" height="12" viewBox="0 0 19 12" fill={c} aria-hidden>
          <rect x="0" y="8" width="3.2" height="4" rx="1" /><rect x="5" y="5.5" width="3.2" height="6.5" rx="1" />
          <rect x="10" y="3" width="3.2" height="9" rx="1" /><rect x="15" y="0" width="3.2" height="12" rx="1" />
        </svg>
        <svg width="17" height="12" viewBox="0 0 17 12" fill={c} aria-hidden>
          <path d="M8.5 2.3c2.3 0 4.4.9 6 2.4l1.2-1.2A10.2 10.2 0 0 0 8.5.6C5.7.6 3.2 1.7 1.3 3.5l1.2 1.2a8.5 8.5 0 0 1 6-2.4Zm0 3.4c1.4 0 2.6.5 3.6 1.4l1.2-1.2a6.8 6.8 0 0 0-9.6 0l1.2 1.2c1-.9 2.2-1.4 3.6-1.4Zm0 3.4c.5 0 .9.2 1.2.5L8.5 11 7.3 9.6c.3-.3.7-.5 1.2-.5Z" />
        </svg>
        <span className="relative h-[13px] w-[27px] rounded-[4px] border" style={{ borderColor: dark ? "rgba(0,0,0,0.35)" : "rgba(255,255,255,0.5)" }}>
          <span className="absolute inset-[1.5px] rounded-[2px]" style={{ background: c }} />
        </span>
      </span>
    </div>
  );
}

function HomeIndicator() {
  return <div className="absolute bottom-[8px] left-1/2 z-20 h-[5px] w-[134px] -translate-x-1/2 rounded-full bg-black" />;
}

/* ───────────────────────────── shared app chrome ───────────────────────────── */

function GymMark({ brand, size, radius }: { brand: AppBrand; size: number; radius: number }) {
  if (brand.logoUrl) {
    // eslint-disable-next-line @next/next/no-img-element
    return <img src={brand.logoUrl} alt="" style={{ width: size, height: size, borderRadius: radius }} className="object-contain" />;
  }
  return (
    <span
      style={{ width: size, height: size, borderRadius: radius, background: "#1D1D1B", fontSize: size * 0.5 }}
      className="flex items-center justify-center font-bold text-white"
    >
      {(brand.gymName.trim()[0] ?? "G").toUpperCase()}
    </span>
  );
}

function GymAppBar({ brand, title, bell = false }: { brand: AppBrand; title: ReactNode; bell?: boolean }) {
  return (
    <div className="flex h-[56px] items-center bg-white px-4" style={{ borderBottom: "1px solid rgba(120,120,140,0.12)" }}>
      <GymMark brand={brand} size={26} radius={7} />
      <div className="ml-[10px] min-w-0 flex-1 truncate">{title}</div>
      {bell && (
        <span className="relative flex h-[28px] w-[28px] items-center justify-center">
          <Bell className="h-[22px] w-[22px] text-[#1D1D1B]" strokeWidth={1.8} />
          <span className="absolute right-[3px] top-[3px] h-[7px] w-[7px] rounded-full border-[1.5px] border-white bg-[#E24B4A]" />
        </span>
      )}
    </div>
  );
}

function BottomNav({ brand, active, onNavigate }: { brand: AppBrand; active: "home" | "classes" | "explore" | "profile"; onNavigate?: (s: PreviewScreen) => void }) {
  const item = (id: typeof active, label: string, Icon: typeof Home, target?: PreviewScreen) => {
    const on = id === active;
    return (
      <button
        type="button"
        onClick={() => target && onNavigate?.(target)}
        className="flex flex-1 flex-col items-center justify-center gap-[3px]"
        style={{ color: on ? brand.primary : "#757786", cursor: target ? "pointer" : "default" }}
        tabIndex={-1}
      >
        <Icon className="h-[24px] w-[24px]" strokeWidth={on ? 2.4 : 1.8} />
        <span className="text-[11px]" style={{ fontWeight: on ? 600 : 400 }}>{label}</span>
      </button>
    );
  };
  return (
    <div className="absolute inset-x-0 bottom-0 z-10 bg-white pb-[26px]" style={{ boxShadow: "0 -4px 16px rgba(0,0,0,0.08)" }}>
      <div className="flex h-[64px] items-center">
        {item("home", "Home", Home, "home")}
        {item("classes", "Classes", CalendarDays, "schedule")}
        <div className="flex w-[72px] justify-center">
          <span className="flex h-[52px] w-[52px] items-center justify-center rounded-full bg-[#1A1A2E]" style={{ boxShadow: "0 4px 12px rgba(0,0,0,0.28)" }}>
            <QrCode className="h-[24px] w-[24px] text-white" />
          </span>
        </div>
        {item("explore", "Explore", Compass, "explore")}
        {item("profile", "Profile", User)}
      </div>
    </div>
  );
}

function SectionHeader({ title, action, brand, px = 0 }: { title: string; action?: string; brand: AppBrand; px?: number }) {
  return (
    <div className="mb-[12px] flex items-center justify-between" style={{ paddingLeft: px, paddingRight: px }}>
      <span className="text-[16px] font-bold tracking-[-0.3px] text-[#1B1B21]">{title}</span>
      {action && <span className="text-[13px] font-semibold" style={{ color: brand.primary }}>{action}</span>}
    </div>
  );
}

/* ───────────────────────────── A. splash ───────────────────────────── */

function SplashScreen({ brand, fallbackLogoUrl }: { brand: AppBrand; fallbackLogoUrl: string | null }) {
  const [footer, setFooter] = useState(false);
  useEffect(() => {
    const t = setTimeout(() => setFooter(true), 700);
    return () => clearTimeout(t);
  }, []);
  const name = (brand.gymName.trim() || "CLBY").toUpperCase();
  return (
    <div className="absolute inset-0 bg-[#F7F6F2]">
      <StatusBar />
      {/* Outer div centres; inner animates (the keyframes own `transform`). */}
      <div className="absolute left-1/2 top-1/2 h-[380px] w-[380px] -translate-x-1/2 -translate-y-1/2">
        <div
          className="h-full w-full rounded-full"
          style={{ background: "radial-gradient(circle, #F4DCC1 0%, rgba(244,220,193,0) 65%)", animation: "clbyp-glow-in 600ms ease-out forwards" }}
        />
      </div>
      <div className="absolute inset-0 flex flex-col items-center justify-center px-[28px]">
        <div
          className="flex h-[88px] w-[88px] items-center justify-center overflow-hidden rounded-[25px]"
          style={{ boxShadow: "0 10.6px 28px rgba(31,26,20,0.18)", animation: "clbyp-mark-in 450ms cubic-bezier(.34,1.56,.64,1) both" }}
        >
          {brand.logoUrl || fallbackLogoUrl ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={brand.logoUrl ?? fallbackLogoUrl ?? ""} alt="" className="h-full w-full object-contain" />
          ) : (
            <GymMark brand={brand} size={88} radius={25} />
          )}
        </div>
        <div
          className="mt-[20px] text-center text-[28px] font-bold leading-tight text-[#1F1A14]"
          style={{ letterSpacing: 6, animation: "clbyp-fade-in 400ms ease-out 120ms both", wordBreak: "break-word" }}
        >
          {name}
        </div>
      </div>
      <div
        className="absolute inset-x-0 bottom-[98px] text-center text-[12px] font-medium tracking-[0.5px]"
        style={{ color: "rgba(31,26,20,0.42)", opacity: footer ? 1 : 0, transition: "opacity 300ms" }}
      >
        Loading your gym…
      </div>
      <HomeIndicator />
    </div>
  );
}

/* ───────────────────────────── shared bits ───────────────────────────── */

const SCROLL = "flex-1 overflow-y-auto overscroll-contain [scrollbar-width:none] [&::-webkit-scrollbar]:hidden";

function Photo({ name, className = "", children }: { name: string; className?: string; children?: ReactNode }) {
  return (
    <div className={`relative overflow-hidden bg-[#2a2c29] ${className}`}>
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img src={IMG(name)} alt="" className="absolute inset-0 h-full w-full object-cover" loading="lazy" />
      {children}
    </div>
  );
}

function HRow({ children, px = 16 }: { children: ReactNode; px?: number }) {
  return (
    <div className="flex gap-3 overflow-x-auto [scrollbar-width:none] [&::-webkit-scrollbar]:hidden" style={{ marginLeft: -px, marginRight: -px, paddingLeft: px, paddingRight: px }}>
      {children}
    </div>
  );
}

/* ───────────────────────────── B. home ───────────────────────────── */

const SAMPLE_CLASSES = [
  { name: "HIIT Power Hour", time: "7:00 AM · 60 min", coach: "Coach Salma", photo: "p3253501", spots: "8 spots left" },
  { name: "Metcon", time: "9:00 AM · 60 min", coach: "Coach Youssef", photo: "p4720236", spots: "9 spots left" },
  { name: "Barbell Strength", time: "12:30 PM · 60 min", coach: "Coach Youssef", photo: "p1552249", spots: "8 spots left" },
];

function HomeScreen({ brand, onNavigate }: { brand: AppBrand; onNavigate: (s: PreviewScreen) => void }) {
  return (
    <div className="absolute inset-0 flex flex-col bg-[#F6F7FB]">
      <div className="bg-white"><StatusBar /></div>
      <GymAppBar
        brand={brand}
        bell
        title={<span className="text-[13px] font-medium text-[#1D1D1B]">Good morning, Nour <span aria-hidden>☀️</span></span>}
      />
      <div className={`${SCROLL} px-4 pb-[120px] pt-4`}>
        {/* Banner carousel */}
        <Photo name="p1552242" className="h-[140px] rounded-[20px]">
          <div className="absolute inset-0 bg-[linear-gradient(to_top,rgba(0,0,0,0.78),rgba(0,0,0,0.05)_70%)]" />
          <span className="absolute left-3 top-3 rounded-full bg-[#B6FF32] px-2.5 py-0.5 text-[10px] font-extrabold text-[#171A16]">NEW</span>
          <div className="absolute inset-x-3 bottom-3 text-white">
            <div className="text-[17px] font-extrabold leading-tight">6-Week Shred Challenge</div>
            <div className="mt-0.5 text-[11px] text-white/80">Team up, train hard, win prizes. Starts 1 December.</div>
          </div>
        </Photo>
        <div className="mt-2 flex justify-center gap-1.5">
          <span className="h-[5px] w-4 rounded-full bg-[#E07A3B]" />
          <span className="h-[5px] w-[5px] rounded-full bg-[#CFCFD6]" />
        </div>

        <div className="h-5" />
        <SectionHeader title="Your membership" action="View plan" brand={brand} />
        <MembershipCard brand={brand} />

        <div className="h-6" />
        <SectionHeader title="Today's classes" action="See all" brand={brand} />
        <HRow>
          {SAMPLE_CLASSES.map((c) => (
            <Photo key={c.name} name={c.photo} className="h-[170px] w-[130px] flex-shrink-0 rounded-[16px]">
              <div className="absolute inset-0 bg-[linear-gradient(to_bottom,rgba(0,0,0,0.55),rgba(0,0,0,0)_40%,rgba(0,0,0,0.82))]" />
              <div className="absolute inset-0 flex flex-col p-3">
                <span className="self-start rounded-[8px] bg-[#15803D] px-2 py-1 text-[10px] font-bold text-white" style={{ border: "0.5px solid rgba(255,255,255,0.2)" }}>
                  {c.spots}
                </span>
                <span className="mt-auto line-clamp-2 text-[15px] font-extrabold leading-tight text-white">{c.name}</span>
                <span className="mt-1 text-[11px] font-medium text-white">{c.time}</span>
                <span className="mt-0.5 truncate text-[11px] text-white/85">{c.coach}</span>
              </div>
            </Photo>
          ))}
        </HRow>

        <div className="h-6" />
        <SectionHeader title="Your activity" brand={brand} />
        <div className="grid grid-cols-2 gap-2.5">
          <ActivityCard icon={<Footprints className="h-3 w-3" />} label="MONTHLY VISITS">
            <span className="text-[22px] font-extrabold text-[#1B1B21]">24</span>
            <span className="text-[11px] text-[#757786]">This month</span>
          </ActivityCard>
          <ActivityCard icon={<Users className="h-3 w-3" />} label="GYM CAPACITY">
            <span className="flex items-center gap-1.5 text-[13px] font-bold leading-tight text-[#1B1B21]">
              <span className="h-2 w-2 flex-shrink-0 rounded-full bg-[#F59E0B]" /> Moderately busy
            </span>
            <span className="ml-auto text-[13px] font-bold text-[#F59E0B]">50%</span>
          </ActivityCard>
        </div>

        <div className="h-6" />
        <div className="mb-3">
          <div className="text-[16px] font-bold tracking-[-0.3px] text-[#1B1B21]">Quick access</div>
          <div className="text-[12px] text-[#757786]">Jump straight where you need</div>
        </div>
        <HRow>
          {[
            { l: "Classes", I: CalendarDays, bg: "#F4DCC1", fg: "#1F1A14" },
            { l: "Trainers", I: User, bg: "rgba(224,122,59,0.14)", fg: "#E07A3B" },
            { l: "Bookings", I: BookmarkCheck, bg: "rgba(31,26,20,0.08)", fg: "#1F1A14" },
            { l: "Payments", I: ReceiptText, bg: "rgba(63,139,92,0.14)", fg: "#3F8B5C" },
          ].map(({ l, I, bg, fg }) => (
            <div key={l} className="flex h-[96px] w-[86px] flex-shrink-0 flex-col items-center justify-center gap-2 rounded-[18px] bg-white">
              <span className="flex h-[44px] w-[44px] items-center justify-center rounded-[14px]" style={{ background: bg, color: fg }}>
                <I className="h-5 w-5" />
              </span>
              <span className="text-[12px] font-semibold text-[#1F1A14]">{l}</span>
            </div>
          ))}
        </HRow>

        <div className="h-6" />
        <SectionHeader title="Our locations" action="See all" brand={brand} />
        <HRow>
          {[
            { n: "Maadi", a: "Road 9, Maadi", p: "p4720236" },
            { n: "New Cairo", a: "90th Street, Fifth Settlement", p: "p1954524" },
          ].map((b) => (
            <Photo key={b.n} name={b.p} className="h-[150px] w-[230px] flex-shrink-0 rounded-[16px]">
              <div className="absolute inset-0 bg-[linear-gradient(to_top,rgba(0,0,0,0.75),rgba(0,0,0,0)_65%)]" />
              <div className="absolute inset-x-3 bottom-3 flex items-end justify-between text-white">
                <div>
                  <div className="text-[18px] font-extrabold leading-tight">{b.n}</div>
                  <div className="text-[11px] text-white/80">{b.a}</div>
                </div>
                <span className="flex h-6 w-6 items-center justify-center rounded-full bg-white/20"><ChevronRight className="h-3.5 w-3.5" /></span>
              </div>
            </Photo>
          ))}
        </HRow>
      </div>
      <BottomNav brand={brand} active="home" onNavigate={onNavigate} />
      <HomeIndicator />
    </div>
  );
}

function ActivityCard({ icon, label, children }: { icon: ReactNode; label: string; children: ReactNode }) {
  return (
    <div className="rounded-[14px] bg-white px-3 py-2.5" style={{ border: "1px solid rgba(120,120,140,0.15)", boxShadow: "0 2px 8px rgba(0,0,0,0.04)" }}>
      <div className="flex items-center gap-1 text-[9px] font-bold tracking-[0.8px] text-[#757786]">{icon} {label}</div>
      <div className="mt-1 flex items-baseline gap-1.5">{children}</div>
    </div>
  );
}

function MembershipCard({ brand }: { brand: AppBrand }) {
  const end = brand.secondary || darken(brand.primary, 0.18);
  return (
    <div
      className="relative overflow-hidden rounded-[24px] p-[22px] text-white"
      style={{ background: `linear-gradient(135deg, ${brand.primary}, ${end})`, boxShadow: `0 10px 24px ${alpha(brand.primary, 0.3)}`, transition: "background 250ms, box-shadow 250ms" }}
    >
      <span className="absolute -right-10 -top-10 h-[160px] w-[160px] rounded-full bg-white/[0.06]" />
      <span className="absolute -bottom-[30px] right-[30px] h-[90px] w-[90px] rounded-full bg-white/[0.04]" />
      <div className="relative flex items-start justify-between">
        <div>
          <div className="text-[10px] font-bold tracking-[1.4px] text-white/65">MEMBERSHIP</div>
          <div className="mt-1 text-[22px] font-extrabold tracking-[-0.4px]">Quarterly</div>
          <div className="mt-0.5 text-[12px] font-medium text-white/70">Duration plan</div>
        </div>
        <span className="rounded-full border border-white/30 bg-white/[0.22] px-[11px] py-[5px] text-[11px] font-bold tracking-[0.4px]">Active</span>
      </div>
      <div className="relative mt-5 flex items-end gap-2.5">
        <span className="text-[56px] font-black leading-[0.95] tracking-[-2px]">55</span>
        <span className="pb-2">
          <span className="block text-[13px] font-semibold text-white/85">days left</span>
          <span className="block text-[11px] font-medium text-white/65">until Jan 20</span>
        </span>
      </div>
      <div className="relative mt-[18px] inline-flex items-center gap-1.5 rounded-[12px] bg-white/[0.14] px-3 py-2">
        <CalendarClock className="h-[13px] w-[13px]" />
        <span className="text-[11px] font-medium text-white/70">End date</span>
        <span className="text-[12px] font-bold">Jan 20</span>
      </div>
    </div>
  );
}

/* ───────────────────────────── C. explore ───────────────────────────── */

function ExploreScreen({ brand, onNavigate }: { brand: AppBrand; onNavigate: (s: PreviewScreen) => void }) {
  const cur = brand.currency ?? "EGP";
  const plans = [
    { name: "Monthly", price: "1,500", cycle: "/ month", color: "#1A1A2E" },
    { name: "Quarterly", price: "3,900", cycle: "/ quarter", color: "#D97706" },
    { name: "Annual", price: "12,000", cycle: "/ year", color: brand.primary },
  ];
  const gymName = brand.gymName.trim() || "Your gym";
  return (
    <div className="absolute inset-0 flex flex-col bg-[#F6F7FB]">
      <div className="bg-white"><StatusBar /></div>
      <GymAppBar brand={brand} title={<span className="text-[20px] font-extrabold text-[#1D1D1B]">Explore</span>} />
      <div className={`${SCROLL} pb-[120px] pt-4`}>
        <SectionHeader title="Memberships" brand={brand} px={20} />
        <div className="mx-5 overflow-hidden rounded-[16px] bg-white" style={{ boxShadow: "0 2px 10px rgba(0,0,0,0.05)" }}>
          <div className="flex items-center justify-between bg-[#1A1A2E] px-4 pb-[14px] pt-4">
            <span className="truncate pr-2 text-[15px] font-bold text-white">{gymName} membership plans</span>
            <ChevronRight className="h-[22px] w-[22px] flex-shrink-0 text-white/55" />
          </div>
          <div className="grid grid-cols-3 px-2 pb-3 pt-4">
            {plans.map((p) => (
              <div key={p.name} className="text-center">
                <div className="text-[11px] font-medium text-black/55">{p.name}</div>
                <div className="mt-1 text-[16px] font-extrabold" style={{ color: p.color }}>{p.price} {cur}</div>
                <div className="text-[11px] text-black/45">{p.cycle}</div>
              </div>
            ))}
          </div>
          <div className="flex items-center justify-between px-4 py-2.5" style={{ borderTop: "0.5px solid rgba(0,0,0,0.12)" }}>
            <span className="text-[12px] text-[#BDBDBD]">Tap to see full benefits</span>
            <span className="text-[12px] font-semibold" style={{ color: brand.primary }}>View plans ›</span>
          </div>
        </div>

        <div className="h-6" />
        <SectionHeader title="Current offers" action="See all" brand={brand} px={20} />
        <div className="px-5">
          <HRow px={20}>
            {[
              { t: "Bring a friend, save 20%", d: "Join with a friend and both get 20% off a Quarterly plan.", tag: "20% OFF", tc: "#B91C1C", p: "p841130", e: "Expires Dec 15" },
              { t: "PT starter pack", d: "3 personal training sessions to kick off your plan.", tag: "LIMITED", tc: "#1D4ED8", p: "p949126", e: "Expires Dec 7" },
            ].map((o) => (
              <div key={o.t} className="w-[160px] flex-shrink-0 overflow-hidden rounded-[14px] bg-white" style={{ border: "1px solid rgba(120,120,140,0.15)" }}>
                <Photo name={o.p} className="h-[84px]">
                  <span className="absolute bottom-2 left-2 rounded-[6px] px-2 py-0.5 text-[10px] font-bold text-white" style={{ background: o.tc }}>{o.tag}</span>
                </Photo>
                <div className="p-2.5">
                  <div className="line-clamp-2 text-[13px] font-bold leading-tight text-[#1B1B21]">{o.t}</div>
                  <div className="mt-1 line-clamp-2 text-[11px] leading-snug text-[#757786]">{o.d}</div>
                  <div className="mt-1 text-[10px] text-[#9A9AA6]">{o.e}</div>
                </div>
              </div>
            ))}
          </HRow>
        </div>

        <div className="h-6" />
        <SectionHeader title="Our specialists" action="See all" brand={brand} px={20} />
        <div className="flex gap-3 px-5">
          {[
            { n: "Mariam", s: "Nutrition", p: "p3822906" },
            { n: "Youssef", s: "Strength", p: "p3490348" },
            { n: "Salma", s: "Mobility", p: "p3076509" },
            { n: "Omar", s: "Physio", p: "p6455927" },
          ].map((t) => (
            <div key={t.n} className="w-[72px] text-center">
              <span className="relative mx-auto block h-[60px] w-[60px]">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src={IMG(t.p)} alt="" className="h-full w-full rounded-full object-cover" loading="lazy" />
                <span className="absolute bottom-[1px] right-[1px] h-[12px] w-[12px] rounded-full border-2 border-white" style={{ background: brand.primary }} />
              </span>
              <div className="mt-1.5 truncate text-[12px] font-bold text-[#1B1B21]">{t.n}</div>
              <div className="truncate text-[11px] text-[#757786]">{t.s}</div>
            </div>
          ))}
        </div>

        <div className="h-6" />
        <SectionHeader title="Services" brand={brand} px={20} />
        <div className="grid grid-cols-3 gap-2.5 px-5">
          {[
            { label: "Personal training", Icon: Dumbbell },
            { label: "Physiotherapy", Icon: HeartPulse },
            { label: "Nutrition", Icon: Apple },
          ].map(({ label, Icon }) => (
            <div key={label} className="flex flex-col items-center rounded-[16px] bg-white px-1 py-3.5" style={{ border: "1px solid rgba(120,120,140,0.15)" }}>
              <span className="flex h-[40px] w-[40px] items-center justify-center rounded-[12px]" style={{ background: alpha(brand.primary, 0.1), color: brand.primary }}>
                <Icon className="h-5 w-5" />
              </span>
              <span className="mt-2 text-center text-[11.5px] font-medium leading-tight text-[#1B1B21]">{label}</span>
            </div>
          ))}
        </div>

        <div className="h-6" />
        <SectionHeader title="Programs" action="See all" brand={brand} px={20} />
        <div className="px-5">
          <HRow px={20}>
            {[
              { t: "Strength Foundations", d: "Learn the big lifts with a coach.", w: "8 weeks", p: "p2261477" },
              { t: "Boxing Fundamentals", d: "Footwork, combos and conditioning.", w: "6 weeks", p: "p4761792" },
            ].map((g) => (
              <div key={g.t} className="w-[220px] flex-shrink-0 overflow-hidden rounded-[16px] bg-white" style={{ border: "1px solid rgba(120,120,140,0.15)" }}>
                <Photo name={g.p} className="h-[120px]">
                  <span className="absolute bottom-2 left-2 rounded-full bg-white/90 px-2.5 py-0.5 text-[11px] font-semibold text-[#1B1B21]">{g.w}</span>
                </Photo>
                <div className="p-3">
                  <div className="text-[14px] font-bold text-[#1B1B21]">{g.t}</div>
                  <div className="mt-0.5 truncate text-[11px] text-[#757786]">{g.d}</div>
                </div>
              </div>
            ))}
          </HRow>
        </div>

        <div className="h-6" />
        <SectionHeader title="Session packages" action="See all" brand={brand} px={20} />
        <div className="flex gap-3 px-5">
          {[{ n: "12", p: "1,800", per: "150" }, { n: "24", p: "3,200", per: "133" }].map((k) => (
            <div key={k.n} className="w-[140px] rounded-[16px] bg-white p-3.5" style={{ border: "1px solid rgba(120,120,140,0.15)" }}>
              <div className="text-[30px] font-black leading-none text-[#6B7280]">{k.n}</div>
              <div className="text-[11px] text-[#757786]">sessions</div>
              <div className="mt-4 text-[14px] font-extrabold text-[#1B1B21]">{k.p} {cur}</div>
              <div className="text-[10px] text-[#757786]">{k.per} {cur} / session</div>
            </div>
          ))}
        </div>

        <div className="h-6" />
        <SectionHeader title="Our partners" brand={brand} px={20} />
        <div className="px-5">
          <HRow px={20}>
            {["nutrifuel", "peakwear", "hydrolab", "coreclinic"].map((n) => (
              <div key={n} className="h-[86px] w-[100px] flex-shrink-0 overflow-hidden rounded-[14px]" style={{ border: "1px solid rgba(120,120,140,0.15)" }}>
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src={IMG(`partner-${n}`)} alt="" className="h-full w-full object-cover" loading="lazy" />
              </div>
            ))}
          </HRow>
        </div>
      </div>
      <BottomNav brand={brand} active="explore" onNavigate={onNavigate} />
      <HomeIndicator />
    </div>
  );
}

/* ───────────────────────────── D. schedule ───────────────────────────── */

const SAMPLE_SESSIONS = [
  { name: "HIIT Power Hour", coach: "Salma Hegazy", time: "7:00 AM – 8:00 AM", type: "HIIT", color: "#EA580C", fill: 0.6, spots: "8 spots left", ended: true },
  { name: "Metcon", coach: "Youssef Adel", time: "9:00 AM – 10:00 AM", type: "CrossFit", color: "#CA8A04", fill: 0.55, spots: "9 spots left", ended: false },
  { name: "Barbell Strength", coach: "Youssef Adel", time: "12:30 PM – 1:30 PM", type: "Strength", color: "#65A30D", fill: 0.6, spots: "8 spots left", ended: false },
];

function ScheduleScreen({ brand, onNavigate }: { brand: AppBrand; onNavigate: (s: PreviewScreen) => void }) {
  const days = [["Wed", "25"], ["Thu", "26"], ["Fri", "27"], ["Sat", "28"], ["Sun", "29"], ["Mon", "30"]];
  const chip = (label: string, on: boolean) => (
    <span key={label} className={`flex-shrink-0 rounded-full px-3 py-1.5 text-[12px] font-semibold ${on ? "bg-[#171A16] text-white" : "bg-white text-[#1B1B21]"}`} style={on ? {} : { border: "1px solid rgba(120,120,140,0.3)" }}>
      {label}
    </span>
  );
  return (
    <div className="absolute inset-0 flex flex-col bg-[#F6F7FB]">
      <div className="bg-white"><StatusBar /></div>
      <div className="bg-white">
        <div className="flex h-[56px] items-center px-4">
          <GymMark brand={brand} size={26} radius={7} />
          <span className="ml-[10px] flex-1 text-[20px] font-extrabold text-[#1D1D1B]">Schedule</span>
          <span className="flex h-9 w-9 items-center justify-center rounded-[10px]" style={{ background: alpha(brand.primary, 0.12), color: brand.primary }}>
            <CalendarDays className="h-[18px] w-[18px]" />
          </span>
          <span className="ml-2 flex h-9 w-9 items-center justify-center rounded-[10px] text-[#1D1D1B]" style={{ border: "1px solid rgba(120,120,140,0.25)" }}>
            <SlidersHorizontal className="h-[18px] w-[18px]" />
          </span>
        </div>
        <div className="flex gap-2 overflow-hidden px-4 pb-3">
          {days.map(([d, n], i) => (
            <span
              key={n}
              className="flex h-[66px] w-[48px] flex-shrink-0 flex-col items-center justify-center rounded-[12px]"
              style={i === 0 ? { background: "#171A16", color: "#fff" } : { border: `1.5px solid ${alpha(brand.primary, 0.35)}`, color: "#1B1B21", background: "#fff" }}
            >
              <span className="text-[11px]">{d}</span>
              <span className="text-[18px] font-extrabold leading-tight">{n}</span>
              <span className="mt-0.5 h-1 w-1 rounded-full" style={{ background: i === 0 ? "#fff" : brand.primary }} />
            </span>
          ))}
        </div>
        <div className="flex gap-2 overflow-hidden px-4 pb-2">{["All branches", "Maadi", "New Cairo", "Sheikh Zayed"].map((l, i) => chip(l, i === 0))}</div>
        <div className="flex gap-2 overflow-hidden px-4 pb-3">{["All classes", "Cardio", "CrossFit", "HIIT", "Mobility"].map((l, i) => chip(l, i === 0))}</div>
        <div className="px-4 pb-3 text-[14px] font-semibold text-[#1B1B21]" style={{ borderTop: "1px solid rgba(120,120,140,0.12)", paddingTop: 10 }}>
          Wed, Nov 25, 2026 <span className="font-normal text-[#757786]">· 3 classes</span>
        </div>
      </div>
      <div className={`${SCROLL} space-y-3 px-4 pb-[120px] pt-3`}>
        {SAMPLE_SESSIONS.map((c) => (
          <div key={c.name} className="relative overflow-hidden rounded-[16px] bg-white p-4 pl-5" style={{ border: "1px solid rgba(120,120,140,0.18)" }}>
            <span className="absolute inset-y-0 left-0 w-[4px]" style={{ background: c.color }} />
            <div className="flex items-center justify-between">
              <span className="text-[16px] font-extrabold text-[#1B1B21]">{c.name}</span>
              <ChevronRight className="h-4 w-4 text-[#9A9AA6]" />
            </div>
            <div className="mt-1 flex items-center gap-3 text-[11.5px] text-[#555]">
              <span className="flex items-center gap-1"><User className="h-3 w-3" /> {c.coach}</span>
              <span className="flex items-center gap-1"><MapPin className="h-3 w-3" /> Studio A</span>
            </div>
            <div className="mt-1.5 flex items-center gap-1.5 text-[13px] font-bold" style={{ color: brand.primary }}>
              <Clock className="h-3.5 w-3.5" /> {c.time}
            </div>
            <div className="mt-2 flex items-center gap-2 text-[11.5px] text-[#555]">
              Capacity
              <span className="relative h-[5px] flex-1 overflow-hidden rounded-full" style={{ background: alpha(c.color, 0.15) }}>
                <span className="absolute inset-y-0 left-0 rounded-full" style={{ width: `${c.fill * 100}%`, background: c.color }} />
              </span>
              <span className="font-semibold text-[#15803D]">{c.spots}</span>
            </div>
            <div className="mt-2 flex gap-1.5">
              <span className="rounded-full px-2.5 py-0.5 text-[10.5px] font-medium" style={{ border: `1px solid ${c.color}`, color: c.color }}>{c.type}</span>
              <span className="flex items-center gap-1 rounded-full px-2.5 py-0.5 text-[10.5px] font-medium" style={{ background: alpha(brand.primary, 0.12), color: brand.primary }}>
                <Building2 className="h-3 w-3" /> New Cairo
              </span>
            </div>
            {c.ended ? (
              <div className="mt-3 flex h-[40px] items-center justify-center gap-1.5 rounded-[10px] bg-[#EEEEF1] text-[13px] font-semibold text-[#555]">
                <CalendarDays className="h-3.5 w-3.5" /> Class ended
              </div>
            ) : (
              <div className="mt-3 flex h-[40px] items-center justify-center gap-1.5 rounded-[10px] text-[13px] font-semibold text-white" style={{ background: brand.primary }}>
                <CalendarCheck className="h-3.5 w-3.5" /> Book class
              </div>
            )}
          </div>
        ))}
      </div>
      <BottomNav brand={brand} active="classes" onNavigate={onNavigate} />
      <HomeIndicator />
    </div>
  );
}

/* ───────────────────────────── E. checkout ───────────────────────────── */

function CheckoutScreen({ brand }: { brand: AppBrand }) {
  const cur = brand.currency ?? "EGP";
  const card = { border: "1px solid rgba(120,120,140,0.18)" };
  const row = (l: string, v: string, bold = false) => (
    <div className={`flex justify-between text-[13px] ${bold ? "font-bold text-[#1B1B21]" : "text-[#555]"}`}>
      <span>{l}</span><span className={bold ? "" : "font-medium text-[#1B1B21]"}>{v}</span>
    </div>
  );
  return (
    <div className="absolute inset-0 flex flex-col bg-[#F6F7FB]">
      <div className="bg-white"><StatusBar /></div>
      <div className="relative flex h-[50px] items-center justify-center bg-white">
        <ChevronLeft className="absolute left-3 h-6 w-6 text-[#1D1D1B]" />
        <span className="text-[17px] font-bold text-[#1D1D1B]">Payment summary</span>
      </div>
      <div className={`${SCROLL} space-y-3 px-4 pb-[150px] pt-3`}>
        <div className="rounded-[16px] bg-white p-4" style={card}>
          <div className="flex gap-1.5">
            {["All branches", "Freeze up to 14 days"].map((t) => (
              <span key={t} className="rounded-full px-2.5 py-1 text-[10.5px] font-semibold" style={{ background: alpha(brand.primary, 0.12), color: darken(brand.primary, 0.2) }}>{t}</span>
            ))}
          </div>
          <div className="mt-2.5 text-[16px] font-extrabold text-[#1B1B21]">Quarterly</div>
          <div className="text-[12px] text-[#757786]">Duration plan · 90 days</div>
          <div className="my-3 h-px bg-[rgba(120,120,140,0.15)]" />
          <div className="flex items-baseline justify-between text-[13px] text-[#555]">
            Membership price <span><b className="text-[17px] text-[#1B1B21]">3,900</b> <span className="text-[11px]">{cur}</span></span>
          </div>
        </div>
        <div className="flex gap-2">
          <div className="flex h-[44px] flex-1 items-center gap-2 rounded-[12px] bg-white px-3 text-[13px] text-[#9A9AA6]" style={card}>
            <Tag className="h-4 w-4" /> Promo code
          </div>
          <span className="flex h-[44px] items-center rounded-[12px] px-5 text-[13px] font-semibold text-white" style={{ background: brand.primary }}>Apply</span>
        </div>
        <div className="space-y-2 rounded-[16px] bg-white p-4" style={card}>
          <div className="mb-1 text-[13px] font-bold text-[#1B1B21]">Price breakdown</div>
          {row("Membership price", `3,900 ${cur}`)}
          {row("Subtotal", `3,900 ${cur}`)}
          {row("VAT (14%)", `546 ${cur}`)}
          <div className="h-px bg-[rgba(120,120,140,0.15)]" />
          {row("Total", `4,446 ${cur}`, true)}
        </div>
        <div className="pt-1 text-[15px] font-bold text-[#1B1B21]">Payment</div>
        {[
          { l: "Credit / Debit card", I: <CreditCard className="h-4 w-4" />, on: true },
          { l: "valU", I: <span className="text-[10px] font-black text-[#14B8A6]">valU</span>, on: false },
          { l: "Apple Pay", I: <span className="rounded bg-black px-1.5 py-0.5 text-[9px] font-semibold text-white">Pay</span>, on: false },
        ].map((o) => (
          <div key={o.l} className="flex h-[52px] items-center gap-3 rounded-[14px] bg-white px-3" style={o.on ? { border: `2px solid ${brand.primary}` } : card}>
            <span className="flex h-8 w-11 items-center justify-center rounded-[8px] bg-[#F1F1F4] text-[#1B1B21]">{o.I}</span>
            <span className="flex-1 text-[13.5px] font-medium text-[#1B1B21]">{o.l}</span>
            <span className="flex h-[18px] w-[18px] items-center justify-center rounded-full" style={{ border: `2px solid ${o.on ? brand.primary : "#C7C7CF"}` }}>
              {o.on && <span className="h-[9px] w-[9px] rounded-full" style={{ background: brand.primary }} />}
            </span>
          </div>
        ))}
      </div>
      <div className="absolute inset-x-0 bottom-0 bg-white px-4 pb-[30px] pt-3" style={{ boxShadow: "0 -4px 16px rgba(0,0,0,0.06)" }}>
        <div className="flex h-[48px] items-center justify-center rounded-[14px] text-[15px] font-bold text-white" style={{ background: brand.primary }}>
          Buy now — 4,446 {cur}
        </div>
        <div className="mt-1.5 flex items-center justify-center gap-1 text-[10.5px] text-[#757786]"><Lock className="h-3 w-3" /> Secured by SSL</div>
      </div>
      <HomeIndicator />
    </div>
  );
}
