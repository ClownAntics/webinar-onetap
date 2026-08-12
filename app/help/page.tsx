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
          This app turns a Zoom webinar into a one-tap registration link. People tap a personalized
          link (their info is already in it) and they&apos;re registered — no form to fill out.
        </p>

        <section style={card}>
          <h2 style={h2}>Setting up a webinar (the routine)</h2>
          <ol>
            <li style={li}><b>Create the webinar in Zoom</b> as usual, with <b>Registration → Required</b> and the custom question set to <b>not required</b>.</li>
            <li style={li}>Open the <Link href="/admin">Admin</Link>, click the webinar (it shows <b>NEEDS SETUP</b>).</li>
            <li style={li}><b>Title, agenda, and question auto-fill from Zoom</b> — tweak if you like.</li>
            <li style={li}><b>Upload the banner</b> (the designed image for this webinar).</li>
            <li style={li}>Add the <b>discount code</b> + its <b>expiry date</b> (from Shopify) when you have it.</li>
            <li style={li}>Click <b>Save — go live</b>.</li>
            <li style={li}>Click <b>Copy link for Yumer</b> and paste that link into your Omnisend invite campaign. Done.</li>
          </ol>
        </section>

        <section style={card}>
          <h2 style={h2}>What each field is for</h2>
          <ul>
            <li style={li}><b>Display title</b> — the headline people see on the landing page.</li>
            <li style={li}><b>Banner</b> — the designed image at the top of the landing page.</li>
            <li style={li}><b>Registration question</b> — the optional question shown under the button; answers collect in the &quot;What customers want to see&quot; panel.</li>
            <li style={li}><b>Agenda / tease copy</b> — feeds the T-3-day tease email. Leave blank to skip.</li>
            <li style={li}><b>Discount code + expiry</b> — the Shopify code sent to attendees &amp; no-shows <i>after</i> the webinar. Enter whenever you have it (before or after the event).</li>
            <li style={li}><b>Replay URL</b> — <i>after</i> the webinar, paste the recording link. This fires the post-webinar emails (attendee code + no-show replay).</li>
          </ul>
        </section>

        <section style={card}>
          <h2 style={h2}>Before vs. after the webinar</h2>
          <p style={{ margin: "0 0 8px" }}><b>Before:</b> title, banner, question, agenda, discount code → Save → share the link.</p>
          <p style={{ margin: 0 }}><b>After:</b> paste the <b>Replay URL</b> → the app emails attendees their discount code and no-shows the replay, and marks the webinar COMPLETE.</p>
        </section>

        <section style={card}>
          <h2 style={h2}>Status badges</h2>
          <ul>
            <li style={li}><b>NEEDS SETUP</b> — not set up in the app yet.</li>
            <li style={li}><b>AWAITING ANSWERS</b> — live, invites out, answers accumulating.</li>
            <li style={li}><b>EMAIL ARTIST → AWAITING ARTIST → NEEDS AGENDA → READY</b> — the design/agenda prep steps.</li>
            <li style={li}><b>AWAITING BLOG POST</b> — webinar done, paste the replay URL.</li>
            <li style={li}><b>COMPLETE</b> — post-webinar emails have fired.</li>
          </ul>
        </section>

        <p style={{ fontSize: 13, color: "#888" }}>
          Technical details? See <Link href="/developer">Developer instructions</Link>.
        </p>
      </div>
    </main>
  );
}
