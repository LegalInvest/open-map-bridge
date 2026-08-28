import { expect, test } from '@playwright/test';
import QRCode from 'qrcode';
import { buildSyntheticRecord37Ovmap } from '@omb/ovmap-codec/synthetic';

test('imports a QR image only after a secret-safe preview and authorization', async ({ page }) => {
  const payload = 'ovobj?t=1&id=402&na=E2E%20QR%20Source&po=1&he=18&oy=3&df=0&hn=tiles.example.invalid&ul=%2F%7B%24z%7D%2F%7B%24x%7D%2F%7B%24y%7D.png';
  const png = await QRCode.toBuffer(payload, { type: 'png', width: 800, margin: 6, errorCorrectionLevel: 'L' });
  await page.goto('/');
  await expect(page.getByRole('heading', { name: '导入奥维兼容图源' })).toBeVisible();
  await page.getByLabel('选择二维码图片').setInputFiles({ name: 'source.png', mimeType: 'image/png', buffer: png });
  await expect(page.getByText('E2E QR Source')).toBeVisible();
  await expect(page.getByText('tiles.example.invalid · ovi-template · png · 投影 unknown')).toBeVisible();
  const confirm = page.getByRole('button', { name: '确认并保存配置' });
  await expect(confirm).toBeDisabled();
  await page.getByLabel('我确认有权使用所选图源').check();
  const confirmed = page.waitForResponse((response) => response.url().endsWith('/api/import/confirm') && response.status() === 201);
  await confirm.click();
  await confirmed;
  await expect(page.getByRole('heading', { name: '已保存配置（尚未探测）' })).toBeVisible();
  await expect(page.locator('.source-registry').getByText('E2E QR Source')).toBeVisible();
  await page.reload();
  await expect(page.locator('.source-registry').getByText('E2E QR Source')).toBeVisible();
});

test('opens one ovmap file as five independently selectable layers', async ({ page }) => {
  const file = buildSyntheticRecord37Ovmap([
    { mapId: 204, maxZoom: 18, name: 'OV A', host: 'a.example.invalid', path: '/{$z}/{$x}/{$y}.jpg', group: 'G' },
    { mapId: 205, maxZoom: 18, name: 'OV B', host: 'b.example.invalid', path: '/{$z}/{$x}/{$y}.png', group: 'G' },
    { mapId: 209, maxZoom: 18, name: 'OV C', host: 'c.example.invalid', path: '/tile?z={$z}&x={$x}&y={$y}', group: 'G' },
    { mapId: 213, maxZoom: 18, name: 'OV D', host: 'd.example.invalid', path: '/{$z}/{$x/16}/{$y/16}.jpg', group: 'G' },
    { mapId: 214, maxZoom: 18, name: 'OV E', host: 'e.example.invalid', path: '/{$z}/{$x}/{$y}.jpg', group: 'G' },
  ]);
  await page.goto('/');
  await page.getByRole('button', { name: '.ovmap 文件' }).click();
  await page.getByLabel('选择 .ovmap 文件').setInputFiles({
    name: 'five-layers.ovmap',
    mimeType: 'application/octet-stream',
    buffer: Buffer.from(file),
  });
  await expect(page.getByRole('heading', { name: '发现 5 个图层' })).toBeVisible();
  for (const name of ['OV A', 'OV B', 'OV C', 'OV D', 'OV E']) await expect(page.getByText(name)).toBeVisible();
  await expect(page.locator('.layer-preview input[type=checkbox]:checked')).toHaveCount(5);
});
