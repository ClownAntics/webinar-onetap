/**
 * Calendar helpers. Both the Google template URL and the .ics carry the
 * registrant's personal join_url — the calendar entry is all they need on the day.
 */

export interface CalendarEvent {
  title: string;
  start: Date;
  end: Date;
  joinUrl: string;
  description?: string;
}

function toICSDate(d: Date): string {
  // UTC basic format: YYYYMMDDTHHMMSSZ
  return d.toISOString().replace(/[-:]/g, "").replace(/\.\d{3}/, "");
}

export function googleCalendarUrl(ev: CalendarEvent): string {
  const details = `${ev.description ? ev.description + "\n\n" : ""}Join link: ${ev.joinUrl}`;
  const params = new URLSearchParams({
    action: "TEMPLATE",
    text: ev.title,
    dates: `${toICSDate(ev.start)}/${toICSDate(ev.end)}`,
    details,
  });
  return `https://calendar.google.com/calendar/render?${params.toString()}`;
}

export function buildICS(ev: CalendarEvent): string {
  const uid = `${toICSDate(ev.start)}-${Math.abs(hash(ev.joinUrl))}@webinars.facepaint.com`;
  const desc = `${ev.description ? ev.description + "\\n\\n" : ""}Join link: ${ev.joinUrl}`;
  return [
    "BEGIN:VCALENDAR",
    "VERSION:2.0",
    "PRODID:-//FacePaint//Webinar//EN",
    "CALSCALE:GREGORIAN",
    "METHOD:PUBLISH",
    "BEGIN:VEVENT",
    `UID:${uid}`,
    `DTSTAMP:${toICSDate(new Date(0))}`,
    `DTSTART:${toICSDate(ev.start)}`,
    `DTEND:${toICSDate(ev.end)}`,
    `SUMMARY:${escapeICS(ev.title)}`,
    `DESCRIPTION:${escapeICS(desc)}`,
    `URL:${ev.joinUrl}`,
    "END:VEVENT",
    "END:VCALENDAR",
  ].join("\r\n");
}

function escapeICS(s: string): string {
  return s.replace(/([,;])/g, "\\$1").replace(/\n/g, "\\n");
}

function hash(s: string): number {
  let h = 0;
  for (let i = 0; i < s.length; i++) {
    h = (Math.imul(31, h) + s.charCodeAt(i)) | 0;
  }
  return h;
}
