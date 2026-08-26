import { expect, test } from "@playwright/test";

test("plays, pauses, saves, reloads, and restores the same world", async ({
  page,
}) => {
  const consoleErrors: string[] = [];
  page.on("console", (message) => {
    if (message.type() === "error") consoleErrors.push(message.text());
  });

  await page.goto("/");
  await expect(page.getByRole("heading", { name: "分裂列島" })).toBeVisible();
  await expect(page.locator('path[role="button"]')).toHaveCount(47);

  await page.getByRole("button", { name: "東京都" }).press("Enter");
  await page.getByLabel("WORLD SEED").fill("day-one-e2e-seed");
  await page.getByRole("button", { name: "この政府で開始" }).click();

  await expect(page.getByText("STATE SIGNAL: 47 / 47")).toBeVisible();
  await expect(page.getByText("DAY:0000", { exact: true })).toBeVisible();
  await page.getByRole("button", { name: "x20" }).click();
  await expect(page.getByText(/DAY:00(1[0-9]|[2-9][0-9])/)).toBeVisible({
    timeout: 5_000,
  });
  await page.getByRole("button", { name: "PAUSE" }).click();

  const pausedDay = await page.locator(".world-clock strong").textContent();
  await page.waitForTimeout(200);
  await expect(page.locator(".world-clock strong")).toHaveText(pausedDay ?? "");
  await expect(page.locator(".event-log li").first()).toBeVisible();

  await page.getByRole("button", { name: "SAVE" }).click();
  await expect(page.getByRole("status")).toContainText("保存しました");
  const savedDay = await page.locator(".world-clock strong").textContent();

  await page.reload();
  await page.getByRole("button", { name: "保存済み世界をロード" }).click();
  await expect(page.locator(".world-clock strong")).toHaveText(savedDay ?? "");
  await expect(page.getByRole("status")).toContainText("ロードしました");
  expect(consoleErrors).toEqual([]);
});
