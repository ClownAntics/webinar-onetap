import Link from "next/link";

export const metadata = { title: "How to use — OneTap Webinars" };

const card: React.CSSProperties = {
  background: "#fff",
  border: "1px solid #eee",
  borderRadius: 16,
  padding: 24,
  marginBottom: 16,
};
const h2: React.CSSProperties = { fontSize: 17, fontWeight: 800, marginTop: 0 };
const li: React.CSSProperties = { marginBottom: 6, lineHeight: 1.5 };
const th: React.CSSProperties = { textAlign: "left", padding: "6px 8px", borderBottom: "2px solid #eee" };
const td: React.CSSProperties = { padding: "6px 8px", borderBottom: "1px solid #eee", verticalAlign: "top", overflowWrap: "anywhere" };
const PERMANENT: [string, string][] = [
  ["Instagram bio", "instagram"],
  ["TikTok bio", "tiktok"],
  ["Facebook", "facebook"],
  ["Website", "website"],
];

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
            <li style={li}><b>Pick the Organization</b> (FacePaint / Clownantics / CareerLearning) — it sets the landing page&apos;s logo, colors, and mailing-list text.</li>
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
          <h2 style={h2}>Rescheduling a webinar</h2>
          <ul>
            <li style={li}><b>Change the date/time in Zoom</b> — Zoom is the source of truth. The app picks it up overnight, or instantly if you open the webinar in Admin and hit <b>Save</b>.</li>
            <li style={li}><b>The banner image does not update itself</b> — if the date is printed on the banner, upload a corrected one.</li>
          </ul>
        </section>

        <section style={card}>
          <h2 style={h2}>Stats</h2>
          <p style={{ margin: 0 }}>
            Registration counts blend <b>Zoom&apos;s tracking sources</b> with the app&apos;s own
            <b> ⚡ one-tap registrations</b> (Zoom&apos;s numbers can&apos;t see people registered via
            the API, so the app adds them per source). Each webinar&apos;s page also shows
            <b> page visits</b> and a <b>conversion&nbsp;%</b> — how many visitors actually registered.
            <b> Attendance</b> and the <b>Trends / revenue</b> view populate after the webinar
            (attendance syncs on a nightly schedule, so expect up to a day&apos;s lag).
          </p>
        </section>

        <section style={card} id="permanent-links">
          <h2 style={h2}>Permanent links (Instagram, TikTok, website) — new Nov 2026</h2>
          <p style={{ marginTop: 0 }}>
            One link per place that <b>never changes</b>. It always opens the sign-up page for the
            <b> next free webinar</b> (masterclasses are skipped), and it records where the person
            came from. Post it once — no more re-pasting a link for every webinar.
          </p>
          <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 13.5, marginBottom: 12 }}>
            <thead>
              <tr><th style={th}>Where</th><th style={th}>FacePaint</th><th style={th}>Clownantics</th></tr>
            </thead>
            <tbody>
              {PERMANENT.map(([where, src]) => (
                <tr key={src}>
                  <td style={td}>{where}</td>
                  <td style={td}><code>webinars.facepaint.com/next?src={src}</code></td>
                  <td style={td}><code>webinars.clownantics.com/next?src={src}</code></td>
                </tr>
              ))}
            </tbody>
          </table>
          <ul>
            <li style={li}><b>Always use the link for the place you&apos;re posting</b> — the <code>src=</code> part is how Stats tells Instagram, TikTok and the website apart.</li>
            <li style={li}>Somewhere new (a blog, YouTube, a flyer QR code)? Same link, your own label: <code>/next?src=youtube</code>. Lowercase letters, numbers and dashes, up to 20 characters.</li>
            <li style={li}>In Admin, a webinar&apos;s Setup panel has <b>Copy permanent bio link</b> — pick the channel, then copy.</li>
            <li style={li}>If no webinar is scheduled, the link shows a &quot;no webinars open right now&quot; page instead of an old webinar.</li>
            <li style={li}><b>Email &amp; SMS are unchanged</b> — keep using <b>Copy link for Yumer</b> for each webinar (it carries the person&apos;s name and email).</li>
          </ul>
        </section>

        <section style={card} id="more-webinars">
          <h2 style={h2}>Signing up for more than one webinar</h2>
          <ul>
            <li style={li}>After someone registers, the confirmation screen shows <b>&quot;Want more free webinars?&quot;</b> with a <b>Sign up for another webinar</b> button (hidden if nothing else is open).</li>
            <li style={li}>It opens a list of the brand&apos;s open webinars, soonest first. Ones they&apos;re already registered for show <b>✓ You&apos;re signed up</b>. Their details are remembered, so each extra sign-up is one tap.</li>
            <li style={li}>Extra sign-ups count toward the <b>same channel</b> as the first one (started on Instagram → all Instagram).</li>
            <li style={li}>The list is also a page of its own: <code>webinars.facepaint.com/webinars</code> (and <code>webinars.clownantics.com/webinars</code>).</li>
          </ul>
        </section>

        <section style={card}>
          <h2 style={h2}>Website &amp; social links</h2>
          <ul>
            <li style={li}>For anything that stays up (bios, website), use the <a href="#permanent-links">permanent links</a> above. The per-webinar <b>plain link</b> (Copy link for Aubrey) still works for a post about one specific webinar.</li>
            <li style={li}><b>Anyone who has registered through the app before gets the one-tap page</b> from that plain link — their browser remembers them (for a year). Brand-new visitors see a short name + email form.</li>
            <li style={li}>On a shared computer, the <b>&quot;Not you?&quot;</b> button forgets the remembered person.</li>
            <li style={li}>The <b>&quot;What customers want to see&quot;</b> panel includes answers from people who registered on Zoom&apos;s own page too, not just through the app.</li>
          </ul>
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
