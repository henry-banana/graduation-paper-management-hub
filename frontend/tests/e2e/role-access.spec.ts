import { expect, test } from '@playwright/test';
import type { Page } from '@playwright/test';
import {
  seedRoleSession,
  type AccountRole,
  type UiRole,
} from './helpers/role-session';

async function setAuthCookies(
  page: Page,
  accountRole: AccountRole,
  uiRole: UiRole,
) {
  const baseURL = test.info().project.use.baseURL as string;

  await seedRoleSession(page, baseURL, accountRole, uiRole);
}

async function expectRoute(page: Page, route: string) {
  await page.goto(route);
  await expect(page).toHaveURL(new RegExp(`${route.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}$`));
}

async function expectRedirectTo(
  page: Page,
  route: string,
  redirectedTo: string,
) {
  await page.goto(route);
  await expect(page).toHaveURL(new RegExp(`${redirectedTo.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}$`));
}

test.describe('role access matrix', () => {
  test('STUDENT can access only student routes', async ({ page }) => {
    await setAuthCookies(page, 'STUDENT', 'STUDENT');

    await expectRoute(page, '/student/notifications');
    await expectRoute(page, '/student/topics');
    await expectRedirectTo(page, '/gvhd/pending', '/student/notifications');
  });

  test('TBM can access TBM/shared routes and is blocked from student area', async ({ page }) => {
    await setAuthCookies(page, 'TBM', 'TBM');

    await expectRoute(page, '/tbm/periods');
    await expectRoute(page, '/tbm/assignments');
    await expectRoute(page, '/exports');
    await expectRoute(page, '/profile');
    await expectRoute(page, '/settings');
    await expectRoute(page, '/notifications');
    await expectRedirectTo(page, '/student/notifications', '/tbm/periods');
  });

  test('LECTURER generic role can access GVHD and GVPB sections', async ({ page }) => {
    await setAuthCookies(page, 'LECTURER', 'LECTURER');

    await expectRoute(page, '/gvhd/pending');
    await expectRoute(page, '/gvpb/reviews');
    await expectRoute(page, '/profile');
    await expectRedirectTo(page, '/tbm/periods', '/gvhd/pending');
  });

  test('GVHD role is restricted to GVHD/shared routes', async ({ page }) => {
    await setAuthCookies(page, 'LECTURER', 'GVHD');

    await expectRoute(page, '/gvhd/pending');
    await expectRoute(page, '/gvhd/topics');
    await expectRoute(page, '/notifications');
    await expectRedirectTo(page, '/gvpb/reviews', '/gvhd/pending');
  });

  test('GVPB role is restricted to GVPB/shared routes', async ({ page }) => {
    await setAuthCookies(page, 'LECTURER', 'GVPB');

    await expectRoute(page, '/gvpb/reviews');
    await expectRoute(page, '/notifications');
    await expectRoute(page, '/profile');
    await expectRedirectTo(page, '/gvhd/pending', '/gvpb/reviews');
  });

  test('TV_HD role is restricted to council scoring/shared routes', async ({ page }) => {
    await setAuthCookies(page, 'LECTURER', 'TV_HD');

    await expectRoute(page, '/council/scoring');
    await expectRoute(page, '/notifications');
    await expectRedirectTo(page, '/gvhd/pending', '/council/scoring');
  });

  test('TK_HD role is restricted to council summary/shared routes', async ({ page }) => {
    await setAuthCookies(page, 'LECTURER', 'TK_HD');

    await expectRoute(page, '/council/summary');
    await expectRoute(page, '/profile');
    await expectRedirectTo(page, '/gvpb/reviews', '/council/summary');
  });

  test('CT_HD role is restricted to final confirm/shared routes', async ({ page }) => {
    await setAuthCookies(page, 'LECTURER', 'CT_HD');

    await expectRoute(page, '/council/final-confirm');
    await expectRoute(page, '/settings');
    await expectRedirectTo(page, '/gvpb/reviews', '/council/final-confirm');
  });

  test('role home redirect from root path works for all roles', async ({ page }) => {
    const matrix: Array<{ accountRole: AccountRole; uiRole: UiRole; home: string }> = [
      { accountRole: 'STUDENT', uiRole: 'STUDENT', home: '/student/notifications' },
      { accountRole: 'TBM', uiRole: 'TBM', home: '/tbm/periods' },
      { accountRole: 'LECTURER', uiRole: 'LECTURER', home: '/gvhd/pending' },
      { accountRole: 'LECTURER', uiRole: 'GVHD', home: '/gvhd/pending' },
      { accountRole: 'LECTURER', uiRole: 'GVPB', home: '/gvpb/reviews' },
      { accountRole: 'LECTURER', uiRole: 'TV_HD', home: '/council/scoring' },
      { accountRole: 'LECTURER', uiRole: 'TK_HD', home: '/council/summary' },
      { accountRole: 'LECTURER', uiRole: 'CT_HD', home: '/council/final-confirm' },
    ];

    for (const row of matrix) {
      await setAuthCookies(page, row.accountRole, row.uiRole);
      await page.goto('/');
      await expect(page).toHaveURL(new RegExp(`${row.home.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}$`));
    }
  });
});
