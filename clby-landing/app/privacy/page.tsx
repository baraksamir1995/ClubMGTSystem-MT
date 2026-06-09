import LegalPage from "@/components/LegalPage";
import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Privacy Policy",
  description:
    "How CLBY collects, uses, and protects personal information for gym owners, staff, and members.",
  alternates: { canonical: "/privacy" },
};

export default function PrivacyPage() {
  return (
    <LegalPage
      title="Privacy Policy."
      subtitle="Straightforward explanation of what we collect, why we collect it, and the choices you have. Written in plain language. No legal gymnastics."
      lastUpdated="May 1, 2026"
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
                  <strong>Account details</strong>: your name, email, and
                  password when you sign up. Phone number, date of birth,
                  gender, and address are optional and only requested if you
                  choose to provide them.
                </li>
                <li>
                  <strong>Profile photo</strong>: optional, only if you choose
                  to upload one. Stored on Cloudflare R2.
                </li>
                <li>
                  <strong>Gym profile</strong>: business name, branches,
                  address, operating hours, logo, and the services you offer.
                </li>
                <li>
                  <strong>Member records</strong>: data entered by gyms about
                  their members (plan, sessions, attendance, notes).
                </li>
                <li>
                  <strong>Payment data</strong>: amounts, methods, and
                  transaction IDs. We do not store full card numbers; those are
                  handled by our payment partners (Stripe, Paymob).
                </li>
                <li>
                  <strong>Push notification token</strong>: a Firebase Cloud
                  Messaging (FCM) token tied to your device, used solely to
                  deliver in-app notifications such as class reminders and
                  payment receipts.
                </li>
                <li>
                  <strong>First-party analytics</strong>: anonymous, aggregated
                  product usage (screen views, feature interactions, error
                  logs) collected via Firebase Analytics. We do not collect
                  the iOS IDFA. We do not share this data with advertising
                  networks or data brokers.
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
                  Improve the product. Anonymized and aggregated only, never
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
                secure environment. CLBY does not see or store your full card
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
                  <strong>Your gym</strong>: the gym you sign up with sees the
                  information required to manage your membership.
                </li>
                <li>
                  <strong>Infrastructure providers</strong>: DigitalOcean
                  (compute), Cloudflare R2 (file storage), and similar services
                  that host our servers and store files, under strict
                  confidentiality agreements.
                </li>
                <li>
                  <strong>Payment processors</strong>: Stripe and Paymob, to
                  execute transactions for in-person gym memberships and class
                  packages.
                </li>
                <li>
                  <strong>Communication providers</strong>: Resend (email) and
                  Firebase Cloud Messaging (push notifications) for
                  transactional messages such as class reminders, receipts,
                  and verification emails.
                </li>
                <li>
                  <strong>Analytics</strong>: Firebase Analytics, configured
                  for first-party use only with no IDFA collection and no
                  ad-network integration.
                </li>
                <li>
                  <strong>Law enforcement</strong>: only when we receive a
                  valid legal request and only to the minimum extent required.
                </li>
              </ul>
            </>
          ),
        },
        {
          heading: "Sharing with other gym members",
          body: (
            <>
              <p>
                CLBY includes a feature that lets a member transfer remaining
                in-person session credits to another member of the same gym.
                When you transfer sessions:
              </p>
              <ul>
                <li>
                  The recipient is looked up by phone number — only members of
                  the same gym can be found.
                </li>
                <li>
                  The recipient sees your <strong>full name</strong> and
                  <strong> profile photo</strong> (if you have one) so they can
                  confirm they are receiving the credits from the right person.
                </li>
                <li>
                  We do not share your email, password, address, or any other
                  personal data with the recipient.
                </li>
                <li>
                  Phone numbers are never displayed to other members. Lookups
                  return only the matched member's name and photo.
                </li>
              </ul>
              <p>
                If you would prefer not to be discoverable for transfers, leave
                your phone number blank in your profile and other members will
                not be able to find you by phone.
              </p>
            </>
          ),
        },
        {
          heading: "Tracking and advertising",
          body: (
            <>
              <p>
                The CLBY mobile app does <strong>not</strong> track you across
                other apps or websites. Specifically, we do not:
              </p>
              <ul>
                <li>Collect the iOS IDFA or the Android Advertising ID.</li>
                <li>Share user data with advertising networks or data brokers.</li>
                <li>Combine your activity inside CLBY with activity from any
                  third-party app or website for advertising purposes.</li>
                <li>Sell, rent, or trade personal information.</li>
                <li>Use your data to train third-party AI models.</li>
              </ul>
              <p>
                Because we do not track in the sense defined by Apple's
                AppTrackingTransparency framework, the app does not show an
                ATT permission prompt.
              </p>
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
                <li>Correct inaccurate information from the Profile screen.</li>
                <li>
                  <strong>Delete your account</strong> directly from the
                  app: <em>Profile → Delete account</em>. This permanently
                  removes your personal data, subject to the retention rules
                  above (financial records may be retained where required by
                  law).
                </li>
                <li>Export your data in a portable format.</li>
                <li>Opt out of marketing communications.</li>
              </ul>
              <p>
                For any request we cannot fulfil from inside the app, contact
                us and we will respond within a reasonable timeframe.
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
                You can disable cookies in your browser. Most of the site will
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
