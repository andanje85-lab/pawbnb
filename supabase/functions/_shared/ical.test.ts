import { assertEquals } from "https://deno.land/std@0.224.0/assert/mod.ts";
import { addDays, buildIcal, expandNights, groupRanges, parseIcal, toDateOnly, unfold } from "./ical.ts";

Deno.test("unfold joins continuation lines", () => {
  assertEquals(unfold("SUMMARY:Long\r\n  tail\r\nUID:1"), ["SUMMARY:Long tail", "UID:1"]);
});

Deno.test("toDateOnly handles dates and date-times", () => {
  assertEquals(toDateOnly("20260907"), "2026-09-07");
  assertEquals(toDateOnly("20260907T140000Z"), "2026-09-07");
  assertEquals(toDateOnly("nope"), null);
});

Deno.test("parseIcal reads all-day events", () => {
  const ics = [
    "BEGIN:VCALENDAR",
    "BEGIN:VEVENT",
    "UID:abc-1",
    "DTSTART;VALUE=DATE:20260910",
    "DTEND;VALUE=DATE:20260913",
    "SUMMARY:Booked",
    "END:VEVENT",
    "END:VCALENDAR",
  ].join("\r\n");
  const events = parseIcal(ics);
  assertEquals(events.length, 1);
  assertEquals(events[0], { uid: "abc-1", start: "2026-09-10", end: "2026-09-13", summary: "Booked" });
});

Deno.test("parseIcal defaults missing DTEND to one night", () => {
  const ics = "BEGIN:VEVENT\r\nDTSTART;VALUE=DATE:20260910\r\nEND:VEVENT";
  assertEquals(parseIcal(ics)[0].end, "2026-09-11");
});

Deno.test("expandNights excludes the checkout day", () => {
  const nights = expandNights({ uid: "x", start: "2026-09-10", end: "2026-09-13" });
  assertEquals(nights, ["2026-09-10", "2026-09-11", "2026-09-12"]);
});

Deno.test("addDays crosses month boundaries", () => {
  assertEquals(addDays("2026-09-30", 1), "2026-10-01");
});

Deno.test("groupRanges merges contiguous dates", () => {
  assertEquals(groupRanges(["2026-09-11", "2026-09-10", "2026-09-11", "2026-09-14"]), [
    { start: "2026-09-10", end: "2026-09-12" },
    { start: "2026-09-14", end: "2026-09-15" },
  ]);
});

Deno.test("buildIcal emits a valid feed", () => {
  const ics = buildIcal("Sunny yard", [
    { uid: "u1", start: "2026-09-10", end: "2026-09-12", summary: "Unavailable" },
  ], new Date("2026-09-07T00:00:00Z"));
  assertEquals(ics.startsWith("BEGIN:VCALENDAR\r\n"), true);
  assertEquals(ics.includes("DTSTART;VALUE=DATE:20260910"), true);
  assertEquals(ics.includes("DTEND;VALUE=DATE:20260912"), true);
  assertEquals(ics.trimEnd().endsWith("END:VCALENDAR"), true);
});
