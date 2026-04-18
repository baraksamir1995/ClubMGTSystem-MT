import LegalPage from "@/components/LegalPage";
import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Terms of Service — CLBY",
  description:
    "The terms you agree to when using CLBY — the gym and club management platform.",
};

export default function TermsPage() {
  return (
    <LegalPage
      title="Terms of Service."
      subtitle="The rules of the game — what you can expect from us, and what we ask from you in return. No surprises, no buried clauses."
      lastUpdated="April 18, 2026"
      sections={[
        {
          heading: "Agreement",
          body: (
            <>
              <p>
                By creating an account or using any CLBY product — the
                marketplace app, branded apps, or admin dashboard — you agree to
                these Terms. If you are signing up on behalf of a company or
                gym, you confirm that you have the authority to bind that
                entity.
              </p>
              <p>
                If you disagree with any part of these Terms, please don't use
                the service.
              </p>
            </>
          ),
        },
        {
          heading: "The service",
          body: (
            <>
              <p>
                CLBY provides software for gyms and clubs to manage members,
                schedules, payments, attendance, staff, and more. We offer two
                types of access:
              </p>
              <ul>
                <li>
                  <strong>Marketplace plan</strong> — your gym is listed on the
                  shared CLBY consumer app, alongside other gyms.
                </li>
                <li>
                  <strong>White-Label plan</strong> — you get a branded app
                  published under your own identity in the App Store and Google
                  Play.
                </li>
              </ul>
              <p>
                We may add, change, or retire features over time. We will
                communicate material changes in advance where reasonably
                possible.
              </p>
            </>
          ),
        },
        {
          heading: "Your account",
          body: (
            <>
              <p>
                You are responsible for keeping your login credentials
                confidential and for all activity under your account. Notify us
                immediately if you suspect unauthorized access.
              </p>
              <p>
                One person per account, please. Staff members should have their
                own logins — this keeps audit trails clean and access revocable.
              </p>
            </>
          ),
        },
        {
          heading: "Fees and payment",
          body: (
            <>
              <p>
                Subscription fees are displayed in Egyptian Pounds (EGP) and
                billed monthly or annually, depending on the plan you choose.
                Fees are due in advance of the billing period.
              </p>
              <p>
                Annual plans include a discount equivalent to two months free.
                Prices may change with at least 30 days' notice before your
                next renewal.
              </p>
              <p>
                If a payment fails and is not resolved within 14 days, we may
                suspend the account until payment is received.
              </p>
            </>
          ),
        },
        {
          heading: "Trial period",
          body: (
            <>
              <p>
                New gyms may be offered a free trial. During the trial you have
                full access to the service. No credit card is required to start.
                If you do not convert to a paid plan before the trial ends, your
                account is paused, but your data is preserved for{" "}
                <strong>90 days</strong> in case you change your mind.
              </p>
            </>
          ),
        },
        {
          heading: "Acceptable use",
          body: (
            <>
              <p>You agree not to:</p>
              <ul>
                <li>Use CLBY for any unlawful purpose.</li>
                <li>
                  Upload content that is defamatory, infringing, obscene, or
                  violates someone else's rights.
                </li>
                <li>
                  Attempt to reverse-engineer, scrape, or overwhelm the service.
                </li>
                <li>
                  Share your login with people outside your team, or resell
                  access to the platform.
                </li>
                <li>
                  Send spam or unsolicited marketing through the platform's
                  notification tools.
                </li>
              </ul>
              <p>
                We reserve the right to suspend accounts that break these
                rules, with or without notice depending on severity.
              </p>
            </>
          ),
        },
        {
          heading: "Your data",
          body: (
            <>
              <p>
                You own your data. We don't claim any ownership over the member
                lists, schedules, payments, or content you store in CLBY.
              </p>
              <p>
                You grant us a limited license to process that data for the sole
                purpose of providing the service. For details on how we handle
                personal information, see our{" "}
                <a href="/privacy">Privacy Policy</a>.
              </p>
            </>
          ),
        },
        {
          heading: "White-label apps",
          body: (
            <>
              <p>
                For White-Label plans, CLBY builds and publishes a branded
                version of the mobile app on your behalf. You are responsible
                for providing your logo, brand assets, and any content that will
                appear under your name.
              </p>
              <p>
                Store listings are subject to Apple and Google review policies,
                which are outside our control. We do our best to get approvals
                quickly, but cannot guarantee timelines.
              </p>
            </>
          ),
        },
        {
          heading: "Third-party services",
          body: (
            <>
              <p>
                CLBY integrates with third-party services such as payment
                processors, messaging providers, and cloud infrastructure. Their
                terms apply to the services they provide. We are not responsible
                for outages or changes on their side, but we will work quickly
                to maintain uptime and find alternatives where needed.
              </p>
            </>
          ),
        },
        {
          heading: "Intellectual property",
          body: (
            <>
              <p>
                The CLBY name, logo, software, and documentation are our
                intellectual property. You get a non-exclusive, non-transferable
                license to use them while your subscription is active.
              </p>
              <p>
                The branded apps we build for you remain part of the CLBY
                platform — they are not custom software that you own outright.
                If you leave CLBY, the app is retired from the stores.
              </p>
            </>
          ),
        },
        {
          heading: "Cancellation",
          body: (
            <>
              <p>
                You can cancel anytime by contacting us. Cancellation takes
                effect at the end of the current billing period, and no refunds
                are issued for partial months or unused time. Annual plans are
                non-refundable.
              </p>
              <p>
                On cancellation, you can export your data within 90 days. After
                that, we delete it.
              </p>
            </>
          ),
        },
        {
          heading: "Suspension and termination by us",
          body: (
            <>
              <p>
                We may suspend or terminate your account if you breach these
                Terms, don't pay, or use the service in a way that harms other
                users or our systems. For serious violations we may act
                immediately; for less serious issues we will reach out first.
              </p>
            </>
          ),
        },
        {
          heading: "Warranties and disclaimers",
          body: (
            <>
              <p>
                We try hard to keep CLBY reliable, but the service is provided
                on an <strong>"as-is"</strong> and{" "}
                <strong>"as-available"</strong> basis. We do not guarantee that
                it will be uninterrupted, error-free, or perfectly secure.
              </p>
              <p>
                To the fullest extent permitted by law, we disclaim implied
                warranties of merchantability, fitness for a particular
                purpose, and non-infringement.
              </p>
            </>
          ),
        },
        {
          heading: "Limitation of liability",
          body: (
            <>
              <p>
                To the fullest extent permitted by law, CLBY's total liability
                for any claim arising out of these Terms is limited to the
                amount you paid us in the 12 months before the claim.
              </p>
              <p>
                We are not liable for indirect, incidental, or consequential
                damages — lost profits, missed members, damaged reputation, and
                the like.
              </p>
            </>
          ),
        },
        {
          heading: "Governing law",
          body: (
            <>
              <p>
                These Terms are governed by the laws of the Arab Republic of
                Egypt. Disputes will be resolved in the competent courts of
                Cairo, unless required otherwise by local consumer protection
                law.
              </p>
            </>
          ),
        },
        {
          heading: "Changes to these terms",
          body: (
            <>
              <p>
                We may update these Terms from time to time. For material
                changes, we will notify active customers at least 30 days before
                they take effect. Continued use of the service after the update
                means you accept the new Terms.
              </p>
            </>
          ),
        },
        {
          heading: "Contact",
          body: (
            <>
              <p>
                Questions about these Terms? WhatsApp us at{" "}
                <a
                  href="https://wa.me/201027823660"
                  target="_blank"
                  rel="noopener noreferrer"
                >
                  +20 102 782 3660
                </a>
                .
              </p>
            </>
          ),
        },
      ]}
    />
  );
}
