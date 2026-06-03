import { describe, expect, it } from "vitest";
import { reservationToGoogleEvent } from "@/lib/google/calendar";

describe("Google Calendar event mapping", () => {
  it("keeps Zeni reservation id in private extended properties", () => {
    const event = reservationToGoogleEvent({
      reservationId: "reservation-1",
      title: "Theo - Hospedagem",
      startsAt: new Date(2026, 3, 27),
      endsAt: new Date(2026, 4, 2),
      inviteTutor: false,
      tutorEmail: "tutor@example.com",
    });

    expect(event.summary).toBe("Theo - Hospedagem");
    expect(event.extendedProperties.private.zeniReservationId).toBe("reservation-1");
    expect(event.attendees).toBeUndefined();
  });

  it("emits all-day events using start.date and end.date (exclusive)", () => {
    const event = reservationToGoogleEvent({
      reservationId: "reservation-3",
      title: "Rex - Hospedagem",
      startsAt: new Date(2026, 4, 7),
      endsAt: new Date(2026, 4, 15),
      inviteTutor: false,
    });

    expect(event.start).toEqual({ date: "2026-05-07" });
    expect(event.end).toEqual({ date: "2026-05-15" });
    expect((event.start as { dateTime?: string }).dateTime).toBeUndefined();
  });

  it("keeps the selected boarding check-out day visible in Google Calendar", () => {
    const event = reservationToGoogleEvent({
      reservationId: "reservation-4",
      title: "George, Jude, Sol - Hospedagem",
      startsAt: new Date("2026-06-03T10:00:00-03:00"),
      endsAt: new Date("2026-06-07T18:00:00-03:00"),
      serviceKind: "BOARDING",
      inviteTutor: false,
    });

    expect(event.start).toEqual({ date: "2026-06-03" });
    expect(event.end).toEqual({ date: "2026-06-08" });
  });

  it("adds attendees only when tutor invite is enabled", () => {
    const event = reservationToGoogleEvent({
      reservationId: "reservation-2",
      title: "Pipoca - Creche",
      startsAt: new Date(2026, 3, 28),
      endsAt: new Date(2026, 3, 29),
      inviteTutor: true,
      tutorEmail: "tutor@example.com",
    });

    expect(event.attendees).toEqual([{ email: "tutor@example.com" }]);
  });
});
