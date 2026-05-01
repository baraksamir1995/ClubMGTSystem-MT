"use client";

import Link from "next/link";
import { useEffect, useState } from "react";

const APP_STORE_URL = "https://apps.apple.com/app/clby/id0000000000";
const PLAY_STORE_URL =
  "https://play.google.com/store/apps/details?id=com.clbyapp.clby";

type Platform = "ios" | "android" | "other";

function detectPlatform(): Platform {
  if (typeof navigator === "undefined") return "other";
  const ua = navigator.userAgent || "";
  if (/iPad|iPhone|iPod/.test(ua)) return "ios";
  if (/Android/i.test(ua)) return "android";
  return "other";
}

export default function SessionRedirect({ sessionId }: { sessionId: string }) {
  const [platform, setPlatform] = useState<Platform>("other");
  const [attempted, setAttempted] = useState(false);

  useEffect(() => {
    const p = detectPlatform();
    setPlatform(p);

    if (p === "other") return;

    const deepLink = `gymapp://session/${sessionId}`;
    const storeUrl = p === "ios" ? APP_STORE_URL : PLAY_STORE_URL;

    setAttempted(true);
    window.location.href = deepLink;

    // If the app didn't open within 1.8s, send to the store. Page
    // visibilityState flips to "hidden" when iOS/Android hands off to
    // the app, so we only redirect when the user is still here.
    const timer = window.setTimeout(() => {
      if (document.visibilityState === "visible") {
        window.location.href = storeUrl;
      }
    }, 1800);

    return () => window.clearTimeout(timer);
  }, [sessionId]);

  const openInApp = () => {
    window.location.href = `gymapp://session/${sessionId}`;
  };

  return (
    <main className="relative z-10 min-h-screen flex flex-col">
      <header className="px-5 md:px-8 py-5 border-b border-canvas/10">
        <Link href="/" className="inline-flex items-center gap-2.5">
          <img src="/logo.png" alt="CLBY" className="h-8 w-8 object-contain" />
          <span className="font-sans font-black text-lg leading-none tracking-tight text-canvas">
            CLBY
          </span>
        </Link>
      </header>

      <section className="flex-1 flex items-center justify-center px-5 md:px-8 py-16 relative overflow-hidden">
        <div className="absolute -top-32 -right-32 w-[500px] h-[500px] rounded-full bg-entry/10 blur-3xl pointer-events-none" />
        <div className="max-w-md w-full relative text-center">
          <div className="inline-flex items-center gap-2 text-xs font-mono uppercase tracking-wider text-muted mb-5">
            <span className="h-1.5 w-1.5 rounded-full bg-entry animate-pulse" />
            {attempted ? "Opening CLBY" : "CLBY"}
          </div>

          <h1 className="font-display text-display-lg text-canvas leading-[0.95]">
            {attempted ? "Opening the class…" : "Open in CLBY"}
          </h1>

          <p className="mt-5 text-base md:text-lg text-canvas/70 leading-relaxed">
            This link opens a class inside the CLBY app. If it didn&apos;t open
            automatically, you can launch it manually or grab the app below.
          </p>

          <div className="mt-8 flex flex-col gap-3">
            <button
              onClick={openInApp}
              className="w-full inline-flex items-center justify-center px-6 py-3.5 rounded-sm bg-entry text-ink font-sans font-bold text-sm tracking-wide hover:opacity-90 transition-opacity"
            >
              Open in CLBY app
            </button>

            {platform === "ios" && (
              <a
                href={APP_STORE_URL}
                className="w-full inline-flex items-center justify-center px-6 py-3.5 rounded-sm border border-canvas/20 text-canvas font-sans font-medium text-sm tracking-wide hover:bg-canvas/5 transition-colors"
              >
                Download on the App Store
              </a>
            )}

            {platform === "android" && (
              <a
                href={PLAY_STORE_URL}
                className="w-full inline-flex items-center justify-center px-6 py-3.5 rounded-sm border border-canvas/20 text-canvas font-sans font-medium text-sm tracking-wide hover:bg-canvas/5 transition-colors"
              >
                Get it on Google Play
              </a>
            )}

            {platform === "other" && (
              <div className="grid grid-cols-2 gap-3">
                <a
                  href={APP_STORE_URL}
                  className="inline-flex items-center justify-center px-4 py-3.5 rounded-sm border border-canvas/20 text-canvas font-sans font-medium text-sm tracking-wide hover:bg-canvas/5 transition-colors"
                >
                  App Store
                </a>
                <a
                  href={PLAY_STORE_URL}
                  className="inline-flex items-center justify-center px-4 py-3.5 rounded-sm border border-canvas/20 text-canvas font-sans font-medium text-sm tracking-wide hover:bg-canvas/5 transition-colors"
                >
                  Google Play
                </a>
              </div>
            )}
          </div>

          <p className="mt-8 text-xs font-mono uppercase tracking-wider text-muted">
            Session · {sessionId.slice(0, 8)}
          </p>
        </div>
      </section>
    </main>
  );
}
