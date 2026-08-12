"use client";

import { useState } from "react";
import StatusPill from "./status-pill";
import { STATUS_META, isActionable } from "@/lib/status";
import { BRAND_LABELS, type Brand } from "@/lib/brands";
import type { WebinarStatus } from "@/lib/types";

export interface CardData {
  id: string;
  title: string;
  startTime: string | null;
  bannerUrl: string | null;
  status: WebinarStatus;
  brand: Brand;
  isMasterclass: boolean;
  registered: number | null;
  sources: { name: string; count: number }[];
  attended: number;
  isPast: boolean;
  /** 7-day attributed revenue from the webinar_summary cache (null = not computed). */
  revenue7d: number | null;
}

// Past-tab filter: each org separate, FacePaint split into free webinars vs
// paid masterclasses (mirrors the Trends tabs).
const PAST_FILTERS: { key: string; label: string; match: (c: CardData) => boolean }[] = [
  { key: "all", label: "All", match: () => true },
  { key: "facepaint", label: BRAND_LABELS.facepaint, match: (c) => c.brand === "facepaint" && !c.isMasterclass },
  { key: "masterclass", label: "Masterclasses", match: (c) => c.isMasterclass },
  { key: "clownantics", label: BRAND_LABELS.clownantics, match: (c) => c.brand === "clownantics" && !c.isMasterclass },
  { key: "careerlearning", label: BRAND_LABELS.careerlearning, match: (c) => c.brand === "careerlearning" && !c.isMasterclass },
];

type TabKey = "attention" | "upcoming" | "past";

export default function DashboardTabs({
  attention,
  upcoming,
  past,
}: {
  attention: CardData[];
  upcoming: CardData[];
  past: CardData[];
}) {
  const tabs: { key: TabKey; label: string; cards: CardData[]; color: string }[] = [
    { key: "attention", label: "Needs your attention", cards: attention, color: "#8a6d00" },
    { key: "upcoming", label: "Upcoming", cards: upcoming, color: "#2f302f" },
    { key: "past", label: "Past", cards: past, color: "#2f302f" },
  ];
  const firstNonEmpty = tabs.find((t) => t.cards.length > 0)?.key ?? "attention";
  const [active, setActive] = useState<TabKey>(firstNonEmpty);
  const [pastFilter, setPastFilter] = useState("all");
  const activeTab = tabs.find((t) => t.key === active)!;
  const filter = PAST_FILTERS.find((f) => f.key === pastFilter) ?? PAST_FILTERS[0];
  const visibleCards =
    activeTab.key === "past" ? activeTab.cards.filter(filter.match) : activeTab.cards;

  return (
    <div style={{ marginTop: 20 }}>
      {/* tab bar */}
      <div style={{ display: "flex", gap: 4, borderBottom: "1px solid #e6e4df", marginBottom: 16, flexWrap: "wrap" }}>
        {tabs.map((t) => {
          const on = t.key === active;
          return (
            <button
              key={t.key}
              onClick={() => setActive(t.key)}
              style={{
                background: "none",
                border: "none",
                borderBottom: on ? "3px solid #FCD700" : "3px solid transparent",
                padding: "8px 14px",
                marginBottom: -1,
                fontSize: 13.5,
                fontWeight: 800,
                color: on ? "#2f302f" : "#8a8a8a",
                cursor: "pointer",
              }}
            >
              {t.label}
              <span style={{ marginLeft: 6, color: on ? t.color : "#bbb", fontWeight: 700 }}>
                {t.cards.length}
              </span>
            </button>
          );
        })}
      </div>

      {activeTab.key === "past" && (
        <div style={{ display: "flex", gap: 6, flexWrap: "wrap", marginBottom: 14 }}>
          {PAST_FILTERS.map((f) => {
            const on = f.key === pastFilter;
            const n = activeTab.cards.filter(f.match).length;
            return (
              <button
                key={f.key}
                onClick={() => setPastFilter(f.key)}
                style={{
                  background: on ? "#2f302f" : "#fff",
                  color: on ? "#fff" : "#555",
                  border: on ? "1.5px solid #2f302f" : "1.5px solid #ddd",
                  borderRadius: 999,
                  padding: "5px 12px",
                  fontSize: 12,
                  fontWeight: 700,
                  cursor: "pointer",
                }}
              >
                {f.label} <span style={{ opacity: 0.6 }}>{n}</span>
              </button>
            );
          })}
        </div>
      )}

      {visibleCards.length === 0 ? (
        <div style={{ color: "#999", fontSize: 14, padding: "8px 2px" }}>
          Nothing here right now.
        </div>
      ) : (
        <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
          {visibleCards.map((c) => (
            <Card key={c.id} c={c} />
          ))}
        </div>
      )}
    </div>
  );
}

const chip: React.CSSProperties = { background: "#F0EEE9", borderRadius: 999, padding: "3px 9px", color: "#555" };

function Card({ c }: { c: CardData }) {
  const meta = STATUS_META[c.status];
  const showRate = c.registered && c.registered > 0 ? Math.round((c.attended / c.registered) * 100) : 0;
  const needsAttention = isActionable(c.status, c.isPast);
  return (
    <a href={`/admin/${c.id}`} style={{ display: "flex", gap: 14, background: "#fff", borderRadius: 16, border: "1px solid #eee", padding: 14, textDecoration: "none", color: "inherit" }}>
      {/* Banner thumb on upcoming/attention cards only — past cards don't need it. */}
      {!c.isPast && (
        <div style={{ width: 92, height: 52, borderRadius: 8, flexShrink: 0, background: c.bannerUrl ? `center/cover url(${c.bannerUrl})` : "#e6e4df", display: "flex", alignItems: "center", justifyContent: "center", color: "#aaa", fontSize: 10 }}>
          {!c.bannerUrl && "no banner"}
        </div>
      )}
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap" }}>
          <span style={{ fontWeight: 800, fontSize: 15, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap", maxWidth: "100%" }}>{c.title}</span>
          <StatusPill status={c.status} />
        </div>
        <div style={{ color: "#888", fontSize: 12.5, marginTop: 2 }}>
          {c.startTime ? new Date(c.startTime).toLocaleDateString("en-US", { weekday: "short", month: "short", day: "numeric", timeZone: "America/New_York" }) : "date TBD"}
        </div>
        <div style={{ display: "flex", gap: 6, flexWrap: "wrap", marginTop: 8, fontSize: 11.5 }}>
          {c.registered != null && <span style={chip}>👥 <b>{c.registered}</b> registered</span>}
          {c.sources.map((s) => (
            <span key={s.name} style={chip}>{s.name} {s.count}</span>
          ))}
          {c.isPast && c.attended > 0 && (
            <span style={{ ...chip, background: "#E8F5E1", color: "#3c7d2b" }}>✅ {c.attended}{c.registered ? ` (${showRate}%)` : ""}</span>
          )}
          {c.isPast && c.revenue7d != null && (
            <span style={{ ...chip, background: "#FDF0D5", color: "#8a5a00", fontWeight: 700 }}>
              💰 ${c.revenue7d.toLocaleString("en-US", { maximumFractionDigits: 0 })} (7d)
            </span>
          )}
        </div>
        {needsAttention && (
          <div style={{ marginTop: 8, background: "#FFF6D6", color: "#8a6d00", borderRadius: 8, padding: "5px 10px", fontSize: 12 }}>
            → {meta.hint}
          </div>
        )}
      </div>
    </a>
  );
}
