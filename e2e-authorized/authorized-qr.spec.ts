import { expect, test } from '@playwright/test';

const authorizedQr = process.env.OMB_ACCEPTANCE_QR;
if (!authorizedQr) throw new Error('OMB_ACCEPTANCE_QR is required for the authorized local QR gate');

test('decodes the user-authorized real QR image into a safe preview without confirmation', async ({ page }) => {
  await page.goto('/');
  const inspect = page.waitForResponse((response) =>
    response.url().endsWith('/api/import/inspect/qr') && response.request().method() === 'POST',
  );
  await page.getByLabel('选择二维码图片').setInputFiles(authorizedQr);
  const response = await inspect;
  const allowed = new Set(['t', 'id', 'na', 'po', 'he', 'oy', 'df', 'hn', 'ul', 'at', 'ad', 'al']);
  const posted = JSON.parse(response.request().postData() ?? '{}') as { payload?: string };
  const structuralKeys = (posted.payload ?? '')
    .slice((posted.payload ?? '').indexOf('?') + 1)
    .split('&')
    .map((part) => decodeURIComponent((part.split('=', 1)[0] ?? '').replace(/\+/g, ' ')));
  const structuralParams = new URLSearchParams((posted.payload ?? '').slice((posted.payload ?? '').indexOf('?') + 1));
  const urlTemplate = structuralParams.get('ul') ?? '';
  const diagnostic = response.status() === 200 ? '' : JSON.stringify({
    response: await response.json(),
    unknownKeys: structuralKeys.filter((key) => !allowed.has(key)),
    keyCount: structuralKeys.length,
    urlTemplateShape: {
      length: urlTemplate.length,
      startsSlash: urlTemplate.startsWith('/'),
      looksHttp: /^https?:\/\//i.test(urlTemplate),
      hasQuestion: urlTemplate.includes('?'),
      hasTileVariables: /\{\$[xyz]/.test(urlTemplate),
    },
  });
  expect(response.status(), diagnostic).toBe(200);
  await expect(page.getByRole('heading', { name: /发现 \d+ 个图层/ })).toBeVisible();
  await expect(page.getByText('解析器 ovi-query-v1')).toBeVisible();
  await expect(page.getByText(/不透明的奥维协议配置/)).toBeVisible();
  await expect(page.getByLabel('我确认有权使用所选图源')).not.toBeChecked();
});

test('opens the local public compatibility ovmap as five layers without contacting its hosts', async ({ page }) => {
  await page.goto('/');
  await page.getByRole('button', { name: '.ovmap 文件' }).click();
  await page.getByLabel('选择 .ovmap 文件').setInputFiles('fixtures/local/tencent-5.ovmap');
  await expect(page.getByRole('heading', { name: '发现 5 个图层' })).toBeVisible();
  await expect(page.getByText('腾讯卫星地图')).toBeVisible();
  await expect(page.getByText('腾讯地形图小字体')).toBeVisible();
  await expect(page.getByLabel('我确认有权使用所选图源')).not.toBeChecked();
});
