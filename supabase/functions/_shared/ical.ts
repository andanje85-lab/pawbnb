/** Minimal iCalendar helpers shared by the calendar-sync edge function. */

export interface IcalEvent {
  uid: string;
  start: string; // yyyy-mm-dd
  end: string; // yyyy-mm-dd (exclusive, per iCal DTEND for all-day events)
  summary?: string;
}

/** Unfold RFC 5545 folded lines (continuation lines start with space or tab). */
export function unfold(raw: string): string[] {
  const lines = raw.replace(/\r\n/g, "\n").split("\n");
  const out: string[] = [];
  for (const line of lines) {
    if ((line.startsWith(" ") || line.startsWith("\t")) && out.length > 0) {
      out[out.length - 1] += line.slice(1);
    } else {
      out.push(line);
    }
  }
  return out;
}

/** Normalize an iCal date/date-time value to yyyy-mm-dd, or null when unparseable. */
export function toDateOnly(value: string): string | null {
  const m = value.trim().match(/^(\d{4})(\d{2})(\d{2})/);
  if (!m) return null;
  const [, y, mo, d] = m;
  const date = new Date(Date.UTC(Number(y), Number(mo) - 1, Number(d)));
  if (Number.isNaN(date.getTime())) return null;
  return `${y}-${mo}-${d}`;
}

/** Parse VEVENT blocks out of an .ics document. */
export function parseIcal(raw: string): IcalEvent[] {
  const events: IcalEvent[] = [];
  let cur: Partial<IcalEvent> | null = null;

  for (const line of unfold(raw)) {
    const upper = line.toUpperCase();
    if (upper.startsWith("BEGIN:VEVENT")) {
      cur = {};
      continue;
    }
    if (upper.startsWith("END:VEVENT")) {
      if (cur?.start) {
        events.push({
          uid: cur.uid ?? `${cur.start}-${cur.end ?? cur.start}`,
          start: cur.start,
          end: cur.end ?? addDays(cur.start, 1),
          summary: cur.summary,
        });
      }
      cur = null;
      continue;
    }
    if (!cur) continue;

    const idx = line.indexOf(":");
    if (idx < 0) continue;
    const name = line.slice(0, idx).split(";")[0].trim().toUpperCase();
    const value = line.slice(idx + 1);

    if (name === "UID") cur.uid = value.trim();
    else if (name === "SUMMARY") cur.summary = value.trim();
    else if (name === "DTSTART") cur.start = toDateOnly(value) ?? undefined;
    else if (name === "DTEND") cur.end = toDateOnly(value) ?? undefined;
  }
  return events;
}

export function addDays(iso: string, days: number): string {
  const d = new Date(`${iso}T00:00:00Z`);
  d.setUTCDate(d.getUTCDate() + days);
  return d.toISOString().slice(0, 10);
}

/** All nights covered by an event: [start, end) — the checkout day stays bookable. */
export function expandNights(ev: IcalEvent, maxNights = 400): string[] {
  const nights: string[] = [];
  let cur = ev.start;
  while (cur < ev.end && nights.length < maxNights) {
    nights.push(cur);
    cur = addDays(cur, 1);
  }
  if (nights.length === 0) nights.push(ev.start);
  return nights;
}

function escapeText(s: string): string {
  return s.replace(/\\/g, "\\\\").replace(/\n/g, "\\n").replace(/([,;])/g, "\\$1");
}

const compact = (iso: string) => iso.replace(/-/g, "");

export interface IcalBlock {
  uid: string;
  start: string; // yyyy-mm-dd inclusive
  end: string; // yyyy-mm-dd exclusive
  summary: string;
}

/** Build an .ics feed of unavailable ranges for a listing. */
export function buildIcal(calendarName: string, blocks: IcalBlock[], now = new Date()): string {
  const stamp = `${compact(now.toISOString().slice(0, 10))}T000000Z`;
  const lines = [
    "BEGIN:VCALENDAR",
    "VERSION:2.0",
    "PRODID:-//PawBnB//Listing Availability//EN",
    "CALSCALE:GREGORIAN",
    "METHOD:PUBLISH",
    `X-WR-CALNAME:${escapeText(calendarName)}`,
  ];
  for (const b of blocks) {
    lines.push(
      "BEGIN:VEVENT",
      `UID:${b.uid}`,
      `DTSTAMP:${stamp}`,
      `DTSTART;VALUE=DATE:${compact(b.start)}`,
      `DTEND;VALUE=DATE:${compact(b.end)}`,
      `SUMMARY:${escapeText(b.summary)}`,
      "TRANSP:OPAQUE",
      "END:VEVENT",
    );
  }
  lines.push("END:VCALENDAR");
  return lines.join("\r\n") + "\r\n";
}

/** Group sorted, unique dates into contiguous [start, endExclusive) ranges. */
export function groupRanges(dates: string[]): { start: string; end: string }[] {
  const sorted = [...new Set(dates)].sort();
  const ranges: { start: string; end: string }[] = [];
  for (const d of sorted) {
    const last = ranges[ranges.length - 1];
    if (last && last.end === d) last.end = addDays(d, 1);
    else ranges.push({ start: d, end: addDays(d, 1) });
  }
  return ranges;
}
