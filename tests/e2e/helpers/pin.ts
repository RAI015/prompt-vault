import { type Locator, expect } from "@playwright/test";
import { PV_SELECTORS } from "../../../src/constants/ui-selectors";

export const togglePinInItem = async (item: Locator): Promise<void> => {
  await item.getByTestId(PV_SELECTORS.searchResultPinButton).click();
};

export const expectPinnedOrder = async (
  items: Locator,
  expectedTitles: string[],
): Promise<void> => {
  await expect(items).toHaveCount(expectedTitles.length, { timeout: 10_000 });
  for (const [index, title] of expectedTitles.entries()) {
    await expect(items.nth(index)).toContainText(title, { timeout: 10_000 });
  }
};
