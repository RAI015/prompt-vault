import { type Page, expect } from "@playwright/test";
import { PV_SELECTORS } from "../../../src/constants/ui-selectors";

type CreatePromptParams = {
  title: string;
  body: string;
  tagsCsv: string;
};

export const createPrompt = async (
  page: Page,
  { title, body, tagsCsv }: CreatePromptParams,
): Promise<void> => {
  await page.getByTestId(PV_SELECTORS.createButton).click();
  await page.getByTestId(PV_SELECTORS.titleInput).fill(title);
  await page.getByTestId(PV_SELECTORS.bodyInput).fill(body);
  await page.getByTestId(PV_SELECTORS.tagsInput).fill(tagsCsv);
  await page.getByTestId(PV_SELECTORS.saveButton).click();
  await expect(page.getByTestId(PV_SELECTORS.selectedTitle)).toHaveText(title);
};
