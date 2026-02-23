type LogLevel = "info" | "warn" | "error";

type LogMeta = Record<string, string | number | boolean | null | undefined>;

const APP_LOG_PREFIX = "[prompt-vault]";

const maskEmail = (email: string | null | undefined): string | null => {
  if (!email) {
    return null;
  }
  const [local, domain] = email.split("@");
  if (!local || !domain) {
    return "invalid-email";
  }
  if (local.length <= 2) {
    return `**@${domain}`;
  }
  return `${local.slice(0, 2)}***@${domain}`;
};

export const toMaskedEmail = maskEmail;

export const log = (level: LogLevel, message: string, meta?: LogMeta) => {
  const payload = {
    message,
    ...meta,
  };

  if (level === "info") {
    console.info(APP_LOG_PREFIX, payload);
    return;
  }
  if (level === "warn") {
    console.warn(APP_LOG_PREFIX, payload);
    return;
  }
  console.error(APP_LOG_PREFIX, payload);
};
