/**
 * Turn a raw Zoom webinar topic into a clean public display title.
 * "20260817 Dinosaurs Designs (Kathy Alesandria) Webinar"
 *   -> "Dinosaurs Designs with Kathy Alesandria"
 */
export function cleanWebinarTitle(topic?: string | null): string {
  if (!topic) return "";
  let t = topic.trim().replace(/^\d{6,8}\s+/, ""); // strip leading date code
  t = t.replace(/\s+(Webinar|Product Demo)\s*$/i, "").trim(); // strip trailing type
  const m = t.match(/^(.*?)\s*\(([^)]+)\)\s*$/); // "(Presenter)" -> "with Presenter"
  if (m) return `${m[1].trim()} with ${m[2].trim()}`;
  return t;
}
