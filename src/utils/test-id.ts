export const slugifyIdPart = (value: string): string => {
  return value
    .toLowerCase()
    .replace(/[^a-z0-9_-]+/g, "-")
    .replace(/-+/g, "-")
    .replace(/^-+|-+$/g, "");
};

export const toPlaceholderInputId = (key: string): string => {
  return `pv-placeholder-input-${slugifyIdPart(key)}`;
};
