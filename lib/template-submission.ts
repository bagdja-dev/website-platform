/**
 * Model UI alur template: daftar package → cek otomatis → review → terbit.
 * Plan: plan/website-builder/template-submission-review-publication-flow.md.
 * Tipe ini mengikuti `TemplateSubmissionResponseDto` di Website API.
 */

export type PlatformRole = 'designer' | 'reviewer' | 'super_admin';

export type SubmissionStatus =
  | 'draft'
  | 'checking'
  | 'check_failed'
  | 'checked'
  | 'submitted'
  | 'in_review'
  | 'changes_requested'
  | 'rejected'
  | 'publishing'
  | 'publish_failed'
  | 'published'
  | 'deprecated'
  | 'revoked';

export type SystemPage =
  | 'header'
  | 'cart'
  | 'orders'
  | 'order_detail'
  | 'tagihan'
  | 'invoice_detail'
  | 'calendar'
  | 'gathering_plan';

export type CandidateFixture =
  | 'home'
  | 'page'
  | 'empty'
  | 'header_only'
  | Exclude<SystemPage, 'header'>;

export type CheckIssue = {
  code: string;
  level: 'error' | 'warning';
  message: string;
  field?: string;
};

export type CheckReport = {
  issues: CheckIssue[];
  renders: Array<{ fixture: string; ok: boolean; htmlBytes?: number; durationMs?: number; error?: string }>;
  package: { integrity: string; serverBundleBytes: number; clientBundleBytes: number } | null;
};

export type TemplateManifestSummary = {
  slug: string;
  name: string;
  version: string;
  businessProfiles: string[];
  capabilities: string[];
  sections: string[];
  pageOverrides?: SystemPage[];
  entry: { server: string; client?: string };
  defaultPages?: Array<{ slug: string; title: string; isHome?: boolean }>;
};

export type Submission = {
  id: string;
  designer_user_id: string;
  designer_email: string | null;
  name: string | null;
  slug: string | null;
  package_name: string;
  package_version: string;
  description: string;
  changelog: string;
  license: string;
  demo_url: string | null;
  github_url: string | null;
  discussion_topic_id: string | null;
  status: SubmissionStatus;
  tarball_integrity: string | null;
  candidate_digest: string | null;
  manifest: TemplateManifestSummary | null;
  check_report: CheckReport | null;
  checked_at: string | null;
  artifact_digest: string | null;
  publication_error: string | null;
  published_at: string | null;
  reviewer_user_id: string | null;
  review_note: string | null;
  submitted_at: string | null;
  reviewed_at: string | null;
  created_at: string;
  updated_at: string;
};

export type SubmissionForm = {
  packageName: string;
  packageVersion: string;
  description: string;
  changelog: string;
  license: string;
  demoUrl?: string;
  githubUrl: string;
};

export type Tone = 'neutral' | 'info' | 'progress' | 'warning' | 'success' | 'danger';

export const STATUS_META: Record<SubmissionStatus, { label: string; tone: Tone }> = {
  draft: { label: 'Draft', tone: 'neutral' },
  checking: { label: 'Sedang dicek', tone: 'progress' },
  check_failed: { label: 'Perlu perbaikan', tone: 'danger' },
  checked: { label: 'Siap diajukan', tone: 'info' },
  submitted: { label: 'Menunggu reviewer', tone: 'progress' },
  in_review: { label: 'Sedang direview', tone: 'progress' },
  changes_requested: { label: 'Perlu revisi', tone: 'warning' },
  rejected: { label: 'Ditolak', tone: 'danger' },
  publishing: { label: 'Sedang diterbitkan', tone: 'progress' },
  publish_failed: { label: 'Gagal terbit', tone: 'danger' },
  published: { label: 'Terbit', tone: 'success' },
  deprecated: { label: 'Usang', tone: 'neutral' },
  revoked: { label: 'Dicabut', tone: 'danger' },
};

export const FLOW_STEPS = [
  { id: 'register', title: 'Daftarkan package', hint: 'Nama & versi npm' },
  { id: 'check', title: 'Cek otomatis', hint: 'Validasi & preview' },
  { id: 'review', title: 'Review Bagdja', hint: 'Tim kurasi' },
  { id: 'publish', title: 'Terbit', hint: 'Muncul di Studio' },
] as const;

/** Indeks tahap aktif (0–3) dan apakah tahap itu bermasalah. */
export function flowPosition(status: SubmissionStatus): { step: number; blocked: boolean; done: boolean } {
  switch (status) {
    case 'draft':
      return { step: 1, blocked: false, done: false };
    case 'checking':
    case 'checked':
      return { step: 1, blocked: false, done: status === 'checked' };
    case 'check_failed':
      return { step: 1, blocked: true, done: false };
    case 'submitted':
    case 'in_review':
      return { step: 2, blocked: false, done: false };
    case 'changes_requested':
    case 'rejected':
      return { step: 2, blocked: true, done: false };
    case 'publishing':
      return { step: 3, blocked: false, done: false };
    case 'publish_failed':
      return { step: 3, blocked: true, done: false };
    default:
      return { step: 3, blocked: status === 'revoked', done: true };
  }
}

/** Kalimat "apa yang harus dilakukan sekarang" untuk designer. */
export function designerNextAction(status: SubmissionStatus): string {
  switch (status) {
    case 'draft':
      return 'Jalankan Cek package. Bagdja mengambil versi ini dari npm, memeriksa manifest, lalu me-render-nya dengan data contoh.';
    case 'checking':
      return 'Package sedang diperiksa. Biasanya selesai dalam kurang dari satu menit.';
    case 'check_failed':
      return 'Perbaiki masalah di bawah, terbitkan versi baru ke npm, ganti versinya di sini, lalu cek ulang.';
    case 'checked':
      return 'Semua pemeriksaan lolos. Lihat preview, lalu ajukan ke reviewer Bagdja.';
    case 'submitted':
      return 'Pengajuan sudah masuk antrean. Kamu akan mendapat kabar di Inbox bila reviewer butuh diskusi.';
    case 'in_review':
      return 'Reviewer sedang memeriksa template ini.';
    case 'changes_requested':
      return 'Reviewer meminta revisi. Diskusikan di Inbox, terbitkan versi baru ke npm, ganti versinya di sini, lalu cek ulang.';
    case 'rejected':
      return 'Pengajuan ini ditolak. Baca catatan reviewer; kamu bisa mendaftarkan versi baru sebagai pengajuan baru.';
    case 'publishing':
      return 'Template sedang diterbitkan ke katalog.';
    case 'publish_failed':
      return 'Template sudah disetujui, tetapi penerbitan gagal karena gangguan sistem. Tim Bagdja akan mencoba lagi.';
    case 'published':
      return 'Template sudah tampil di katalog Studio. Seller memilih sendiri kapan memasang atau memperbarui.';
    case 'deprecated':
      return 'Versi ini tidak lagi tampil di katalog. Website yang sudah memakainya tetap berjalan.';
    case 'revoked':
      return 'Versi ini dicabut. Website yang memakainya berhenti dirender sampai berganti versi.';
  }
}

export const EDITABLE_STATUSES: readonly SubmissionStatus[] = ['draft', 'check_failed', 'checked', 'changes_requested'];
export const CHECKABLE_STATUSES: readonly SubmissionStatus[] = ['draft', 'check_failed', 'checked'];

export const FIXTURE_LABELS: Record<CandidateFixture, string> = {
  home: 'Beranda',
  page: 'Halaman biasa',
  empty: 'Website baru (kosong)',
  header_only: 'Header',
  cart: 'Keranjang',
  orders: 'Transaksi',
  order_detail: 'Detail transaksi',
  tagihan: 'Tagihan',
  invoice_detail: 'Invoice',
  calendar: 'Kalender',
  gathering_plan: 'Rencana gathering',
};

export const CONTENT_FIXTURES: readonly CandidateFixture[] = ['home', 'page', 'empty'];

/** Urutan tampil halaman sistem; fixture header bernama `header_only`. */
const SYSTEM_PAGE_ORDER: readonly SystemPage[] = [
  'header',
  'cart',
  'orders',
  'order_detail',
  'tagihan',
  'invoice_detail',
  'calendar',
  'gathering_plan',
];

/** Fixture halaman sistem yang dinyatakan manifest (`pageOverrides`). */
export function systemFixtures(manifest: TemplateManifestSummary | null): CandidateFixture[] {
  const declared = new Set(manifest?.pageOverrides ?? []);
  return SYSTEM_PAGE_ORDER.filter((page) => declared.has(page)).map((page) =>
    page === 'header' ? 'header_only' : page,
  );
}

export function previewFixtures(manifest: TemplateManifestSummary | null): CandidateFixture[] {
  return [...CONTENT_FIXTURES, ...systemFixtures(manifest)];
}

export function displayName(submission: Pick<Submission, 'name' | 'package_name'>): string {
  return submission.name ?? submission.package_name;
}

export function formatBytes(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  return `${(bytes / 1024).toFixed(bytes < 10 * 1024 ? 1 : 0)} KB`;
}

export function formatDate(value: string | null): string {
  if (!value) return '—';
  return new Date(value).toLocaleString('id-ID', { dateStyle: 'medium', timeStyle: 'short' });
}

export function npmUrl(packageName: string, version?: string): string {
  return `https://www.npmjs.com/package/${packageName}${version ? `/v/${version}` : ''}`;
}

export function inboxUrl(submissionId: string): string {
  return `/inbox?submissionId=${encodeURIComponent(submissionId)}`;
}

export async function requestJson<T>(url: string, init?: RequestInit): Promise<T> {
  const response = await fetch(url, { ...init, cache: 'no-store' });
  let payload: unknown = null;
  try {
    payload = await response.json();
  } catch {
    // ditangani di bawah
  }
  if (!response.ok) {
    const message =
      payload && typeof payload === 'object' && 'message' in payload
        ? (payload as { message?: unknown }).message
        : null;
    throw new Error(
      typeof message === 'string'
        ? message
        : Array.isArray(message) && typeof message[0] === 'string'
          ? message[0]
          : 'Permintaan belum dapat diproses. Coba lagi.',
    );
  }
  return payload as T;
}

export function postJson<T>(url: string, body?: unknown): Promise<T> {
  return requestJson<T>(url, {
    method: 'POST',
    ...(body === undefined
      ? {}
      : { headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) }),
  });
}

export const submissionApi = (id: string, action?: string) =>
  `/api/platform/templates/submissions/${id}${action ? `/${action}` : ''}`;

/** Urutkan semver menurun (versi terbaru dulu); pre-release di bawah rilis final. */
export function compareVersionsDesc(a: string, b: string): number {
  const parse = (value: string) => {
    const [core, pre] = value.split('+')[0].split('-', 2);
    return { parts: core.split('.').map(Number), pre: pre ?? null };
  };
  const left = parse(a);
  const right = parse(b);
  for (let index = 0; index < 3; index += 1) {
    const diff = (right.parts[index] ?? 0) - (left.parts[index] ?? 0);
    if (diff !== 0) return diff;
  }
  if (left.pre === right.pre) return 0;
  if (left.pre === null) return -1;
  if (right.pre === null) return 1;
  return right.pre.localeCompare(left.pre, undefined, { numeric: true });
}
