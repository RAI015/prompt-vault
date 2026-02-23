const allowEmailsRaw = process.env.ALLOW_EMAILS;

if (process.env.NODE_ENV === "production" && !allowEmailsRaw?.trim()) {
  throw new Error("ALLOW_EMAILS is required in production environment.");
}

if (process.env.NODE_ENV !== "production" && !allowEmailsRaw?.trim()) {
  console.warn("[WARN] ALLOW_EMAILS is empty. Access will be denied for all users.");
}

export const allowEmails = new Set(
  (allowEmailsRaw ?? "")
    .split(",")
    .map((email) => email.trim().toLowerCase())
    .filter(Boolean),
);

export const isEmailAllowed = (email: string | null | undefined): boolean => {
  if (!email) {
    return false;
  }
  return allowEmails.has(email.toLowerCase());
};
