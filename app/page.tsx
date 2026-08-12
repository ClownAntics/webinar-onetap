import Link from "next/link";

/**
 * Root index. In production the real entry points are /w/[webinarId] (from
 * Omnisend links) and /admin. This page is just a lightweight signpost.
 */
export default function Home() {
  return (
    <main
      style={{
        minHeight: "100vh",
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        justifyContent: "center",
        gap: 16,
        padding: 24,
        textAlign: "center",
      }}
    >
      <h1 style={{ fontWeight: 900, fontSize: 28 }}>FacePaint.com Webinars</h1>
      <p style={{ color: "var(--fp-text-65)", maxWidth: 440 }}>
        This is the one-tap registration service. Registration links are sent
        via Omnisend and open at <code>/w/&lt;webinarId&gt;</code>.
      </p>
      <Link
        href="/admin"
        style={{ color: "var(--fp-yellow)", fontWeight: 700 }}
      >
        Go to Admin →
      </Link>
      <div style={{ display: "flex", gap: 20, marginTop: 8, fontSize: 14 }}>
        <Link href="/help" style={{ color: "var(--fp-blue)" }}>User instructions</Link>
        <Link href="/developer" style={{ color: "var(--fp-blue)" }}>Developer instructions</Link>
      </div>
    </main>
  );
}
