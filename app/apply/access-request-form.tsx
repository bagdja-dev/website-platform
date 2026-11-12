"use client";

import Link from "next/link";
import { FormEvent, useEffect, useState } from "react";

type SubmissionStatus =
  "checking" | "idle" | "submitting" | "success" | "error";

type AccessRequestResponse = {
  id?: string;
  email?: string;
  status?:
    "pending" | "curating" | "invited" | "discussion" | "approved" | "rejected";
  decisionNote?: string | null;
  updatedAt?: string;
} | null;

const applicationStages = [
  {
    id: "pending",
    title: "Permohonan dikirim",
    description: "Profil dan informasi yang kamu kirim sudah kami terima.",
  },
  {
    id: "curating",
    title: "Kurasi profil dan portofolio",
    description:
      "Tim meninjau karya, pengalaman, dan kecocokan dengan kebutuhan ekosistem template Bagdja.",
  },
  {
    id: "invited",
    title: "Undangan sesi perkenalan",
    description:
      "Jika profilmu sesuai, kami akan menghubungimu melalui email akun Bagdja untuk menjadwalkan percakapan.",
  },
  {
    id: "discussion",
    title: "Diskusi mendalam",
    description:
      "Kita membahas keputusan desain, alur kerja, cara menerima masukan, dan bentuk kolaborasi yang kamu harapkan.",
  },
  {
    id: "approved",
    title: "Disetujui dan undangan akses dikirim",
    description:
      "Undangan akses designer disiapkan untuk email akun Bagdja. Buka tautannya untuk mengaktifkan akses Website Platform.",
  },
] as const;

export function AccessRequestForm() {
  const [status, setStatus] = useState<SubmissionStatus>("checking");
  const [message, setMessage] = useState("");
  const [submittedEmail, setSubmittedEmail] = useState("");
  const [submittedStatus, setSubmittedStatus] =
    useState<NonNullable<AccessRequestResponse>["status"]>("pending");
  const [decisionNote, setDecisionNote] = useState("");
  const [emailNotice, setEmailNotice] = useState("");

  useEffect(() => {
    let active = true;

    async function loadPendingRequest() {
      try {
        const response = await fetch("/api/platform/access-requests/mine", {
          cache: "no-store",
        });
        if (!response.ok) {
          throw new Error("Status permohonan belum dapat diperiksa.");
        }

        const request: AccessRequestResponse = await response.json();
        if (!active) return;

        if (request?.status === "pending") {
          setSubmittedEmail(request.email ?? "");
          setStatus("success");
          return;
        }
        if (request?.status) {
          setSubmittedEmail(request.email ?? "");
          setSubmittedStatus(request.status);
          setDecisionNote(request.decisionNote ?? "");
          setStatus("success");
          return;
        }

        setStatus("idle");
      } catch (error) {
        if (!active) return;
        console.error("Unable to check designer access request:", error);
        setMessage(
          "Status permohonan belum dapat diperiksa. Coba muat ulang halaman.",
        );
        setStatus("error");
      }
    }

    void loadPendingRequest();
    return () => {
      active = false;
    };
  }, []);

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = event.currentTarget;
    setStatus("submitting");
    setMessage("");
    const formData = new FormData(event.currentTarget);
    const payload = {
      name: formData.get("name"),
      portfolioUrl: formData.get("portfolioUrl") || undefined,
      message: formData.get("message") || undefined,
    };

    try {
      const response = await fetch("/api/platform/access-requests", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      const result = await response.json();
      if (!response.ok) {
        if (response.status === 409) {
          const pendingResponse = await fetch(
            "/api/platform/access-requests/mine",
            { cache: "no-store" },
          );
          if (pendingResponse.ok) {
            const pending: AccessRequestResponse = await pendingResponse.json();
            if (pending?.status) {
              setSubmittedEmail(pending.email ?? "");
              setSubmittedStatus(pending.status);
              setDecisionNote(pending.decisionNote ?? "");
              setStatus("success");
              return;
            }
          }
        }
        throw new Error(
          typeof result.message === "string"
            ? result.message
            : "Permohonan belum dapat dikirim.",
        );
      }
      form.reset();
      setSubmittedEmail(typeof result.email === "string" ? result.email : "");
      setEmailNotice(
        result.emailSent === false
          ? "Permohonan tercatat, tetapi email konfirmasi belum berhasil dikirim."
          : "",
      );
      if (
        result.status === "pending" ||
        result.status === "curating" ||
        result.status === "invited" ||
        result.status === "discussion" ||
        result.status === "approved" ||
        result.status === "rejected"
      ) {
        setSubmittedStatus(result.status);
      }
      setDecisionNote(result.decisionNote ?? "");
      setStatus("success");
    } catch (error) {
      setStatus("error");
      setMessage(
        error instanceof Error
          ? error.message
          : "Permohonan belum dapat dikirim.",
      );
    }
  }

  if (status === "checking") {
    return (
      <p className="form-message" role="status">
        Memeriksa status permohonan…
      </p>
    );
  }

  if (status === "success") {
    if (submittedStatus === "rejected") {
      return (
        <section
          className="application-success"
          role="status"
          aria-labelledby="application-success-title"
        >
          <div
            className="application-success-icon is-rejected"
            aria-hidden="true"
          >
            ×
          </div>
          <p className="application-eyebrow">Keputusan permohonan</p>
          <h2 id="application-success-title">
            Permohonanmu belum dapat disetujui.
          </h2>
          <p className="application-success-copy">
            {decisionNote ||
              "Terima kasih sudah mengajukan akses designer. Kamu dapat mengirim permohonan baru setelah meninjau kembali portofolio atau informasi yang disampaikan."}
          </p>
          {emailNotice ? (
            <p className="form-message error" role="alert">
              {emailNotice}
            </p>
          ) : null}
          <button
            className="primary-link"
            onClick={() => {
              setMessage("");
              setStatus("idle");
            }}
            type="button"
          >
            Ajukan kembali
          </button>
          <Link className="secondary-link application-home-link" href="/">
            Kembali ke portal
          </Link>
        </section>
      );
    }

    return (
      <section
        className="application-success"
        role="status"
        aria-labelledby="application-success-title"
      >
        <div className="application-success-icon" aria-hidden="true">
          ✓
        </div>
        <p className="application-eyebrow">
          {submittedStatus === "approved"
            ? "Permohonan disetujui"
            : "Pengajuan terkirim"}
        </p>
        <h2 id="application-success-title">
          {submittedStatus === "approved"
            ? "Selamat, permohonanmu disetujui."
            : submittedStatus === "pending"
              ? "Terima kasih, permohonanmu sudah kami terima."
              : "Permohonanmu sedang diproses oleh tim Bagdja."}
        </h2>
        <p className="application-success-copy">
          {submittedEmail
            ? `Pengajuan ini tercatat atas akun Bagdja ${submittedEmail}.`
            : "Pengajuan ini sudah tercatat pada akun Bagdja yang kamu gunakan."}{" "}
          {submittedStatus === "approved"
            ? "Tim Bagdja telah menyetujui permohonan akses designermu."
            : "Kami ingin mengenal proses dan cara berpikirmu sebagai designer, jadi tahap berikutnya berfokus pada percakapan, bukan sekadar pemeriksaan portofolio."}
        </p>
        {submittedStatus === "approved" ? (
          <p className="application-follow-up">
            Undangan akses designer disiapkan untuk email tersebut. Periksa
            inbox dan folder spam. Jika belum menerima tautan undangan, hubungi
            tim Bagdja.
          </p>
        ) : null}

        <ol className="application-steps">
          {applicationStages.map((stage, index) => {
            const currentIndex = applicationStages.findIndex(
              (item) => item.id === submittedStatus,
            );
            const complete = index < currentIndex;
            const current = index === currentIndex;
            return (
              <li
                className={`application-step${complete ? " is-complete" : ""}${current ? " is-next" : ""}`}
                key={stage.id}
              >
                <span className="application-step-marker" aria-hidden="true">
                  {complete ? "✓" : index + 1}
                </span>
                <div>
                  {complete ? (
                    <span className="application-step-state">Selesai</span>
                  ) : current ? (
                    <span className="application-step-state">
                      Tahap saat ini
                    </span>
                  ) : null}
                  <h3>{stage.title}</h3>
                  <p>{stage.description}</p>
                </div>
              </li>
            );
          })}
        </ol>

        {submittedStatus !== "approved" ? (
          <p className="application-follow-up">
            Urutan dan waktu proses dapat menyesuaikan kebutuhan tim. Pantau
            email yang terhubung ke akun Bagdja untuk kabar dari kami.
          </p>
        ) : null}
        <Link className="secondary-link application-home-link" href="/">
          Kembali ke portal
        </Link>
      </section>
    );
  }

  return (
    <>
      <h1>Ajukan akses designer</h1>
      <p>
        Ceritakan sedikit tentang dirimu dan portofolio template. Pengajuan akan
        dikaitkan dengan email akun Bagdja yang sedang login, ditinjau manual,
        dan tidak langsung memberikan akses.
      </p>
      <form className="platform-form" onSubmit={submit}>
        <label>
          Nama
          <input name="name" autoComplete="name" maxLength={120} required />
        </label>
        <label>
          Portofolio atau package template
          <input
            name="portfolioUrl"
            type="url"
            maxLength={2048}
            placeholder="https://..."
          />
        </label>
        <label>
          Motivasi, pengalaman, dan keahlian
          <textarea
            name="message"
            placeholder="Ceritakan karya yang paling menggambarkan dirimu, pengalaman membuat template, dan hal yang ingin kamu kontribusikan."
            rows={5}
            maxLength={4000}
          />
        </label>
        <button className="primary-link" disabled={status === "submitting"}>
          {status === "submitting" ? "Mengirim…" : "Kirim permohonan"}
        </button>
        {message ? (
          <p className="form-message error" role="alert">
            {message}
          </p>
        ) : null}
      </form>
    </>
  );
}
