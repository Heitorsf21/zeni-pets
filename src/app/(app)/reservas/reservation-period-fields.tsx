"use client";

import { useEffect, useRef, useState } from "react";
import type { ReservationServiceOption } from "@/lib/reservation-form-options";
import { VisitDatesField } from "./visit-dates-field";

type Props = {
  serviceTypes: ReservationServiceOption[];
  formId?: string;
  defaultStartsAt?: string;
  defaultEndsAt?: string;
  defaultVisitDates?: string[];
  forcedKind?: string;
};

export function ReservationPeriodFields({
  serviceTypes,
  formId,
  defaultStartsAt,
  defaultEndsAt,
  defaultVisitDates,
  forcedKind,
}: Props) {
  const rootRef = useRef<HTMLDivElement>(null);
  const [serviceTypeId, setServiceTypeId] = useState<string>(serviceTypes[0]?.id ?? "");

  useEffect(() => {
    if (forcedKind) return;
    const form = formId
      ? document.getElementById(formId)
      : rootRef.current?.closest("form");
    if (!(form instanceof HTMLFormElement)) return;

    const sync = () => {
      const data = new FormData(form);
      const next = String(data.get("serviceTypeId") ?? "");
      if (next) setServiceTypeId(next);
    };
    sync();
    form.addEventListener("change", sync);
    form.addEventListener("input", sync);
    return () => {
      form.removeEventListener("change", sync);
      form.removeEventListener("input", sync);
    };
  }, [formId, forcedKind]);

  const selected = serviceTypes.find((service) => service.id === serviceTypeId) ?? serviceTypes[0] ?? null;
  const kind = forcedKind ?? selected?.kind ?? "";

  if (kind === "PET_SITTING") {
    return (
      <div ref={rootRef} style={{ display: "contents" }}>
        <VisitDatesField defaultDates={defaultVisitDates} />
      </div>
    );
  }

  if (kind === "DAYCARE") {
    return (
      <div ref={rootRef} style={{ display: "contents" }}>
        <label className="field" style={{ gridColumn: "1 / -1" }}>
          <span className="field__label">Data da creche</span>
          <input
            className="input"
            name="startsAt"
            type="date"
            defaultValue={defaultStartsAt ?? ""}
            required
          />
        </label>
      </div>
    );
  }

  return (
    <div ref={rootRef} style={{ display: "contents" }}>
      <label className="field">
        <span className="field__label">Check-in</span>
        <input
          className="input"
          name="startsAt"
          type="date"
          defaultValue={defaultStartsAt ?? ""}
          required
        />
      </label>
      <label className="field">
        <span className="field__label">Check-out</span>
        <input
          className="input"
          name="endsAt"
          type="date"
          defaultValue={defaultEndsAt ?? ""}
          required
        />
      </label>
    </div>
  );
}
