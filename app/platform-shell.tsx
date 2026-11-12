import Link from 'next/link';
import type { ReactNode } from 'react';

import { InboxNotificationBell } from './inbox-notification-bell';

type PlatformRole = 'super_admin' | 'designer' | 'reviewer';
type PlatformSection = 'overview' | 'templates' | 'packages' | 'access' | 'inbox';

export function PlatformShell({
  children,
  organizationName,
  role,
  section,
  title,
}: {
  children: ReactNode;
  organizationName: string;
  role: PlatformRole;
  section: PlatformSection;
  title: string;
}) {
  return (
    <div className="page-shell">
      <aside className="sidebar">
        <Link className="brand" href="/" aria-label="Bagdja Website Platform">
          <div className="brand-mark" aria-hidden="true">B</div>
          <div className="brand-copy">
            <strong>Bagdja</strong>
            <span>Website Platform</span>
          </div>
        </Link>
        <div className="nav-label">Workspace</div>
        <nav className="nav-list" aria-label="Navigasi utama">
          <Link
            className={`nav-item${section === 'overview' ? ' active' : ''}`}
            href="/"
            aria-current={section === 'overview' ? 'page' : undefined}
          >
            <span className="nav-icon" aria-hidden="true">⌂</span>
            Ringkasan
          </Link>
          {role !== 'designer' ? (
            <Link
              className={`nav-item${section === 'packages' ? ' active' : ''}`}
              href="/packages"
              aria-current={section === 'packages' ? 'page' : undefined}
            >
              <span className="nav-icon" aria-hidden="true">▤</span>
              Paket Template
            </Link>
          ) : null}
          <Link
            className={`nav-item${section === 'templates' ? ' active' : ''}`}
            href="/templates"
            aria-current={section === 'templates' ? 'page' : undefined}
          >
            <span className="nav-icon" aria-hidden="true">▦</span>
            {role === 'designer' ? 'Template saya' : 'Template & review'}
          </Link>
          <Link
            className={`nav-item${section === 'inbox' ? ' active' : ''}`}
            href="/inbox"
            aria-current={section === 'inbox' ? 'page' : undefined}
          >
            <span className="nav-icon" aria-hidden="true">✉</span>
            Inbox
          </Link>
          {role === 'super_admin' ? (
            <>
              <Link
                className={`nav-item${section === 'access' ? ' active' : ''}`}
                href="/access"
                aria-current={section === 'access' ? 'page' : undefined}
              >
                <span className="nav-icon" aria-hidden="true">♙</span>
                Akses & undangan
              </Link>
            </>
          ) : null}
        </nav>
        <div className="sidebar-footer">
          <span className="role-chip">
            <span className="role-dot" /> {roleLabel(role)}
          </span>
        </div>
      </aside>

      <div className="workspace">
        <header className="topbar">
          <div className="breadcrumb">
            Website Platform <span aria-hidden="true">/</span>{' '}
            <strong>{title}</strong>
          </div>
          <div className="topbar-actions">
            {role === 'super_admin' ? <InboxNotificationBell /> : null}
            <span className="topbar-user" aria-label="Akun Bagdja">B</span>
            <form action="/auth/logout" method="post">
              <button className="logout-button" type="submit">Keluar</button>
            </form>
          </div>
        </header>

        <main
          className={`main-content${
            section === 'access' || section === 'inbox' || section === 'templates' || section === 'packages'
              ? ' main-content-wide'
              : ''
          }`}
        >
          <div className="page-intro">
            <div>
              <div className="eyebrow">Admin workspace</div>
              <h1>{title}</h1>
              <p>{sectionDescription(section)}</p>
            </div>
            <span className="role-chip">
              <span className="role-dot" /> {roleLabel(role)} · {organizationName}
            </span>
          </div>
          {children}
        </main>
      </div>
    </div>
  );
}

function roleLabel(role: PlatformRole): string {
  if (role === 'super_admin') return 'Super admin';
  return role === 'reviewer' ? 'Reviewer' : 'Designer';
}

function sectionDescription(section: PlatformSection): string {
  if (section === 'access') {
    return 'Tinjau permohonan designer dan kelola undangan akses platform.';
  }
  if (section === 'inbox') {
    return 'Kelola percakapan review template dan diskusi dengan tim Bagdja.';
  }
  if (section === 'templates') {
    return 'Daftarkan package npm, cek otomatis dengan preview, lalu ajukan ke reviewer. Template yang disetujui langsung tampil di Studio.';
  }
  if (section === 'packages') {
    return 'Kelola versi template yang sudah terbit: tandai usang atau cabut bila bermasalah.';
  }
  return 'Kelola kurasi template dan akses kreator Bagdja.';
}
