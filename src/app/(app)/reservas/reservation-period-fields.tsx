"use client";

import { useEffect, useRef, useState } from "react";
import type { ReservationServiceOption } from "@/lib/reservation-form-options";

type Props = {
  serviceTypes: ReservationServiceOption[];
  formId?: string;
  defaultStartsAt?: string;
  defaultEndsAt?: string;
};

export function ReservationPeriodFields({ serviceTypes, formId, defaultStartsAt, defaultEndsAt }: Props) {
  const rootRef = useRef<HTMLDivElement>(null);
  const [serviceTypeId, setServiceTypeId] = useState<string>(serviceTypes[0]?.id ?? "");

  useEffect(() => {
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
  }, [formId]);

  const selected = serviceTypes.find((service) => service.id === serviceTypeId) ?? serviceTypes[0] ?? null;
  const petSitting = selected?.kind === "PET_SITTING";

  if (petSitting) {
    return (
      <div ref={rootRef} style={{ display: "contents" }}>
        <label className="field" style={{ gridColumn: "1 / -1" }}>
          <span className="field__label">Data da visita</span>
          <input
            className="input"
            name="visitDate"
            type="date"
            defaultValue={defaultStartsAt ?? ""}
            required
          />
        </label>
        {/* Hidden mirror inputs so existing handlers reading startsAt still work */}
        <input type="hidden" name="startsAt" value="" readOnly />
        <input type="hidden" name="endsAt" value="" readOnly />
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
