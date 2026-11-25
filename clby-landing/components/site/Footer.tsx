import { Container, Logo, WHATSAPP } from "./ui";

export default function Footer({ base = "" }: { base?: "" | "/" }) {
  const link = "inline-flex min-h-[44px] items-center text-[15px] text-fg-muted transition-colors hover:text-fg";
  return (
    <footer className="border-t border-line bg-page">
      <Container className="py-16 lg:py-20">
        <div className="flex flex-col gap-10 md:flex-row md:items-start md:justify-between">
          <div className="max-w-sm">
            <a href={base || "/"} aria-label="CLBY home" className="inline-block rounded-control">
              <Logo />
            </a>
            <p className="mt-5 text-base leading-relaxed text-fg-muted">
              Gym and club management for MENA. One platform for owners, coaches and members.
            </p>
          </div>
          <nav aria-label="Footer">
            <ul className="grid grid-cols-2 gap-x-12 sm:grid-cols-4">
              <li><a className={link} href={`${base}#features`}>Features</a></li>
              <li><a className={link} href={`${base}#pricing`}>Pricing</a></li>
              <li><a className={link} href={`${base}#faq`}>FAQ</a></li>
              <li>
                <a className={link} href={WHATSAPP} target="_blank" rel="noopener noreferrer">
                  WhatsApp<span className="sr-only"> (opens in a new tab)</span>
                </a>
              </li>
            </ul>
          </nav>
        </div>
        <div className="mt-10 flex flex-col gap-2 border-t border-line pt-6 text-sm text-fg-muted sm:flex-row sm:items-center sm:justify-between">
          <p>© {new Date().getFullYear()} CLBY. Made in Cairo.</p>
          <ul className="flex gap-6">
            <li><a className={link} href="/privacy">Privacy Policy</a></li>
            <li><a className={link} href="/terms">Terms</a></li>
          </ul>
        </div>
      </Container>
    </footer>
  );
}
