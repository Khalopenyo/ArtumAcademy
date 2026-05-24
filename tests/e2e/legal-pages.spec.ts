import { expect, test } from '@playwright/test';

/**
 * Smoke tests for /privacy and /oferta (LEGAL-01, LEGAL-02).
 *
 * Verifies:
 *   - Page returns 200
 *   - Russian H1 heading visible
 *   - Version label «Версия 1.0-draft» rendered (proves LEGAL_POLICY_VERSION wired)
 *   - At least one [TODO: юрист-ревью] marker visible inline (proves draft state)
 */

test('GET /privacy renders Russian 152-ФЗ draft with version label and TODO markers', async ({
  page,
}) => {
  const response = await page.goto('/privacy');
  expect(response?.status()).toBe(200);

  await expect(
    page.getByRole('heading', {
      name: /Политика обработки персональных данных/i,
      level: 1,
    }),
  ).toBeVisible();

  await expect(page.getByText(/Версия 1\.0-draft/i)).toBeVisible();
  await expect(page.getByText(/юрист-ревью/i).first()).toBeVisible();
});

test('GET /oferta renders Russian публичная оферта draft with version label and TODO markers', async ({
  page,
}) => {
  const response = await page.goto('/oferta');
  expect(response?.status()).toBe(200);

  await expect(
    page.getByRole('heading', {
      name: /Публичная оферта/i,
      level: 1,
    }),
  ).toBeVisible();

  await expect(page.getByText(/Версия 1\.0-draft/i)).toBeVisible();
  await expect(page.getByText(/юрист-ревью/i).first()).toBeVisible();
});
