import { describe, expect, it } from "vitest";
import { formatPetServiceTitle } from "@/lib/reservation-title";

describe("reservation display titles", () => {
  it("formats reservation labels as pet-service", () => {
    expect(
      formatPetServiceTitle({
        petNames: ["Mavi"],
        serviceName: "Hospedagem",
      }),
    ).toBe("Mavi - Hospedagem");
  });

  it("keeps multiple pet names in the label", () => {
    expect(
      formatPetServiceTitle({
        petNames: ["George", "Jude", "Sol"],
        serviceName: "Hospedagem",
      }),
    ).toBe("George, Jude, Sol - Hospedagem");
  });
});
