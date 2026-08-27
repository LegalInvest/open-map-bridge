import { expect, test } from '@playwright/test';

test('compares both lake presets with aligned views, isolated failures, and an explicit missing year', async ({ page }) => {
  const syntheticDates = new Set<string>();
  page.on('response', (response) => {
    const match = /\/api\/temporal\/tiles\/synthetic-lakes\/(scene-\d{4})\//.exec(response.url());
    if (match?.[1] && response.status() === 200) syntheticDates.add(match[1]);
  });

  await page.goto('/');
  await expect(page.getByRole('heading', { name: '双湖历史影像' })).toBeVisible();
  await expect(page.getByText('当前：合成验收源')).toBeVisible();
  await expect(page.getByText('范围待确认')).toBeVisible();

  const area = page.getByLabel('区域');
  await expect(area).toHaveValue('baoying-lake');

  const dateSelectors = page.getByLabel('面板日期');
  await expect(dateSelectors).toHaveCount(4);
  for (let index = 1; index <= 4; index += 1) {
    await expect(page.getByText(`面板 ${index}：已加载`)).toBeVisible();
  }
  await expect.poll(() => syntheticDates.size).toBeGreaterThanOrEqual(4);
  const maps = page.getByLabel(/历史影像地图/);
  await expect(maps).toHaveCount(4);
  const baoyingInitialView = JSON.parse((await maps.first().getAttribute('data-view-state')) ?? 'null') as { center: number[] };

  await Promise.all([
    page.waitForResponse((response) => response.url().includes('aoiId=gaoyou-lake') && response.ok()),
    area.selectOption('gaoyou-lake'),
  ]);
  await expect(area).toHaveValue('gaoyou-lake');
  for (let index = 1; index <= 4; index += 1) {
    await expect(page.getByText(`面板 ${index}：已加载`)).toBeVisible();
  }
  const gaoyouInitialView = JSON.parse((await maps.first().getAttribute('data-view-state')) ?? 'null') as { center: number[] };
  expect(gaoyouInitialView.center).not.toEqual(baoyingInitialView.center);
  await Promise.all([
    page.waitForResponse((response) => response.url().includes('aoiId=baoying-lake') && response.ok()),
    area.selectOption('baoying-lake'),
  ]);
  await expect(area).toHaveValue('baoying-lake');
  for (let index = 1; index <= 4; index += 1) {
    await expect(page.getByText(`面板 ${index}：已加载`)).toBeVisible();
  }
  const baoyingReturnView = JSON.parse((await maps.first().getAttribute('data-view-state')) ?? 'null') as { center: number[] };
  expect(baoyingReturnView.center).toEqual(baoyingInitialView.center);

  const firstMap = maps.first();
  const box = await firstMap.boundingBox();
  if (!box) throw new Error('first map has no layout box');
  await page.mouse.move(box.x + box.width / 2, box.y + box.height / 2);
  await page.mouse.down();
  await page.mouse.move(box.x + box.width / 2 + 60, box.y + box.height / 2 + 35, { steps: 5 });
  await page.mouse.up();
  await expect.poll(async () => {
    const states = await maps.evaluateAll((nodes) => nodes.map((node) => node.getAttribute('data-view-state')));
    return states.every(Boolean) && new Set(states).size === 1;
  }).toBe(true);

  await dateSelectors.nth(1).selectOption('scene-2012');
  await expect(page.getByText('面板 2：加载失败')).toBeVisible();
  await expect(page.getByText('面板 1：已加载')).toBeVisible();
  await expect(page.getByText('面板 3：已加载')).toBeVisible();
  await expect(page.getByText('面板 4：已加载')).toBeVisible();

  await page.getByRole('button', { name: '切换到 2011' }).click();
  await page.getByRole('button', { name: '播放变化' }).click();
  await expect(page.getByText('当前帧：2012')).toBeVisible({ timeout: 4_000 });
  await expect(page.getByText('2012：缺失')).toBeVisible();
  await expect(page.getByText('面板 4：已加载')).toBeVisible();
  await page.getByRole('button', { name: '暂停播放' }).click();

  await page.getByRole('button', { name: '双屏卷帘' }).click();
  await expect(page.getByRole('region', { name: '双期卷帘对比' })).toBeVisible();
});
