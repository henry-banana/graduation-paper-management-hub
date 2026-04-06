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

async function expectSidebarLinkVisible(
  page: Page,
  name: string,
) {
  await expect(page.locator('aside').getByRole('link', { name })).toBeVisible();
}

async function expectSidebarLinkHidden(
  page: Page,
  name: string,
) {
  await expect(page.locator('aside').getByRole('link', { name })).toHaveCount(0);
}

test.describe('role navigation matrix', () => {
  test('STUDENT sees student navigation only', async ({ page }) => {
    await setAuthCookies(page, 'STUDENT', 'STUDENT');
    await page.goto('/student/notifications');

    await expectSidebarLinkVisible(page, 'Đăng ký đề tài');
    await expectSidebarLinkVisible(page, 'Đề tài của tôi');
    await expectSidebarLinkHidden(page, 'Quản lý đợt');
    await expectSidebarLinkHidden(page, 'Hồ sơ phản biện');
  });

  test('TBM sees TBM navigation only', async ({ page }) => {
    await setAuthCookies(page, 'TBM', 'TBM');
    await page.goto('/tbm/periods');

    await expectSidebarLinkVisible(page, 'Quản lý đợt');
    await expectSidebarLinkVisible(page, 'Phân công hội đồng');
    await expectSidebarLinkVisible(page, 'Lịch sử xuất file');
    await expectSidebarLinkHidden(page, 'Đăng ký đề tài');
    await expectSidebarLinkHidden(page, 'Tiến độ hướng dẫn');
  });

  test('LECTURER generic without reviewer capability sees GVHD entries only', async ({ page }) => {
    await setAuthCookies(page, 'LECTURER', 'LECTURER');
    await page.goto('/gvhd/pending');

    await expectSidebarLinkVisible(page, 'Duyệt đề tài');
    await expectSidebarLinkVisible(page, 'Tiến độ hướng dẫn');
    await expectSidebarLinkVisible(page, 'Chấm điểm (Rubric)');
    await expectSidebarLinkVisible(page, 'Xác nhận điểm cuối');
    await expectSidebarLinkHidden(page, 'Hồ sơ phản biện');
    await expectSidebarLinkHidden(page, 'Quản lý đợt');
  });

  test('GVHD sees only GVHD navigation', async ({ page }) => {
    await setAuthCookies(page, 'LECTURER', 'GVHD');
    await page.goto('/gvhd/pending');

    await expectSidebarLinkVisible(page, 'Duyệt đề tài');
    await expectSidebarLinkVisible(page, 'Tiến độ hướng dẫn');
    await expectSidebarLinkVisible(page, 'Chấm điểm (Rubric)');
    await expectSidebarLinkVisible(page, 'Xác nhận điểm cuối');
    await expectSidebarLinkHidden(page, 'Hồ sơ phản biện');
    await expectSidebarLinkHidden(page, 'Quản lý đợt');
  });

  test('GVPB sees only GVPB navigation', async ({ page }) => {
    await setAuthCookies(page, 'LECTURER', 'GVPB');
    await page.goto('/gvpb/reviews');

    await expectSidebarLinkVisible(page, 'Hồ sơ phản biện');
    await expectSidebarLinkVisible(page, 'Thông báo');
    await expectSidebarLinkHidden(page, 'Tiến độ hướng dẫn');
    await expectSidebarLinkHidden(page, 'Quản lý đợt');
  });

  test('TV_HD sees only council scoring entry', async ({ page }) => {
    await setAuthCookies(page, 'LECTURER', 'TV_HD');
    await page.goto('/council/scoring');

    await expectSidebarLinkVisible(page, 'Chấm điểm HĐ');
    await expectSidebarLinkHidden(page, 'Tổng hợp điểm');
    await expectSidebarLinkHidden(page, 'Xác nhận công bố');
  });

  test('TK_HD sees only council summary entry', async ({ page }) => {
    await setAuthCookies(page, 'LECTURER', 'TK_HD');
    await page.goto('/council/summary');

    await expectSidebarLinkVisible(page, 'Tổng hợp điểm');
    await expectSidebarLinkHidden(page, 'Chấm điểm HĐ');
    await expectSidebarLinkHidden(page, 'Xác nhận công bố');
  });

  test('CT_HD sees only council final confirm entry', async ({ page }) => {
    await setAuthCookies(page, 'LECTURER', 'CT_HD');
    await page.goto('/council/final-confirm');

    await expectSidebarLinkVisible(page, 'Xác nhận công bố');
    await expectSidebarLinkHidden(page, 'Chấm điểm HĐ');
    await expectSidebarLinkHidden(page, 'Tổng hợp điểm');
  });
});
