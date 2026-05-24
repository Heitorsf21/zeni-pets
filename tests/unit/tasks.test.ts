import { describe, expect, it } from "vitest";
import { taskPetLabel } from "@/lib/tasks";

describe("task pet labels", () => {
  it("uses the direct task pet when available", () => {
    expect(
      taskPetLabel({
        pet: { name: "Mavi" },
        reservation: {
          reservationPets: [
            { pet: { name: "Theo" } },
            { pet: { name: "Luna" } },
          ],
        },
      }),
    ).toBe("Mavi");
  });

  it("falls back to reservation pets when the task has no pet", () => {
    expect(
      taskPetLabel({
        pet: null,
        reservation: {
          reservationPets: [
            { pet: { name: "Theo" } },
            { pet: { name: "Luna" } },
          ],
        },
      }),
    ).toBe("Theo, Luna");
  });
});
