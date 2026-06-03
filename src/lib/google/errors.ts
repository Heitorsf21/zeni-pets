type ErrorLike = {
  code?: unknown;
  message?: unknown;
  response?: {
    status?: unknown;
    statusText?: unknown;
    data?: unknown;
  };
};

function asString(value: unknown) {
  return typeof value === "string" && value.trim() ? value : undefined;
}

function asNumber(value: unknown) {
  return typeof value === "number" ? value : undefined;
}

function readGoogleErrorData(data: unknown) {
  if (!data || typeof data !== "object") return {};
  const record = data as Record<string, unknown>;
  const nestedError = record.error && typeof record.error === "object"
    ? record.error as Record<string, unknown>
    : null;

  return {
    googleError: asString(record.error) ?? asString(nestedError?.message),
    googleStatus: asString(nestedError?.status),
    googleCode: asNumber(nestedError?.code),
    googleDescription: asString(record.error_description),
  };
}

export function googleCalendarErrorMessage(error: unknown, fallback: string) {
  return error instanceof Error ? error.message : fallback;
}

export function googleCalendarErrorLog(error: unknown) {
  const candidate = error as ErrorLike;
  return {
    message: error instanceof Error ? error.message : asString(candidate.message) ?? String(error),
    code: candidate.code,
    responseStatus: candidate.response?.status,
    responseStatusText: candidate.response?.statusText,
    ...readGoogleErrorData(candidate.response?.data),
  };
}
