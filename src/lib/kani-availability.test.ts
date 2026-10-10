import { describe, expect, it } from "vitest";
import {
  availableTimesForServiceDate,
  eligibleBarbersForServiceSlot,
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
  const slots = [
    slot({
      id: "lautaro-10",
      barber_name: "Lautaro",
      start_time: "10:00:00",
      end_time: "11:00:00",
    }),
    slot({
      id: "gonzalo-10",
      barber_name: "Gonzalo",
      start_time: "10:00:00",
      end_time: "11:00:00",
      status: "UNAVAILABLE",
    }),
    slot({
      id: "valentin-11",
      barber_name: "Valentín",
      start_time: "11:00:00",
      end_time: "12:00:00",
    }),
  ];

  it("groups all barbers by unique available start time", () => {
    expect(availableTimesForServiceDate(slots, "2026-10-08", 60, now)).toEqual(["10:00", "11:00"]);
    expect(eligibleBarbersForServiceSlot(slots, "2026-10-08", "10:00", 60, now)).toEqual([
      "Lautaro",
    ]);
    expect(eligibleBarbersForServiceSlot(slots, "2026-10-08", "11:00", 60, now)).toEqual([
      "Valentín",
    ]);
  });

  it("filters by a concrete barber when one was chosen initially", () => {
    expect(availableTimesForServiceDate(slots, "2026-10-08", 60, now, "Lautaro")).toEqual([
      "10:00",
    ]);
    expect(availableTimesForServiceDate(slots, "2026-10-08", 60, now, "Gonzalo")).toEqual([]);
  });

  it("requires the full service duration", () => {
    const shortSlot = slot({
      id: "short",
      barber_name: "Lautaro",
      start_time: "12:00:00",
      end_time: "12:30:00",
    });
    expect(availableTimesForServiceDate([shortSlot], "2026-10-08", 60, now)).toEqual([]);
    expect(eligibleBarbersForServiceSlot([shortSlot], "2026-10-08", "12:00", 60, now)).toEqual([]);
  });
});
