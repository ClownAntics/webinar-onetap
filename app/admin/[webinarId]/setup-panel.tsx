"use client";

import { useState } from "react";
import CopyButton from "./copy-button";
import { BRANDS, BRAND_LABELS, type Brand } from "@/lib/brands";

const cardStyle: React.CSSProperties = {
  background: "#fff",
  borderRadius: 16,
  border: "1px solid #eee",
  padding: 20,
  display: "flex",
  flexDirection: "column",
  gap: 14,
};
const labelStyle: React.CSSProperties = { fontSize: 12.5, fontWeight: 700, color: "#555" };
const inputStyle: React.CSSProperties = {
  width: "100%",
  padding: "10px 12px",
  borderRadius: 10,
  border: "1.5px solid #ddd",
  fontSize: 14,
};
const helpStyle: React.CSSProperties = { fontSize: 11.5, color: "#999", marginTop: 5 };

const TEMPLATES: Record<string, (t: string) => string> = {
  "Product Demo": (t) => `What questions do you have about ${t}?`,
  Webinar: (t) => `What kind of ${t} do you want to see?`,
  Masterclass: (t) => `What specific topics would you like us to cover on ${t}?`,
  Custom: () => "",
};

// Where a plain (no-merge-tag) link gets posted. The value becomes ?src= and
// shows up as its own channel in the stats, so keep these short and stable.
const MERGE_SOURCES: { value: string; label: string }[] = [
  { value: "email", label: "Email" },
  { value: "sms", label: "SMS" },
  { value: "social", label: "Social media" },
];

const PLAIN_SOURCES: { value: string; label: string }[] = [
  { value: "website", label: "Website" },
  { value: "social", label: "Social media" },
];

export interface SetupInitial {
  webinarId: string;
  brand: Brand;
  /** `${siteUrl}/w/${webinarId}` — base for the plain link. */
  baseLink: string;
  display_title: string;
  question_text: string;
  agenda: string;
  banner_url: string;
  status: string;
  omnisendLink: string;
}

export default function SetupPanel(props: SetupInitial) {
  const [brand, setBrand] = useState<Brand>(props.brand);
  const [plainSource, setPlainSource] = useState("website");
  const [mergeSource, setMergeSource] = useState("email");
  const [displayTitle, setDisplayTitle] = useState(props.display_title);
  const [template, setTemplate] = useState("Custom");
  const [questionText, setQuestionText] = useState(props.question_text);
  const [agenda, setAgenda] = useState(props.agenda);
  const [bannerUrl, setBannerUrl] = useState(props.banner_url);
  const [saving, setSaving] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [msg, setMsg] = useState("");

  const readOnly = props.status === "COMPLETE";
  const firstTime = props.status === "NEEDS_SETUP";

  async function uploadBanner(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    setUploading(true);
    setMsg("");
    const fd = new FormData();
    fd.append("file", file);
    fd.append("webinarId", props.webinarId);
    const res = await fetch("/api/admin/webinar/banner", { method: "POST", body: fd });
    const data = await res.json().catch(() => ({}));
    setUploading(false);
    if (res.ok && data.url) setBannerUrl(data.url);
    else setMsg(data.error ?? "Banner upload failed");
  }

  async function save() {
    setSaving(true);
    setMsg("");
    const res = await fetch("/api/admin/webinar/save", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        webinarId: props.webinarId,
        brand,
        display_title: displayTitle,
        question_text: questionText,
        agenda,
        banner_url: bannerUrl,
      }),
    });
    const data = await res.json().catch(() => ({}));
    setSaving(false);
    if (res.ok) {
      window.location.reload();
    } else {
      setMsg(data.error ?? "Save failed");
    }
  }

  if (readOnly) {
    return (
      <div style={cardStyle}>
        <div style={{ fontWeight: 800, fontSize: 15 }}>Setup</div>
        <div style={{ background: "#F0EEE9", borderRadius: 10, padding: 12, fontSize: 13, color: "#666" }}>
          This webinar is COMPLETE — setup is locked. Post-webinar sends have fired.
        </div>
      </div>
    );
  }

  return (
    <div style={cardStyle}>
      <div style={{ fontWeight: 800, fontSize: 15 }}>Setup</div>

      <div>
        <div style={labelStyle}>Organization</div>
        <div style={{ display: "flex", gap: 8, marginTop: 4 }}>
          {BRANDS.map((b) => (
            <button
              key={b}
              type="button"
              onClick={() => setBrand(b)}
              style={{
                flex: 1,
                height: 38,
                borderRadius: 10,
                border: brand === b ? "2px solid #2f302f" : "1.5px solid #ddd",
                background: brand === b ? "#2f302f" : "#fff",
                color: brand === b ? "#fff" : "#555",
                fontSize: 12.5,
                fontWeight: 700,
                cursor: "pointer",
              }}
            >
              {BRAND_LABELS[b]}
            </button>
          ))}
        </div>
        <div style={helpStyle}>Sets the logo, colors, and mailing-list text on the landing page.</div>
      </div>

      <div>
        <div style={labelStyle}>Display title</div>
        <input style={inputStyle} value={displayTitle} onChange={(e) => setDisplayTitle(e.target.value)} />
      </div>

      <div>
        <div style={labelStyle}>Banner</div>
        {bannerUrl && (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={bannerUrl}
            alt="banner preview"
            style={{ width: "100%", borderRadius: 10, marginBottom: 8, border: "1px solid #eee" }}
          />
        )}
        <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
          <label style={{ ...smallBtn, display: "inline-flex", alignItems: "center", justifyContent: "center", cursor: "pointer", flex: "0 0 auto", padding: "0 14px" }}>
            {uploading ? "Uploading…" : bannerUrl ? "Replace banner" : "Upload banner"}
            <input type="file" accept="image/png,image/jpeg,image/webp,image/gif" onChange={uploadBanner} disabled={uploading} style={{ display: "none" }} />
          </label>
          {bannerUrl && (
            <button type="button" onClick={() => setBannerUrl("")} style={{ background: "none", border: "none", color: "#B41F24", fontSize: 12.5, cursor: "pointer" }}>
              Remove
            </button>
          )}
        </div>
        <div style={helpStyle}>PNG/JPG/WEBP, up to 8 MB. Recommended ~1280×400.</div>
      </div>

      <div>
        <div style={labelStyle}>Registration question</div>
        <select
          style={{ ...inputStyle, marginBottom: 8 }}
          value={template}
          onChange={(e) => {
            const t = e.target.value;
            setTemplate(t);
            const fill = TEMPLATES[t]?.(displayTitle || "this topic");
            if (t !== "Custom" && fill) setQuestionText(fill);
          }}
        >
          {Object.keys(TEMPLATES).map((t) => (
            <option key={t}>{t}</option>
          ))}
        </select>
        <textarea style={{ ...inputStyle, minHeight: 60 }} value={questionText} onChange={(e) => setQuestionText(e.target.value)} />
      </div>

      <div>
        <div style={labelStyle}>Agenda / description</div>
        <textarea style={{ ...inputStyle, minHeight: 150, resize: "vertical" }} value={agenda} onChange={(e) => setAgenda(e.target.value)} />
        <div style={helpStyle}>Shown on the landing page. Auto-filled from the Zoom description.</div>
      </div>

      {msg && <div style={{ color: "#B41F24", fontSize: 13 }}>{msg}</div>}

      <button
        onClick={save}
        disabled={saving}
        style={{
          height: 50,
          borderRadius: 12,
          border: "none",
          background: "#FCD700",
          color: "#2f302f",
          fontWeight: 900,
          fontSize: 15,
          cursor: "pointer",
          boxShadow: "0 4px 0 #b89b00",
        }}
      >
        {saving ? "Saving…" : firstTime ? "Save — go live" : "Save changes"}
      </button>

      <a
        href={`/w/${props.webinarId}?fn=Preview&e=preview@facepaint.com&preview=1`}
        target="_blank"
        rel="noreferrer"
        style={{
          height: 46,
          borderRadius: 12,
          border: "1.5px solid #2f302f",
          background: "#fff",
          color: "#2f302f",
          fontWeight: 800,
          fontSize: 14,
          cursor: "pointer",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          textDecoration: "none",
        }}
      >
        👁 Preview landing page ↗
      </a>
      <div style={helpStyle}>Opens the one-tap page as customers will see it. Save first to preview your latest changes.</div>

      {!firstTime && (
        <>
          <div style={{ borderTop: "1px solid #eee", paddingTop: 14 }}>
            <div style={labelStyle}>Link for Yumer — email / SMS (fills in name + email)</div>
            <select
              style={{ ...inputStyle, marginTop: 4, marginBottom: 8 }}
              value={mergeSource}
              onChange={(e) => setMergeSource(e.target.value)}
            >
              {MERGE_SOURCES.map((s) => (
                <option key={s.value} value={s.value}>
                  {s.label}
                </option>
              ))}
            </select>
            <CopyButton
              text={`${props.omnisendLink}&src=${mergeSource}`}
              label="Copy link for Yumer"
              reveal
              bg="#0C84A4"
            />
            <div style={helpStyle}>
              Pick the channel before copying — it tags the registrations so email and SMS
              can be compared.
            </div>
          </div>

          <div style={{ borderTop: "1px solid #eee", paddingTop: 14 }}>
            <div style={labelStyle}>Link for the website / social (no name or email)</div>
            <select
              style={{ ...inputStyle, marginTop: 4, marginBottom: 8 }}
              value={plainSource}
              onChange={(e) => setPlainSource(e.target.value)}
            >
              {PLAIN_SOURCES.map((s) => (
                <option key={s.value} value={s.value}>
                  {s.label}
                </option>
              ))}
            </select>
            <CopyButton
              text={`${props.baseLink}?src=${plainSource}`}
              label="Copy link for Aubrey"
              reveal
              bg="#54AF3E"
            />
            <div style={helpStyle}>
              Anyone can use this — visitors type their name and email on the page. Pick where
              you&apos;re posting it so registrations show up under that channel in the stats.
            </div>
          </div>
        </>
      )}
    </div>
  );
}

const smallBtn: React.CSSProperties = {
  flex: 1,
  height: 36,
  borderRadius: 8,
  border: "1.5px solid #ccc",
  background: "#fff",
  fontSize: 12.5,
  fontWeight: 700,
  cursor: "pointer",
};
