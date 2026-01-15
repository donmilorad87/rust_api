import { test, expect } from '@playwright/test';

async function signIn(page: any) {
  await page.goto('/sign-in');
  await page.waitForLoadState('networkidle');
  await page.fill('#email', 'djmyle@gmail.com');
  await page.fill('#password', 'asdqwE123~~');
  await page.click('#signinBtn');
  await page.waitForTimeout(2000);
}

function buildPageUrl(baseUrl: string, pagePath: string) {
  const trimmedBase = baseUrl?.endsWith('/') ? baseUrl.slice(0, -1) : baseUrl;
  const trimmedPath = pagePath?.startsWith('/') ? pagePath : `/${pagePath}`;
  if (!trimmedPath || trimmedPath === '/') {
    return trimmedBase || '';
  }
  return trimmedBase ? `${trimmedBase}${trimmedPath}` : trimmedPath;
}

test.describe('Admin Theme SEO Schemas', () => {
  test('defaults @id field to page address + #schemaType', async ({ page }) => {
    await signIn(page);
    await page.goto('/admin/theme');
    await page.waitForLoadState('networkidle');

    await page.locator('.theme-tabs__tab[data-tab="seo"]').click();
    await page.waitForFunction(() => {
      return window.themeConfig && Array.isArray(window.themeConfig.seoPages);
    });

    const seoPageCount = await page.evaluate(() => window.themeConfig?.seoPages?.length || 0);
    if (seoPageCount === 0) {
      await page.click('#seoAddPageBtn');
      await page.waitForSelector('#seoPageModal:not(.hidden)');
      await page.fill('#seoPageRouteName', 'web.sign_in');
      await page.fill('#seoPageLabel', 'Sign In');
      await page.click('#seoPageSaveBtn');
    }

    await page.waitForSelector('#seoPageItems .seo-page-list__item');
    await page.locator('#seoPageItems .seo-page-list__item').first().click();
    await expect(page.locator('#seoContent')).toBeVisible();
    await page.waitForFunction(() => {
      const el = document.getElementById('seoPagePath');
      return el && el.textContent && el.textContent.trim() !== '/path';
    });

    await page.locator('.seo-subtab[data-subtab="schemas"]').click();
    await page.click('#addSchemaBtn');

    await page.selectOption('#schemaTypeSelect', 'Organization');

    const idInput = page.locator('.schema-fields input[data-field="@id"]');
    await expect(idInput).toBeVisible();

    const pagePath = (await page.locator('#seoPagePath').textContent())?.trim() || '';
    const baseUrl = await page.evaluate(() => window.BASE_URL || '');
    const pageUrl = buildPageUrl(baseUrl, pagePath);
    const expectedId = pageUrl ? `${pageUrl}#Organization` : '#Organization';

    await expect(idInput).toHaveValue(expectedId);
  });
});
