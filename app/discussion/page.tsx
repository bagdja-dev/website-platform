import Link from "next/link";
import { redirect } from "next/navigation";

import { AccessRequestDiscussion } from "../access-request-discussion";
import { getPlatformAccess } from "@/lib/platform-access";
import { getSessionToken } from "@/lib/session";

export default async function ApplicantDiscussionPage() {
  const token = await getSessionToken();
  if (!token) redirect("/auth/login?next=%2Fdiscussion");
  const access = await getPlatformAccess(token);
  if (access.role !== "applicant") redirect("/");

  return (
    <main className="status-page discussion-page">
      <section className="status-card discussion-page-card">
        <Link className="back-link" href="/">
          ← Ringkasan
        </Link>
        <h1>Ruang diskusi</h1>
        <p>
          Kamu diundang untuk berdiskusi dengan tim kurasi Bagdja. Akses ini
          terbatas pada percakapan permohonan dan belum merupakan akses
          designer.
        </p>
        <AccessRequestDiscussion />
      </section>
    </main>
  );
}
