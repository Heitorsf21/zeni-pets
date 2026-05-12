export function getGoogleEnvStatus() {
  return {
    clientId: Boolean(process.env.GOOGLE_CLIENT_ID),
    clientSecret: Boolean(process.env.GOOGLE_CLIENT_SECRET),
    redirectUri: Boolean(process.env.GOOGLE_REDIRECT_URI),
    webhookUrl: Boolean(process.env.GOOGLE_WEBHOOK_URL),
  };
}

export function assertGoogleOAuthEnv() {
  const status = getGoogleEnvStatus();
  const missing = [
    status.clientId ? null : "GOOGLE_CLIENT_ID",
    status.clientSecret ? null : "GOOGLE_CLIENT_SECRET",
    status.redirectUri ? null : "GOOGLE_REDIRECT_URI",
  ].filter(Boolean);
  if (missing.length) {
    throw new Error(`Configure ${missing.join(", ")} para conectar o Google Agenda.`);
  }
}
