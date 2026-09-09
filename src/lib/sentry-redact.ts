/** Tokenbärande vägar och auth-huvuden ska inte hamna i Sentry. */
export function redactSensitiveText(value: string): string {
  return value
    .replace(/\/faktura\/[a-f0-9]{48}/gi, "/faktura/[redacted]")
    .replace(/\/prenumeration\/hantera\/[a-f0-9]{48}/gi, "/prenumeration/hantera/[redacted]")
    .replace(/Bearer\s+\S+/gi, "Bearer [redacted]");
}

const DROP_HEADERS = new Set(["cookie", "authorization", "x-forwarded-for", "x-real-ip"]);

export function redactSentryEvent<T extends Record<string, unknown>>(event: T): T {
  const req = event.request;
  if (req && typeof req === "object") {
    const r = req as Record<string, unknown>;
    if (typeof r.url === "string") r.url = redactSensitiveText(r.url);
    if (typeof r.query_string === "string") r.query_string = redactSensitiveText(r.query_string);
    if (r.cookies) delete r.cookies;
    if (r.headers && typeof r.headers === "object") {
      const headers = r.headers as Record<string, unknown>;
      for (const key of Object.keys(headers)) {
        if (DROP_HEADERS.has(key.toLowerCase())) delete headers[key];
      }
    }
  }
  const exception = event.exception as { values?: Array<{ value?: string }> } | undefined;
  if (exception?.values) {
    for (const v of exception.values) {
      if (typeof v.value === "string") v.value = redactSensitiveText(v.value);
    }
  }
  return event;
}
