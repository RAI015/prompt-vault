const PLACEHOLDER_REGEX = /\{\{([A-Za-z][A-Za-z0-9_]*)\}\}/g;

export const extractPlaceholders = (body: string): string[] => {
  const values = new Set<string>();
  for (const match of body.matchAll(PLACEHOLDER_REGEX)) {
    if (match[1]) {
      values.add(match[1]);
    }
  }
  return [...values];
};

export const renderTemplate = (body: string, variables: Record<string, string>): string => {
  return body.replaceAll(PLACEHOLDER_REGEX, (_, key: string) => variables[key] ?? "");
};
