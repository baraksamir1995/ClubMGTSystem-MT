"use client";

import { TrendingUp, Users, Calendar, AlertCircle } from "lucide-react";

export default function DashboardMockup() {
  return (
    <div className="relative">
      {/* Floating phone app mockup behind the dashboard */}
      <div className="absolute -left-8 -bottom-10 w-[140px] md:w-[180px] z-0 hidden sm:block rotate-[-6deg]">
        <div className="relative rounded-[28px] border-[6px] border-canvas/20 bg-surface overflow-hidden shadow-2xl">
          <div className="aspect-[9/19.5] bg-ink p-3 flex flex-col text-[8px] md:text-[10px]">
            <div className="flex items-center justify-between text-canvas/60 font-mono pt-1 px-1">
              <span>9:41</span>
              <span>●●●●</span>
            </div>
            <div className="mt-3 text-center">
              <div className="text-[7px] font-mono uppercase tracking-wider text-muted">Iron Strong</div>
              <div className="font-display text-lg md:text-xl leading-none mt-1">Welcome back,</div>
              <div className="font-display text-lg md:text-xl leading-none">Ahmed</div>
            </div>
            <div className="mt-3 rounded-lg bg-surface text-canvas p-2">
              <div className="text-[6px] font-mono uppercase opacity-60">Active plan</div>
              <div className="font-display text-sm md:text-base mt-0.5">18 sessions left</div>
              <div className="text-[6px] opacity-60 mt-0.5">PT Package · exp Mar 14</div>
            </div>
            <div className="mt-2 grid grid-cols-2 gap-1.5">
              <div className="rounded-md bg-entry/10 border border-entry/20 p-1.5">
                <div className="text-[6px] font-mono uppercase text-entry">Today</div>
                <div className="text-[9px] font-semibold leading-tight mt-0.5">HIIT · 6pm</div>
              </div>
              <div className="rounded-md bg-surface border border-line p-1.5">
                <div className="text-[6px] font-mono uppercase text-muted">Streak</div>
                <div className="text-[9px] font-semibold mt-0.5">12 days 🔥</div>
              </div>
            </div>
            <div className="mt-auto pb-2 flex justify-around">
              <div className="h-1 w-6 rounded-full bg-entry" />
              <div className="h-1 w-6 rounded-full bg-canvas/20" />
              <div className="h-1 w-6 rounded-full bg-canvas/20" />
              <div className="h-1 w-6 rounded-full bg-canvas/20" />
            </div>
          </div>
        </div>
      </div>

      {/* Main dashboard mockup */}
      <div className="relative z-10 rounded-lg border border-canvas/10 bg-surface overflow-hidden shadow-[0_40px_80px_-40px_rgba(10,14,26,0.35)]">
        {/* browser chrome */}
        <div className="flex items-center justify-between px-4 py-2.5 bg-canvas/5 border-b border-canvas/10">
          <div className="flex items-center gap-1.5">
            <div className="h-2.5 w-2.5 rounded-full bg-canvas/15" />
            <div className="h-2.5 w-2.5 rounded-full bg-canvas/15" />
            <div className="h-2.5 w-2.5 rounded-full bg-canvas/15" />
          </div>
          <div className="text-[10px] font-mono text-muted">app.clby.io/dashboard</div>
          <div className="w-10" />
        </div>

        {/* dashboard content */}
        <div className="p-4 md:p-6">
          {/* header */}
          <div className="flex items-start justify-between mb-5">
            <div>
              <div className="text-[10px] font-mono uppercase tracking-wider text-muted">
                Good morning, Ahmed
              </div>
              <div className="font-display text-xl md:text-2xl mt-0.5 leading-none">
                Monday at a glance
              </div>
            </div>
            <div className="flex items-center gap-2">
              <div className="text-[10px] font-mono text-muted">All branches</div>
              <div className="h-6 w-6 rounded-full bg-entry flex items-center justify-center text-[10px] text-ink font-medium">
                A
              </div>
            </div>
          </div>

          {/* KPI cards */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-2 md:gap-3">
            <KPICard
              label="MRR"
              value="EGP 247K"
              delta="+12.4%"
              positive
              icon={<TrendingUp className="h-3.5 w-3.5" />}
            />
            <KPICard
              label="Active members"
              value="612"
              delta="+8"
              positive
              icon={<Users className="h-3.5 w-3.5" />}
            />
            <KPICard
              label="Today's check-ins"
              value="184"
              delta="↑ vs avg"
              positive
              icon={<Calendar className="h-3.5 w-3.5" />}
            />
            <KPICard
              label="Overdue renewals"
              value="23"
              delta="Action needed"
              negative
              icon={<AlertCircle className="h-3.5 w-3.5" />}
            />
          </div>

          {/* Chart */}
          <div className="mt-4 rounded-md border border-canvas/10 bg-ink p-3 md:p-4">
            <div className="flex items-center justify-between mb-3">
              <div>
                <div className="text-[10px] font-mono uppercase tracking-wider text-muted">
                  Revenue · last 30 days
                </div>
                <div className="font-display text-lg leading-none mt-0.5">EGP 247,380</div>
              </div>
              <div className="flex items-center gap-1 text-[10px] font-mono">
                <div className="flex items-center gap-1">
                  <div className="h-2 w-2 rounded-sm bg-entry" />
                  <span className="text-muted">This month</span>
                </div>
                <div className="flex items-center gap-1 ml-2">
                  <div className="h-2 w-2 rounded-sm bg-entry/40" />
                  <span className="text-muted">Last month</span>
                </div>
              </div>
            </div>
            <MiniChart />
          </div>

          {/* Activity row */}
          <div className="mt-3 grid grid-cols-1 md:grid-cols-2 gap-3">
            <div className="rounded-md border border-canvas/10 bg-ink p-3">
              <div className="text-[10px] font-mono uppercase tracking-wider text-muted mb-2">
                Needs your attention
              </div>
              <div className="space-y-1.5">
                <ActivityRow text="23 renewals overdue" amount="EGP 47,200" />
                <ActivityRow text="8 PT packages expiring this week" amount="8 members" />
                <ActivityRow text="3 class no-shows yesterday" amount="Review" />
              </div>
            </div>
            <div className="rounded-md border border-entry/20 bg-entry/[0.04] p-3">
              <div className="text-[10px] font-mono uppercase tracking-wider text-entry mb-2">
                Just happened
              </div>
              <div className="space-y-1.5">
                <ActivityRow text="Nour M. renewed Gold plan" amount="EGP 2,400" accent />
                <ActivityRow text="12 check-ins in last hour" amount="Live" accent />
                <ActivityRow text="WhatsApp blast sent to 184 members" amount="✓" accent />
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

function KPICard({
  label,
  value,
  delta,
  positive,
  negative,
  icon,
}: {
  label: string;
  value: string;
  delta: string;
  positive?: boolean;
  negative?: boolean;
  icon: React.ReactNode;
}) {
  return (
    <div className="rounded-md border border-canvas/10 bg-ink p-2.5 md:p-3">
      <div className="flex items-center gap-1.5 text-muted mb-1">
        {icon}
        <div className="text-[10px] font-mono uppercase tracking-wider">{label}</div>
      </div>
      <div className="font-display text-xl md:text-2xl leading-none tabular">{value}</div>
      <div
        className={`mt-1 text-[10px] font-mono ${
          negative ? "text-red-400" : positive ? "text-success" : "text-muted"
        }`}
      >
        {delta}
      </div>
    </div>
  );
}

function ActivityRow({
  text,
  amount,
  accent,
}: {
  text: string;
  amount: string;
  accent?: boolean;
}) {
  return (
    <div className="flex items-center justify-between text-xs md:text-sm">
      <span className={accent ? "text-canvas" : "text-canvas/80"}>{text}</span>
      <span
        className={`font-mono text-[10px] md:text-xs tabular ${
          accent ? "text-entry font-medium" : "text-muted"
        }`}
      >
        {amount}
      </span>
    </div>
  );
}

function MiniChart() {
  // Simple bar chart showing daily revenue
  const data = [
    42, 58, 51, 66, 71, 48, 52, 68, 79, 61, 74, 83, 69, 88, 92, 76, 84, 95,
    101, 89, 97, 108, 115, 99, 112, 124, 118, 131, 142, 138,
  ];
  const max = Math.max(...data);

  return (
    <div className="flex items-end gap-[2px] md:gap-[3px] h-16 md:h-20">
      {data.map((v, i) => {
        const isLast7 = i >= data.length - 7;
        return (
          <div
            key={i}
            className={`flex-1 rounded-sm transition-colors ${
              isLast7 ? "bg-entry" : "bg-canvas/30"
            }`}
            style={{ height: `${(v / max) * 100}%` }}
          />
        );
      })}
    </div>
  );
}
