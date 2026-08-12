import Link from "next/link";

export const metadata = { title: "How to use — FacePaint Webinars" };

const card: React.CSSProperties = {
  background: "#fff",
  border: "1px solid #eee",
  borderRadius: 16,
  padding: 24,
  marginBottom: 16,
};
const h2: React.CSSProperties = { fontSize: 17, fontWeight: 800, marginTop: 0 };
const li: React.CSSProperties = { marginBottom: 6, lineHeight: 1.5 };

export default function HelpPage() {
  return (
    <main style={{ minHeight: "100vh", background: "#f5f4f0", color: "#2f302f" }}>
      <header style={{ background: "#2f302f", color: "#fff", padding: "14px 20px", display: "flex", justifyContent: "space-between", alignItems: "center" }}>
        <span style={{ fontWeight: 800 }}>How to use</span>
        <Link href="/admin" style={{ color: "#FCD700", fontWeight: 700 }}>Go to Admin →</Link>
      </header>

      <div style={{ maxWidth: 760, margin: "0 auto", padding: 24 }}>
        <p style={{ color: "#666" }}>
          This app turns a Zoom webinar into a <b>one-tap registration link</b>. People tap a
          personalized link (their name &amp; email are already in it) and they&apos;re registered on
          Zoom instantly — no form to fill out.
        </p>

        <section style={card}>
          <h2 style={h2}>Setting up a webinar</h2>
          <ol>
            <li style={li}><b>Create the webinar in Zoom</b> as usual — with <b>Registration → Required</b>, and the custom question set to <b>not required</b> (so one-tap works without forcing an answer).</li>
            <li style={li}>Open the <Link href="/admin">Admin</Link> and click the webinar (it shows <b>NEEDS SETUP</b>).</li>
            <li style={li}><b>Title, agenda, and the registration question auto-fill from Zoom</b> — tweak if you like.</li>
            <li style={li}><b>Upload the banner</b> (the designed image for this webinar).</li>
            <li style={li}>Click <b>Save — go live</b>.</li>
            <li style={li}>Click <b>Copy link for Yumer</b> and paste that link into your Omnisend invite campaign. Done.</li>
          </ol>
          <p style={{ margin: "8px 0 0", color: "#666", fontSize: 13 }}>
            Note: &quot;NEEDS SETUP&quot; means &quot;not set up <i>in this app</i> yet&quot; — the webinar already
            exists in Zoom; this step just builds the one-tap landing page + invite link.
          </p>
        </section>

        <section style={card}>
          <h2 style={h2}>What each field is for</h2>
          <ul>
            <li style={li}><b>Display title</b> — the headline people see on the landing page.</li>
            <li style={li}><b>Banner</b> — the designed image at the top of the landing page (upload it).</li>
            <li style={li}><b>Registration question</b> — the optional question under the button; answers collect in the &quot;What customers want to see&quot; panel.</li>
            <li style={li}><b>Agenda / description</b> — shown on the landing page; auto-filled from the Zoom description.</li>
          </ul>
        </section>

        <section style={card}>
          <h2 style={h2}>Stats</h2>
          <p style={{ margin: 0 }}>
            Registration counts and the <b>by-source breakdown</b> (Social / Website / Email / SMS) come
            straight from <b>Zoom&apos;s tracking sources</b> — the real numbers, not just people who
            registered through this app. <b>Attendance</b> and the <b>Trends / revenue</b> view populate
            after the webinar (once attendance syncs).
          </p>
        </section>

        <section style={card}>
          <h2 style={h2}>Status badges</h2>
          <ul>
            <li style={li}><b>NEEDS SETUP</b> — not set up in the app yet.</li>
            <li style={li}><b>AWAITING ANSWERS</b> — live, invites out, answers accumulating.</li>
            <li style={li}><b>READY</b> — set up and live.</li>
            <li style={li}><b>COMPLETE</b> — a past webinar you&apos;ve wrapped up.</li>
          </ul>
        </section>

        <p style={{ fontSize: 13, color: "#888" }}>
          Technical details? See <Link href="/developer">Developer guide</Link>.
        </p>
      </div>
    </main>
  );
}
