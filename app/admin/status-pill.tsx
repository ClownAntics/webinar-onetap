import { STATUS_META } from "@/lib/status";
import type { WebinarStatus } from "@/lib/types";

export default function StatusPill({ status }: { status: WebinarStatus }) {
  const m = STATUS_META[status];
  return (
    <span
      style={{
        display: "inline-block",
        background: m.bg,
        color: m.fg,
        fontSize: 11,
        fontWeight: 800,
        letterSpacing: 0.5,
        padding: "4px 10px",
        borderRadius: 999,
        whiteSpace: "nowrap",
      }}
    >
      {m.label}
    </span>
  );
}
