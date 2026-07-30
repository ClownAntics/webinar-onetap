#!/usr/bin/env node
/**
 * One-time backfill: import the historical "Zoom Registrant Info" Google Sheet
 * ("Past Zoom Data" tab, exported as CSV) into the app Supabase.
 *
 * Writes:
 *   - webinar_config      (minimal: id, topic, display_title, start_time, status=COMPLETE)
 *   - webinar_reg_events  (source='backfill')
 *   - webinar_attendance  (attended + duration_min, deduped per webinar+email)
 *   - optional Omnisend tag `webinar-attendee` for historical attendees (--tags)
 *
 * Usage:
 *   node --env-file=.env.local scripts/backfill.mjs "Past Zoom Data.csv" [--dry-run] [--tags]
 *
 * Env: SUPABASE_URL, SUPABASE_SERVICE_KEY (+ OMNISEND_API_KEY if --tags).
 *
 * Idempotent: re-running replaces prior backfill rows for the webinars in the file.
 */
import { readFileSync } from "node:fs";
import { createClient } from "@supabase/supabase-js";

// ---- args ----
const args = process.argv.slice(2);
const flags = new Set(args.filter((a) => a.startsWith("--")));
const csvPath = args.find((a) => !a.startsWith("--"));
const DRY = flags.has("--dry-run");
const DO_TAGS = flags.has("--tags");

if (!csvPath) {
  console.error('Usage: node --env-file=.env.local scripts/backfill.mjs "Past Zoom Data.csv" [--dry-run] [--tags]');
  process.exit(1);
}

const EXCLUDE_EMAILS = new Set(["gbcabot@gmail.com"]);
const EXCLUDE_NAMES = new Set(["blake cabot"]);

// ---- tiny robust CSV parser (quotes, embedded commas/newlines, "" escapes) ----
function parseCSV(text) {
  const rows = [];
  let row = [];
  let field = "";
  let inQuotes = false;
  for (let i = 0; i < text.length; i++) {
    const c = text[i];
    if (inQuotes) {
      if (c === '"') {
        if (text[i + 1] === '"') { field += '"'; i++; }
        else inQuotes = false;
      } else field += c;
    } else if (c === '"') {
      inQuotes = true;
    } else if (c === ",") {
      row.push(field); field = "";
    } else if (c === "\n") {
      row.push(field); rows.push(row); row = []; field = "";
    } else if (c === "\r") {
      // ignore; handled by \n
    } else field += c;
  }
  if (field.length > 0 || row.length > 0) { row.push(field); rows.push(row); }
  return rows;
}

// ---- helpers ----
function normDate(s) {
  if (!s) return null;
  s = String(s).trim();
  let m = s.match(/^(\d{4})-(\d{1,2})-(\d{1,2})/);
  if (m) return `${m[1]}-${m[2].padStart(2, "0")}-${m[3].padStart(2, "0")}`;
  m = s.match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})/); // M/D/YYYY
  if (m) return `${m[3]}-${m[1].padStart(2, "0")}-${m[2].padStart(2, "0")}`;
  return null;
}

/** "20260803 Sea Creature Designs (Yasmeen Hart) Webinar" -> "Sea Creature Designs with Yasmeen Hart" */
function parseDisplayTitle(topic) {
  if (!topic) return null;
  let t = String(topic).trim().replace(/^\d{6,8}\s+/, ""); // strip leading date digits
  t = t.replace(/\s+(Webinar|Product Demo)\s*$/i, "").trim();
  const m = t.match(/^(.*?)\s*\(([^)]+)\)\s*$/);
  if (m) return `${m[1].trim()} with ${m[2].trim()}`;
  return t;
}

function toTs(s) {
  if (!s) return null;
  const d = new Date(String(s).trim());
  return isNaN(d.getTime()) ? null : d.toISOString();
}

// ---- read + parse ----
const raw = readFileSync(csvPath, "utf8");
const rows = parseCSV(raw);
if (rows.length < 2) { console.error("CSV has no data rows."); process.exit(1); }

const header = rows[0].map((h) => h.trim());
const STD = [
  "Webinar ID", "Webinar Topic", "Webinar Date", "Webinar Time", "Panelists",
  "Attended", "First Name", "Last Name", "Email", "Registration Time",
  "Time in Session (minutes)", "Is Guest", "Country/Region Name",
];
// Any column beyond the standard set is a per-webinar custom question answer.
const customIdx = header.map((h, i) => (STD.includes(h) ? -1 : i)).filter((i) => i >= 12);

const configByWebinar = new Map();
const attendanceByKey = new Map();
const regByKey = new Map();
let skippedNoId = 0, skippedExcluded = 0;

for (let r = 1; r < rows.length; r++) {
  const row = rows[r];
  if (!row || row.length < 9) continue;

  const webinarId = (row[0] || "").trim();
  const email = (row[8] || "").toLowerCase().trim();
  if (!webinarId) { skippedNoId++; continue; }
  if (!email) continue;

  const firstName = (row[6] || "").trim();
  const lastName = (row[7] || "").trim();
  const fullName = `${firstName} ${lastName}`.toLowerCase().trim();
  if (EXCLUDE_EMAILS.has(email) || EXCLUDE_NAMES.has(fullName)) { skippedExcluded++; continue; }

  const topic = (row[1] || "").trim();
  const date = normDate(row[2]);
  const attended = (row[5] || "").trim().toLowerCase() === "yes";
  const durRaw = (row[10] || "").trim();
  const duration = attended && /^\d+$/.test(durRaw) ? parseInt(durRaw, 10) : null;

  let answer = "";
  for (const ci of customIdx) {
    const v = (row[ci] || "").trim();
    if (v) { answer = v; break; }
  }

  // config (one per webinar; prefer a row that has a date)
  if (!configByWebinar.has(webinarId) || (date && !configByWebinar.get(webinarId).start_time)) {
    configByWebinar.set(webinarId, {
      webinar_id: webinarId,
      zoom_topic: topic || null,
      display_title: parseDisplayTitle(topic),
      start_time: date ? `${date}T12:00:00Z` : null,
      status: "COMPLETE",
    });
  }

  // attendance dedupe: keep the attended version
  const key = `${webinarId}|${email}`;
  const aExisting = attendanceByKey.get(key);
  if (!aExisting || (attended && !aExisting.attended)) {
    attendanceByKey.set(key, { webinar_id: webinarId, email, attended, duration_min: duration });
  }

  // reg event dedupe: keep the one carrying an answer / attended
  const rExisting = regByKey.get(key);
  if (!rExisting || (answer && !rExisting.question_answer)) {
    regByKey.set(key, {
      webinar_id: webinarId,
      email,
      first_name: firstName || null,
      source: "backfill",
      question_answer: answer || null,
      status: "success",
      ts: toTs(row[9]) || `${date ?? "2020-01-01"}T12:00:00Z`,
    });
  }
}

const configs = [...configByWebinar.values()];
const attendance = [...attendanceByKey.values()];
const regEvents = [...regByKey.values()];
const attendees = attendance.filter((a) => a.attended);
const webinarIds = configs.map((c) => c.webinar_id);

console.log("Parsed backfill:");
console.log(`  webinars:        ${configs.length}`);
console.log(`  reg events:      ${regEvents.length}`);
console.log(`  attendance rows: ${attendance.length} (attended: ${attendees.length})`);
console.log(`  skipped:         ${skippedNoId} no-id, ${skippedExcluded} excluded (host)`);
console.log(`  custom-answer columns detected: ${customIdx.length}`);

if (DRY) {
  console.log("\n--dry-run: no writes. Sample webinar config:");
  console.log(configs.slice(0, 3));
  process.exit(0);
}

// ---- write to Supabase ----
const url = process.env.SUPABASE_URL;
const keyEnv = process.env.SUPABASE_SERVICE_KEY;
if (!url || !keyEnv) { console.error("Missing SUPABASE_URL / SUPABASE_SERVICE_KEY"); process.exit(1); }
const sb = createClient(url, keyEnv, { auth: { persistSession: false } });

async function chunkedUpsert(table, rows, opts) {
  const CHUNK = 500;
  for (let i = 0; i < rows.length; i += CHUNK) {
    const { error } = await sb.from(table).upsert(rows.slice(i, i + CHUNK), opts);
    if (error) throw new Error(`${table}: ${error.message}`);
    process.stdout.write(`\r  ${table}: ${Math.min(i + CHUNK, rows.length)}/${rows.length}`);
  }
  process.stdout.write("\n");
}

try {
  console.log("\nWriting webinar_config...");
  await chunkedUpsert("webinar_config", configs, { onConflict: "webinar_id" });

  console.log("Replacing prior backfill reg_events for these webinars...");
  // Idempotency: clear old backfill rows for the webinars in this file, then insert.
  const IN_CHUNK = 200;
  for (let i = 0; i < webinarIds.length; i += IN_CHUNK) {
    const slice = webinarIds.slice(i, i + IN_CHUNK);
    const { error } = await sb
      .from("webinar_reg_events")
      .delete()
      .eq("source", "backfill")
      .in("webinar_id", slice);
    if (error) throw new Error(`reg_events delete: ${error.message}`);
  }
  console.log("Inserting webinar_reg_events...");
  const CHUNK = 500;
  for (let i = 0; i < regEvents.length; i += CHUNK) {
    const { error } = await sb.from("webinar_reg_events").insert(regEvents.slice(i, i + CHUNK));
    if (error) throw new Error(`reg_events insert: ${error.message}`);
    process.stdout.write(`\r  webinar_reg_events: ${Math.min(i + CHUNK, regEvents.length)}/${regEvents.length}`);
  }
  process.stdout.write("\n");

  console.log("Upserting webinar_attendance...");
  await chunkedUpsert("webinar_attendance", attendance, { onConflict: "webinar_id,email" });

  console.log("\n✅ Backfill complete.");
} catch (err) {
  console.error("\n❌ Backfill failed:", err.message);
  process.exit(1);
}

// ---- optional: Omnisend webinar-attendee tag ----
if (DO_TAGS) {
  const apiKey = process.env.OMNISEND_API_KEY;
  if (!apiKey) { console.error("--tags given but OMNISEND_API_KEY not set; skipping."); process.exit(0); }
  const uniqueAttendees = [...new Set(attendees.map((a) => a.email))];
  console.log(`\nTagging ${uniqueAttendees.length} historical attendees as webinar-attendee (this is slow)...`);
  let done = 0;
  for (const email of uniqueAttendees) {
    try {
      await fetch("https://api.omnisend.com/v5/contacts", {
        method: "POST",
        headers: { "Content-Type": "application/json", "X-API-KEY": apiKey },
        body: JSON.stringify({
          identifiers: [{ type: "email", id: email, channels: { email: { status: "subscribed" } } }],
          tags: ["webinar-attendee"],
        }),
      });
    } catch { /* keep going */ }
    if (++done % 100 === 0) process.stdout.write(`\r  tagged ${done}/${uniqueAttendees.length}`);
  }
  console.log(`\r  tagged ${done}/${uniqueAttendees.length}\n✅ Tagging complete.`);
}
