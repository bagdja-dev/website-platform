import Link from "next/link";
import { redirect } from "next/navigation";

import { getPlatformAccess } from "@/lib/platform-access";
import { getSessionToken } from "@/lib/session";
import { PlatformShell } from "./platform-shell";

const authErrors: Record<string, string> = {
  access_denied: "Proses masuk dibatalkan.",
  missing_parameters: "Respons login tidak lengkap. Silakan coba lagi.",
  state_mismatch: "Sesi login kedaluwarsa atau tidak valid. Silakan coba lagi.",
  token_exchange_failed: "Bagdja Auth belum dapat menyelesaikan login.",
  invalid_token_response:
    "Bagdja Auth mengembalikan respons login yang tidak valid.",
  server_misconfigured:
    "Login belum dapat dimulai karena konfigurasi server belum lengkap.",
  server_error: "Terjadi kendala saat login. Silakan coba lagi.",
};

type HomePageProps = {
  searchParams: Promise<{ authError?: string }>;
};

export default async function HomePage({ searchParams }: HomePageProps) {
  const { authError } = await searchParams;
  const token = await getSessionToken();

  if (!token) {
    const message = authError
      ? (authErrors[authError] ?? authErrors.server_error)
      : null;

    return <LoginPage authError={message} />;
  }

  const access = await getPlatformAccess(token);
  if (access.role === "applicant") {
    redirect("/discussion");
  }
  if (!access.allowed || access.role === null) {
    return <AccessPendingPage organizationName={access.organizationName} />;
  }

  return (
    <PlatformHome
      organizationName={access.organizationName}
      role={access.role ?? "designer"}
    />
  );
}

function Brand() {
  return (
    <div className="brand">
      <div className="brand-mark" aria-hidden="true">
        B
      </div>
      <div className="brand-copy">
        <strong>Bagdja</strong>
        <span>Website Platform</span>
      </div>
    </div>
  );
}

function LoginPage({ authError }: { authError: string | null }) {
  return (
    <main className="status-page">
      <section className="status-card">
        <Brand />
        <h1>Ruang kurasi template Bagdja</h1>
        <p>
          Ruang kurasi dan kerja designer template serta reviewer internal
          Bagdja untuk ekosistem Website Builder.
        </p>
        <div className="status-actions">
          <Link className="primary-link" href="/auth/login">
            Masuk dengan Bagdja
          </Link>
          <Link className="secondary-link" href="/apply">
            Ajukan akses designer
          </Link>
        </div>
        {authError ? (
          <p className="auth-error" role="alert">
            {authError}
          </p>
        ) : null}
        <p className="footer-note">
          Akses designer diberikan setelah permohonan ditinjau dan disetujui.
        </p>
      </section>
    </main>
  );
}

function AccessPendingPage({ organizationName }: { organizationName: string }) {
  return (
    <main className="status-page">
      <section className="status-card">
        <Brand />
        <h1>Akses belum tersedia</h1>
        <p>
          Akun ini belum memiliki akses ke Website Platform milik{" "}
          <strong>{organizationName}</strong>. Permohonan designer ditinjau
          manual dan tidak otomatis memberikan akses.
        </p>
        <div className="status-actions">
          <Link className="secondary-link" href="/apply">
            Ajukan akses designer
          </Link>
          <form action="/auth/logout" method="post">
            <button className="secondary-link" type="submit">
              Keluar
            </button>
          </form>
        </div>
      </section>
    </main>
  );
}

function PlatformHome({
  organizationName,
  role,
}: {
  organizationName: string;
  role: "super_admin" | "designer" | "reviewer";
}) {
  return (
    <PlatformShell
      organizationName={organizationName}
      role={role}
      section="overview"
      title="Ringkasan"
    >
      <div id="overview">
        <section className="welcome-card" aria-labelledby="access-ready-title">
          <div className="welcome-copy">
            <h2 id="access-ready-title">{roleLabel(role)} terverifikasi</h2>
            <p>
              Akses platform telah dikonfirmasi di Website API. Halaman kerja
              template dan proses review tersedia sesuai role akun ini.
            </p>
          </div>
          <div className="welcome-icon" aria-hidden="true">
            ✓
          </div>
        </section>

        <div className="section-heading">
          <h2>Aktivitas platform</h2>
          <span>Workspace baru</span>
        </div>
        <section className="stats-grid" aria-label="Ringkasan aktivitas">
          <StatCard
            label="Template"
            value="—"
            note={role === "designer" ? "Kelola pengajuan package npm" : "Tinjau versi yang diajukan"}
          />
          <StatCard
            label="Menunggu review"
            value="—"
            note={role === "designer" ? "Pantau status pengajuan" : "Buka antrean reviewer"}
          />
          <StatCard
            label="Designer"
            value="—"
            note="Undangan belum diaktifkan"
          />
        </section>

        <div className="section-heading">
          <h2>Langkah berikutnya</h2>
        </div>
        <section className="content-card">
          <div className="empty-state">
            <div className="empty-state-icon" aria-hidden="true">
              ↗
            </div>
            <h3>Fondasi akses sudah siap</h3>
            <p>
              {role === "super_admin"
                ? "Kelola undangan dan tinjau permohonan akses designer."
                : role === "designer"
                  ? "Ajukan template dengan versi npm yang dipin dan tanggapi catatan reviewer."
                  : "Tinjau package template, minta revisi, atau setujui untuk proses publikasi."}
            </p>
            {role === "super_admin" ? (
              <div className="status-actions">
                <Link className="primary-link" href="/templates">
                  Buka review template
                </Link>
                <Link className="secondary-link" href="/access">
                  Kelola akses platform
                </Link>
              </div>
            ) : (
              <Link className="primary-link" href="/templates">
                {role === "designer" ? "Kelola template saya" : "Buka antrean review"}
              </Link>
            )}
          </div>
        </section>
      </div>
    </PlatformShell>
  );
}

function roleLabel(role: "super_admin" | "designer" | "reviewer"): string {
  if (role === "super_admin") return "Super admin";
  return role === "reviewer" ? "Reviewer" : "Designer";
}

function StatCard({
  label,
  value,
  note,
}: {
  label: string;
  value: string;
  note: string;
}) {
  return (
    <article className="stat-card">
      <div className="stat-label">{label}</div>
      <div className="stat-value">{value}</div>
      <div className="stat-note">{note}</div>
    </article>
  );
}
