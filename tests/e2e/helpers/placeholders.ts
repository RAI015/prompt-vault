import type { Page } from "@playwright/test";
import { getPlaceholderInputSelector } from "../../../src/constants/ui-selectors";

export const fillPlaceholder = async (page: Page, key: string, value: string): Promise<void> => {
  await page.getByTestId(getPlaceholderInputSelector(key)).fill(value);
};

export const selectPlaceholderOption = async (
  page: Page,
  key: string,
  optionText: string,
): Promise<void> => {
  await page.getByTestId(getPlaceholderInputSelector(key)).click();
  await page.getByRole("option", { name: optionText }).click();
};
