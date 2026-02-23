type LogMeta = Record<string, string | number | boolean | null | undefined>;

const APP_LOG_PREFIX = "[prompt-vault]";

export const toMaskedEmail = (email: string | null | undefined): string | null => {
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

export const warn = (message: string, meta?: LogMeta) => {
  console.warn(APP_LOG_PREFIX, {
    message,
    ...meta,
  });
};

export const error = (message: string, meta?: LogMeta) => {
  console.error(APP_LOG_PREFIX, {
    message,
    ...meta,
  });
};
