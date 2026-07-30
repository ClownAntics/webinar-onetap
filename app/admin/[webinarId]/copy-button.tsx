"use client";

import { useState } from "react";

/**
 * Copy-to-clipboard button. `reveal` optionally shows the copied text below
 * (used for the Yumer link). Flips to "Copied!" for ~2.5s.
 */
export default function CopyButton({
  text,
  label,
  copiedLabel = "Copied!",
  reveal = false,
  bg = "#0C84A4",
  fg = "#fff",
}: {
  text: string;
  label: string;
  copiedLabel?: string;
  reveal?: boolean;
  bg?: string;
  fg?: string;
}) {
  const [copied, setCopied] = useState(false);

  async function copy() {
    try {
      await navigator.clipboard.writeText(text);
    } catch {
      /* clipboard blocked — ignore */
    }
    setCopied(true);
    setTimeout(() => setCopied(false), 2500);
  }

  return (
    <div>
      <button
        onClick={copy}
        style={{
          background: copied ? "#3c7d2b" : bg,
          color: fg,
          border: "none",
          borderRadius: 8,
          padding: "9px 14px",
          fontWeight: 700,
          fontSize: 13,
          cursor: "pointer",
        }}
      >
        {copied ? copiedLabel : label}
      </button>
      {reveal && copied && (
        <div
          style={{
            marginTop: 8,
            fontFamily: "ui-monospace, Menlo, monospace",
            fontSize: 11.5,
            color: "#0C84A4",
            wordBreak: "break-all",
          }}
        >
          {text}
        </div>
      )}
    </div>
  );
}
