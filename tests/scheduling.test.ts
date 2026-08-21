import assert from "node:assert/strict";
import test from "node:test";
import { brazilDateISO, formatDate, upcomingDays } from "@/lib/scheduling";

test("uses São Paulo's calendar day instead of the browser's UTC day", () => {
  const utcDate = new Date("2026-08-21T02:30:00.000Z");
  assert.equal(brazilDateISO(utcDate), "2026-08-20");
});

test("lists forthcoming days from São Paulo's calendar", () => {
  const utcDate = new Date("2026-08-21T02:30:00.000Z");
  const days = upcomingDays(2, utcDate);

  assert.deepEqual(days.map((day) => day.iso), ["2026-08-20", "2026-08-21"]);
  assert.deepEqual(days.map((day) => day.businessDay), [4, 5]);
});

test("formats ISO calendar dates without shifting them a day", () => {
  assert.equal(formatDate("2026-08-21"), "21/08/2026");
});
