import type { ReactNode } from "react";
import { BarChart3, CalendarCheck, CreditCard, QrCode, Smartphone, Building2 } from "lucide-react";
import { Container, SectionHeader } from "./ui";
import Reveal from "./Reveal";

export type Feature = { icon: ReactNode; title: string; body: string };

/**
 * Copy is limited to what the product does today (no door hardware
 * integration; branded app beyond the shared CLBY app is a quoted option).
 */
export const DEFAULT_FEATURES: Feature[] = [
  {
    icon: <Smartphone className="h-5 w-5" />,
    title: "Branded member app",
    body: "Your logo and colours in your members' pockets, in the CLBY app or as your own app in the App Store and Google Play.",
  },
  {
    icon: <QrCode className="h-5 w-5" />,
    title: "Frictionless check-in",
    body: "Members scan a QR code at the door to check in. Your front desk stops arguing about who paid what.",
  },
  {
    icon: <CalendarCheck className="h-5 w-5" />,
    title: "Group sessions & classes",
    body: "Schedule recurring classes, manage capacity, track bookings, and let members reserve their spot.",
  },
  {
    icon: <CreditCard className="h-5 w-5" />,
    title: "Local payments, natively",
    body: "Member card payments, BNPL and Apple Pay in the app, plus cash and card recorded at the front desk.",
  },
  {
    icon: <BarChart3 className="h-5 w-5" />,
    title: "Reports that matter",
    body: "Revenue, class, collection and occupancy insights, without digging through spreadsheets.",
  },
  {
    icon: <Building2 className="h-5 w-5" />,
    title: "Multi-branch, unlimited members",
    body: "One dashboard, every location. Unlimited members at every tier.",
  },
];

export default function Features({
  title = "Everything your gym needs. In one system.",
  items = DEFAULT_FEATURES,
}: {
  title?: string;
  items?: Feature[];
}) {
  return (
    <section id="features" aria-labelledby="features-title" className="scroll-mt-20 bg-page py-24 lg:py-32">
      <Container>
        <SectionHeader id="features-title" title={title} />
        <ul className="mt-14 grid grid-cols-1 gap-5 sm:grid-cols-2 lg:mt-16 lg:grid-cols-3 lg:gap-6">
          {items.map((f) => (
            <Reveal as="li" key={f.title} className="h-full">
              <div className="flex h-full flex-col rounded-card border border-line bg-card p-8 lg:p-9">
                <span aria-hidden className="text-fg [&_svg]:h-6 [&_svg]:w-6 [&_svg]:stroke-[1.6]">{f.icon}</span>
                <h3 className="mt-6 font-display text-display-sm text-fg">{f.title}</h3>
                <p className="mt-3 text-body text-fg-muted">{f.body}</p>
              </div>
            </Reveal>
          ))}
        </ul>
      </Container>
    </section>
  );
}
