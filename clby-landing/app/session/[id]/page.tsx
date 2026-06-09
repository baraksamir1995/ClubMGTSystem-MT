import type { Metadata } from "next";
import SessionRedirect from "./SessionRedirect";

export const metadata: Metadata = {
  title: { absolute: "Open in CLBY" },
  description: "Open this class in the CLBY app.",
  robots: { index: false, follow: false },
};

export default function SessionLandingPage({
  params,
}: {
  params: { id: string };
}) {
  return <SessionRedirect sessionId={params.id} />;
}
