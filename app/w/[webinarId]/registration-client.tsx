"use client";

import { useState } from "react";
import Image from "next/image";
import styles from "./registration.module.css";
import { getBrand, type BrandTheme } from "@/lib/brands";
import type { RegisterResult, WebinarConfig } from "@/lib/types";

const CONFETTI = [
  { top: 74, left: "5%", size: 10, color: "var(--fp-confetti-pink)" },
  { top: 44, right: "9%", size: 8, color: "var(--fp-confetti-green)" },
  { top: 112, right: "4%", size: 12, color: "var(--fp-confetti-yellow)" },
  { top: 150, left: "11%", size: 7, color: "var(--fp-confetti-blue)" },
  { top: 210, left: "6%", size: 9, color: "var(--fp-confetti-orange)" },
];

type Phase = "form" | "loading" | "success" | "error";

function maskEmail(email: string): string {
  const [user, domain] = email.split("@");
  if (!domain) return email;
  return `${user[0]}•••@${domain}`;
}

function formatDate(iso?: string | null): string {
  if (!iso) return "";
  const d = new Date(iso);
  return d
    .toLocaleString("en-US", {
      weekday: "short",
      month: "short",
      day: "numeric",
      hour: "numeric",
      minute: "2-digit",
      timeZone: "America/New_York",
    })
    .toUpperCase()
    .replace(",", "") + " ET";
}

export default function RegistrationClient(props: {
  webinarId: string;
  email: string;
  firstName: string;
  lastName: string;
  source: "sms" | "email" | "social";
  config: WebinarConfig | null;
  registrationUrl?: string;
  preview?: boolean;
  /** ?brand= override, honored only in preview mode (theme check before saving). */
  previewBrand?: string;
}) {
  const { webinarId, config } = props;
  const [email, setEmail] = useState(props.email);
  const [firstName, setFirstName] = useState(props.firstName);
  const [lastName] = useState(props.lastName);
  const [answer, setAnswer] = useState("");
  const [phase, setPhase] = useState<Phase>("form");
  const [result, setResult] = useState<RegisterResult | null>(null);

  const brand = getBrand(props.preview && props.previewBrand ? props.previewBrand : config?.brand);
  const title = config?.display_title ?? config?.zoom_topic ?? `${brand.name} Webinar`;
  const dateLabel = formatDate(config?.start_time);
  const missingEmail = !props.email;

  async function register() {
    if (!email) return;
    // Preview mode (admin "Preview" button): show the success screen without
    // actually registering anyone.
    if (props.preview) {
      setResult({ status: "success", title, startTime: config?.start_time ?? undefined });
      setPhase("success");
      return;
    }
    setPhase("loading");
    try {
      const res = await fetch("/api/register", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          webinarId,
          email,
          firstName,
          lastName,
          source: props.source,
          answer,
        }),
      });
      const data = (await res.json()) as RegisterResult;
      if (!res.ok || data.status === "error") {
        setResult(data);
        setPhase("error");
        return;
      }
      setResult(data);
      setPhase("success");
    } catch {
      setResult({ status: "error", message: "network" });
      setPhase("error");
    }
  }

  return (
    <div className={styles.stage} style={brand.vars as React.CSSProperties}>
      {props.preview && (
        <div style={{ position: "fixed", top: 0, left: 0, right: 0, background: "#FCD700", color: "#2f302f", textAlign: "center", fontSize: 12, fontWeight: 800, letterSpacing: 1, padding: "5px", zIndex: 50 }}>
          PREVIEW — no one is registered
        </div>
      )}
      {brand.confetti && CONFETTI.map((c, i) => (
        <span
          key={i}
          className={styles.confetti}
          style={{
            top: c.top,
            left: c.left,
            right: c.right,
            width: c.size,
            height: c.size,
            background: c.color,
          }}
        />
      ))}

      <div className={styles.column}>
        <BrandLogo brand={brand} />
        {dateLabel && <div className={styles.date}>{dateLabel}</div>}
        <h1 className={styles.title}>{title}</h1>
        {config?.banner_url && (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={config.banner_url} alt="" className={styles.banner} />
        )}

        {phase === "form" && (
          <>
            {missingEmail ? (
              <>
                <p className={styles.greeting}>Grab your seat — just your name and email.</p>
                <input
                  className={styles.input}
                  placeholder="First name"
                  value={firstName}
                  onChange={(e) => setFirstName(e.target.value)}
                />
                <input
                  className={styles.input}
                  placeholder="Email"
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                />
              </>
            ) : (
              <p className={styles.greeting}>
                Hi {firstName || "there"}! One tap and you&apos;re in.
              </p>
            )}

            <button className={styles.cta} onClick={register} disabled={!email}>
              SAVE MY SEAT
            </button>

            <textarea
              className={styles.textarea}
              rows={2}
              placeholder={`${config?.question_text ?? "What would you like to see?"} (optional)`}
              value={answer}
              onChange={(e) => setAnswer(e.target.value)}
            />

            {config?.agenda && <p className={styles.agenda}>{config.agenda}</p>}

            {!missingEmail && (
              <div className={styles.footer}>
                Registering as {maskEmail(email)}
              </div>
            )}
            <p className={styles.disclosure}>{brand.disclosure}</p>
          </>
        )}

        {phase === "loading" && (
          <>
            <div className={styles.spinner} />
            <p className={styles.greeting}>Saving your seat…</p>
          </>
        )}

        {phase === "success" && (
          <>
            <div className={styles.check}>✓</div>
            <h2 className={styles.title} style={{ fontSize: 27 }}>
              You&apos;re in, {firstName || "friend"}! 🎉
            </h2>
            {dateLabel && <div className={styles.date}>{dateLabel}</div>}
            <CalendarButtons title={title} startTime={config?.start_time} joinUrl={result?.joinUrl} />
            <p className={styles.footer}>
              Your confirmation with the join link is on its way to {maskEmail(email)}
            </p>
          </>
        )}

        {phase === "error" && (
          <ErrorState registrationUrl={props.registrationUrl} />
        )}
      </div>
    </div>
  );
}

function BrandLogo({ brand }: { brand: BrandTheme }) {
  if (brand.logoSrc) {
    return <Image src={brand.logoSrc} alt={brand.name} width={76} height={76} className={styles.logo} priority />;
  }
  // No logo file yet — brand-colored monogram keeps the page looking finished.
  const initials = brand.name.replace(/\.com$/i, "").replace(/[a-z]/g, "").slice(0, 2) || brand.name[0];
  return (
    <div className={styles.logo} style={{ background: "var(--fp-yellow)", color: "var(--fp-cta-text)", display: "flex", alignItems: "center", justifyContent: "center", fontWeight: 900, fontSize: 26 }}>
      {initials}
    </div>
  );
}

function CalendarButtons(props: { title: string; startTime?: string | null; joinUrl?: string }) {
  const start = props.startTime ? new Date(props.startTime) : null;
  const end = start ? new Date(start.getTime() + 60 * 60 * 1000) : null;
  const gcalParams =
    start && end
      ? new URLSearchParams({
          action: "TEMPLATE",
          text: props.title,
          dates: `${fmt(start)}/${fmt(end)}`,
          details: `Join link: ${props.joinUrl ?? ""}`,
        }).toString()
      : "";
  const icsHref =
    start && end
      ? `/api/ics/reg?title=${encodeURIComponent(props.title)}&start=${start.toISOString()}&end=${end.toISOString()}&join=${encodeURIComponent(props.joinUrl ?? "")}`
      : "#";

  return (
    <>
      {gcalParams && (
        <a className={styles.calBtn} href={`https://calendar.google.com/calendar/render?${gcalParams}`} target="_blank" rel="noreferrer">
          Add to Google Calendar
        </a>
      )}
      <a className={styles.secondaryBtn} href={icsHref}>
        Add to Apple / Outlook (.ics)
      </a>
    </>
  );
}

function ErrorState(props: { registrationUrl?: string }) {
  // Never a dead end — auto-redirect to Zoom native registration if we have it.
  if (typeof window !== "undefined" && props.registrationUrl) {
    setTimeout(() => (window.location.href = props.registrationUrl!), 3000);
  }
  return (
    <>
      <div className={styles.bang}>!</div>
      <h2 className={styles.title} style={{ fontSize: 20 }}>
        Hmm, that didn&apos;t save.
      </h2>
      <p className={styles.greeting}>
        No worries — we&apos;re sending you to the standard registration page instead.
      </p>
      {props.registrationUrl && (
        <a className={styles.continueBtn} href={props.registrationUrl}>
          Continue to Zoom registration
        </a>
      )}
    </>
  );
}

function fmt(d: Date): string {
  return d.toISOString().replace(/[-:]/g, "").replace(/\.\d{3}/, "");
}
