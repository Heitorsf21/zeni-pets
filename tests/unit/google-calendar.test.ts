import { describe, expect, it } from "vitest";
import { reservationToGoogleEvent } from "@/lib/google/calendar";

describe("Google Calendar event mapping", () => {
  it("keeps Zeni reservation id in private extended properties", () => {
    const event = reservationToGoogleEvent({
      reservationId: "reservation-1",
      title: "Hospedagem - Theo",
      startsAt: new Date("2026-04-27T10:00:00-03:00"),
      endsAt: new Date("2026-05-01T18:00:00-03:00"),
      inviteTutor: false,
      tutorEmail: "tutor@example.com",
    });

    expect(event.extendedProperties.private.zeniReservationId).toBe("reservation-1");
    expect(event.attendees).toBeUndefined();
  });

  it("adds attendees only when tutor invite is enabled", () => {
    const event = reservationToGoogleEvent({
      reservationId: "reservation-2",
      title: "Creche - Pipoca",
      startsAt: new Date("2026-04-28T08:30:00-03:00"),
      endsAt: new Date("2026-04-28T18:00:00-03:00"),
      inviteTutor: true,
      tutorEmail: "tutor@example.com",
    });

    expect(event.attendees).toEqual([{ email: "tutor@example.com" }]);
  });
});
