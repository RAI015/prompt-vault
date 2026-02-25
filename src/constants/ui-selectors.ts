import { slugifyIdPart, toPlaceholderInputId } from "@/utils/test-id";

export const PV_SELECTORS = {
  createButton: "pv-create-button",
  searchInput: "pv-search-input",
  searchResultItem: "pv-search-result-item",
  titleInput: "pv-title-input",
  bodyInput: "pv-body-input",
  tagsInput: "pv-tags-input",
  saveButton: "pv-save-button",
  selectedTitle: "pv-selected-title",
  copyBodyButton: "pv-copy-body",
  copyMarkdownButton: "pv-copy-markdown",
  renderedOutput: "pv-rendered-output",
  toastSuccess: "pv-toast-success",
} as const;

export const getPlaceholderInputSelector = (key: string): string => {
  return toPlaceholderInputId(key);
};

export const getPlaceholderLogLineCountSelector = (key: string): string => {
  return `pv-placeholder-log-line-count-${slugifyIdPart(key)}`;
};

export const getPlaceholderLogActionSelector = (
  key: string,
  action: "head" | "tail" | "head-tail" | "undo",
): string => {
  return `pv-placeholder-log-${action}-${slugifyIdPart(key)}`;
};

export const getToastSelector = (variant: "success" | "error"): string => {
  return `pv-toast-${variant}`;
};
