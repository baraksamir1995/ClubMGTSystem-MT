import LegalPage from "@/components/LegalPage";
import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Privacy Policy — CLBY",
  description:
    "How CLBY collects, uses, and protects personal information for gym owners, staff, and members.",
};

export default function PrivacyPage() {
  return (
    <LegalPage
      title="Privacy Policy."
      subtitle="Straightforward explanation of what we collect, why we collect it, and the choices you have. Written in plain language — no legal gymnastics."
      lastUpdated="April 18, 2026"
      sections={[
        {
          heading: "Who we are",
          body: (
            <>
              <p>
                CLBY is an all-in-one gym and club management platform operated
                from Cairo, Egypt. We provide software used by gym owners to
                manage their members, schedules, payments, and branded mobile
                apps.
              </p>
              <p>
                This policy covers the{" "}
                <strong>CLBY marketplace app</strong>, the{" "}
                <strong>branded (white-label) apps</strong> we build on behalf
                of gyms, and the{" "}
                <strong>admin dashboard</strong> used by gym owners and staff.
              </p>
            </>
          ),
        },
        {
          heading: "Information we collect",
          body: (
            <>
              <p>
                We only collect what we need to run the service. Specifically:
              </p>
              <ul>
                <li>
                  <strong>Account details</strong> — your name, email, phone
                  number, and password when you sign up as a gym owner, staff
                  member, or gym member.
                </li>
                <li>
                  <strong>Gym profile</strong> — business name, branches,
                  address, operating hours, logo, and the services you offer.
                </li>
                <li>
                  <strong>Member records</strong> — data entered by gyms about
                  their members (plan, sessions, attendance, notes).
                </li>
                <li>
                  <strong>Payment data</strong> — amounts, methods, and
                  transaction IDs. We do not store full card numbers; those are
                  handled by our payment partners.
                </li>
                <li>
                  <strong>Usage data</strong> — device type, approximate
                  location (when you opt in for nearby-gym discovery), pages
                  visited, and error logs.
                </li>
              </ul>
            </>
          ),
        },
        {
          heading: "How we use your information",
          body: (
            <>
              <p>Your data is used to:</p>
              <ul>
                <li>Deliver the features you signed up for.</li>
                <li>Authenticate you and keep your account secure.</li>
                <li>Process payments and issue receipts.</li>
                <li>
                  Send transactional notifications (check-ins, receipts, renewal
                  reminders).
                </li>
                <li>
                  Improve the product — anonymized and aggregated only, never
                  tied back to an individual.
                </li>
                <li>
                  Comply with applicable laws in Egypt and the regions we serve.
                </li>
              </ul>
              <p>
                We do not sell your personal information. We do not rent your
                contact list. We do not use your data to train third-party AI
                models.
              </p>
            </>
          ),
        },
        {
          heading: "Gym owners vs. gym members",
          body: (
            <>
              <p>
                When a gym uses CLBY, the gym is the <strong>data controller</strong>{" "}
                of its members' records. CLBY acts as the{" "}
                <strong>data processor</strong>.
              </p>
              <p>
                If you are a member of a gym and you'd like to access, correct,
                or delete your personal data, please contact that gym directly.
                If they are unresponsive, reach out to us and we will help
                facilitate the request.
              </p>
            </>
          ),
        },
        {
          heading: "Payment processing",
          body: (
            <>
              <p>
                Online payments are handled by our payment partners (such as
                Paymob and other licensed providers). When you pay through the
                app, card details are entered directly into the processor's
                secure environment — CLBY does not see or store your full card
                number.
              </p>
              <p>
                We do receive a record of the transaction (amount, status, and
                masked card reference) so gyms can reconcile their books.
              </p>
            </>
          ),
        },
        {
          heading: "Sharing with third parties",
          body: (
            <>
              <p>We share data only with:</p>
              <ul>
                <li>
                  <strong>Your gym</strong> — the gym you sign up with sees the
                  information required to manage your membership.
                </li>
                <li>
                  <strong>Infrastructure providers</strong> — AWS and similar
                  services that host our servers and store files, under strict
                  confidentiality agreements.
                </li>
                <li>
                  <strong>Payment processors</strong> — to execute transactions.
                </li>
                <li>
                  <strong>Communication providers</strong> — for transactional
                  emails and WhatsApp / SMS notifications.
                </li>
                <li>
                  <strong>Law enforcement</strong> — only when we receive a
                  valid legal request and only to the minimum extent required.
                </li>
              </ul>
            </>
          ),
        },
        {
          heading: "How long we keep data",
          body: (
            <>
              <p>
                Active account data is kept for as long as your account is
                active. When a gym cancels, we keep the records for up to{" "}
                <strong>90 days</strong> to allow reactivation or data export,
                then they are deleted or anonymized.
              </p>
              <p>
                Financial and tax records are retained for the period required
                by Egyptian law.
              </p>
            </>
          ),
        },
        {
          heading: "Your rights",
          body: (
            <>
              <p>You can, at any time:</p>
              <ul>
                <li>Access the personal data we hold about you.</li>
                <li>Correct inaccurate information.</li>
                <li>Delete your account (subject to retention rules above).</li>
                <li>Export your data in a portable format.</li>
                <li>Opt out of marketing communications.</li>
              </ul>
              <p>
                To exercise any of these rights, contact us and we will respond
                within a reasonable timeframe.
              </p>
            </>
          ),
        },
        {
          heading: "Security",
          body: (
            <>
              <p>
                We use encryption in transit (HTTPS/TLS) and at rest for
                sensitive data. Passwords are hashed, not stored in plain text.
                Access to production systems is limited, logged, and audited.
              </p>
              <p>
                No platform is 100% secure. If we detect a breach affecting your
                data, we will notify you without undue delay.
              </p>
            </>
          ),
        },
        {
          heading: "Cookies & tracking",
          body: (
            <>
              <p>
                Our website uses cookies for authentication and basic analytics.
                We do not use third-party advertising cookies.
              </p>
              <p>
                You can disable cookies in your browser — most of the site will
                still work, but you will need to log in again on each visit.
              </p>
            </>
          ),
        },
        {
          heading: "Children's privacy",
          body: (
            <>
              <p>
                CLBY is not intended for children under 13. Gyms may list minors
                as members with parental consent; in those cases, the parent or
                guardian is responsible for the account.
              </p>
            </>
          ),
        },
        {
          heading: "Changes to this policy",
          body: (
            <>
              <p>
                If we make material changes to this policy, we will update the
                "Last updated" date at the top of this page and notify active
                account holders by email or in-app message.
              </p>
            </>
          ),
        },
        {
          heading: "Contact",
          body: (
            <>
              <p>
                Questions, concerns, or requests? WhatsApp us at{" "}
                <a
                  href="https://wa.me/201027823660"
                  target="_blank"
                  rel="noopener noreferrer"
                >
                  +20 102 782 3660
                </a>
                . A human will get back to you.
              </p>
            </>
          ),
        },
      ]}
    />
  );
}
