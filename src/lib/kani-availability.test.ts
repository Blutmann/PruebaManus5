import { describe, expect, it } from "vitest";
import {
  availabilityStartTimesForServiceDate,
  availableTimesForServiceDate,
  eligibleBarbersForAvailabilityStart,
  eligibleBarbersForServiceSlot,
  effectiveServiceDurationSeconds,
  isManageableScheduleDate,
  type PublicAvailabilityStart,
  type PublicAvailabilitySlot,
} from "./kani-availability";

const now = new Date("2026-10-08T09:00:00");

function slot({
  id,
  barber_name,
  start_time,
  end_time,
  status = "AVAILABLE",
}: Pick<PublicAvailabilitySlot, "id" | "barber_name" | "start_time" | "end_time"> & {
  status?: PublicAvailabilitySlot["status"];
}) {
  return {
    id,
    barber_id: `${barber_name}-id`,
    slot_date: "2026-10-08",
    start_time,
    end_time,
    status,
    barber_name,
  } as PublicAvailabilitySlot;
}

describe("public booking availability helpers", () => {
  it("mantiene las duraciones comerciales exactas", () => {
    expect(effectiveServiceDurationSeconds(45)).toBe(45 * 60);
    expect(effectiveServiceDurationSeconds(30)).toBe(30 * 60);
    expect(effectiveServiceDurationSeconds(60)).toBe(60 * 60);
  });

  const slots = [
    slot({
      id: "lautaro-window",
      barber_name: "Lautaro",
      start_time: "10:00:00",
      end_time: "12:00:00",
    }),
    slot({
      id: "gonzalo-window",
      barber_name: "Gonzalo",
      start_time: "10:00:00",
      end_time: "11:00:00",
    }),
    slot({
      id: "gonzalo-blocked",
      barber_name: "Gonzalo",
      start_time: "10:30:00",
      end_time: "10:45:00",
      status: "UNAVAILABLE",
    }),
    slot({
      id: "valentin-window",
      barber_name: "Valentín",
      start_time: "11:00:00",
      end_time: "12:00:00",
    }),
  ];

  it("offers every five-minute start that fits the full service duration", () => {
    expect(availableTimesForServiceDate(slots, "2026-10-08", 60, now, "Lautaro")).toEqual([
      "10:00", "10:05", "10:10", "10:15", "10:20", "10:25", "10:30", "10:35", "10:40", "10:45", "10:50", "10:55", "11:00",
    ]);
    expect(availableTimesForServiceDate(slots, "2026-10-08", 45, now, "Lautaro")).toEqual([
      "10:00", "10:05", "10:10", "10:15", "10:20", "10:25", "10:30", "10:35", "10:40", "10:45", "10:50", "10:55", "11:00", "11:05", "11:10", "11:15",
    ]);
    expect(availableTimesForServiceDate(slots, "2026-10-08", 30, now, "Lautaro")).toEqual([
      "10:00", "10:05", "10:10", "10:15", "10:20", "10:25", "10:30", "10:35", "10:40", "10:45", "10:50", "10:55", "11:00", "11:05", "11:10", "11:15", "11:20", "11:25", "11:30",
    ]);
  });

  it("keeps barbers distinct and ignores unavailable windows", () => {
    expect(eligibleBarbersForServiceSlot(slots, "2026-10-08", "10:00", 60, now)).toEqual([
      "Lautaro",
    ]);
    expect(eligibleBarbersForServiceSlot(slots, "2026-10-08", "10:30", 30, now)).toEqual([
      "Lautaro",
    ]);
    expect(availableTimesForServiceDate(slots, "2026-10-08", 60, now, "Gonzalo")).toEqual([]);
  });

  it("representa inicios estándar cada 15 minutos y conserva excepciones manuales", () => {
    const starts: PublicAvailabilityStart[] = [
      { slot_date: "2026-10-08", start_time: "10:00:00", is_exception: false, compatible_services: ["Corte", "Barba", "Corte + barba"], barber_name: "Lautaro", barber_id: "lautaro-id" },
      { slot_date: "2026-10-08", start_time: "10:15:00", is_exception: false, compatible_services: ["Barba"], barber_name: "Lautaro", barber_id: "lautaro-id" },
      { slot_date: "2026-10-08", start_time: "12:10:00", is_exception: true, compatible_services: ["Barba"], barber_name: "Lautaro", barber_id: "lautaro-id" },
    ];
    expect(starts.filter(start => !start.is_exception).map(start => start.start_time.slice(0, 5))).toEqual(["10:00", "10:15"]);
    expect(starts.find(start => start.is_exception)?.start_time.slice(0, 5)).toBe("12:10");
    expect(starts.find(start => start.start_time === "10:15:00")?.compatible_services).toEqual(["Barba"]);
    const now = new Date("2026-10-08T08:00:00-03:00");
    expect(availabilityStartTimesForServiceDate(starts, "2026-10-08", "Barba", now, "Lautaro")).toEqual(["10:00", "10:15", "12:10"]);
    expect(availabilityStartTimesForServiceDate(starts, "2026-10-08", "Corte + barba", now, "Lautaro")).toEqual(["10:00"]);
    expect(eligibleBarbersForAvailabilityStart(starts, "2026-10-08", "12:10", "Barba", now)).toEqual(["Lautaro"]);
  });

  it("requires all five-minute segments of a service to be available", () => {
    const splitWindow = [
      slot({ id: "first", barber_name: "Lautaro", start_time: "12:00:00", end_time: "12:30:00" }),
      slot({ id: "second", barber_name: "Lautaro", start_time: "12:40:00", end_time: "13:10:00" }),
    ];
    expect(availableTimesForServiceDate(splitWindow, "2026-10-08", 45, now, "Lautaro")).toEqual([]);
    expect(availableTimesForServiceDate(splitWindow, "2026-10-08", 30, now, "Lautaro")).toEqual([
      "12:00", "12:40",
    ]);
  });

  it("reuses the remaining interval after a 30-minute reservation", () => {
    const remainingAfterBarba = [
      slot({ id: "remaining", barber_name: "Lautaro", start_time: "11:30:00", end_time: "12:00:00" }),
    ];
    expect(availableTimesForServiceDate(remainingAfterBarba, "2026-10-08", 30, now, "Lautaro")).toEqual([
      "11:30",
    ]);
  });

  it("does not offer a start inside the remaining interval of an overlapping 45-minute reservation", () => {
    const remainingAfterCorte = [
      slot({ id: "remaining", barber_name: "Lautaro", start_time: "11:45:00", end_time: "12:00:00" }),
    ];
    expect(availableTimesForServiceDate(remainingAfterCorte, "2026-10-08", 30, now, "Lautaro")).toEqual([]);
  });

  it("supports intermediate starts such as 12:10 and 12:15", () => {
    const intermediateWindow = [
      slot({ id: "intermediate", barber_name: "Lautaro", start_time: "12:10:00", end_time: "13:15:00" }),
    ];
    expect(availableTimesForServiceDate(intermediateWindow, "2026-10-08", 60, now, "Lautaro")).toEqual([
      "12:10", "12:15",
    ]);
  });

  it("rejects unsupported durations instead of inventing a partial start", () => {
    expect(availableTimesForServiceDate(slots, "2026-10-08", 0, now)).toEqual([]);
    expect(availableTimesForServiceDate(slots, "2026-10-08", 7, now)).toEqual([]);
  });
});

describe("fechas administrables de horarios", () => {
  it("permite fechas futuras más allá de 21 días y bloquea domingos", () => {
    expect(isManageableScheduleDate("2026-11-16", "2026-10-11")).toBe(true);
    expect(isManageableScheduleDate("2026-10-11", "2026-10-11")).toBe(false);
    expect(isManageableScheduleDate("2026-10-10", "2026-10-11")).toBe(false);
  });
});
