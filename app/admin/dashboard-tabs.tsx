"use client";

import { useState } from "react";
import StatusPill from "./status-pill";
import { STATUS_META, isActionable } from "@/lib/status";
import type { WebinarStatus } from "@/lib/types";

export interface CardData {
  id: string;
  title: string;
  startTime: string | null;
  bannerUrl: string | null;
  status: WebinarStatus;
  registered: number | null;
  sources: { name: string; count: number }[];
  attended: number;
  isPast: boolean;
}

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
  const activeTab = tabs.find((t) => t.key === active)!;

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

      {activeTab.cards.length === 0 ? (
        <div style={{ color: "#999", fontSize: 14, padding: "8px 2px" }}>
          Nothing here right now.
        </div>
      ) : (
        <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
          {activeTab.cards.map((c) => (
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
      <div style={{ width: 92, height: 52, borderRadius: 8, flexShrink: 0, background: c.bannerUrl ? `center/cover url(${c.bannerUrl})` : "#e6e4df", display: "flex", alignItems: "center", justifyContent: "center", color: "#aaa", fontSize: 10 }}>
        {!c.bannerUrl && "no banner"}
      </div>
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
