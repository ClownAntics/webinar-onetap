export default function Loading() {
  return (
    <main style={{ minHeight: "100vh", background: "#f5f4f0", color: "#2f302f" }}>
      <header style={{ background: "#2f302f", color: "#fff", padding: "14px 20px", fontWeight: 800 }}>
        Webinar Trends
      </header>
      <div style={{ maxWidth: 1000, margin: "0 auto", padding: 24, display: "flex", alignItems: "center", gap: 12, color: "#888", fontSize: 14 }}>
        <span
          style={{
            width: 18,
            height: 18,
            border: "3px solid #ddd",
            borderTopColor: "#2f302f",
            borderRadius: "50%",
            display: "inline-block",
            animation: "fp-spin 0.7s linear infinite",
          }}
        />
        Computing full-history metrics — about 10 seconds…
      </div>
    </main>
  );
}
