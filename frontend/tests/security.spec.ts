// Real FastAPI + PostgreSQL + local SMTP. Run via backend/tests/browser_test.py.
import { test, expect } from '@playwright/test';
import { readFileSync } from 'node:fs';

const password = process.env.AJR_E2E_PASSWORD!;
const mailbox = process.env.AJR_E2E_MAILBOX!;
async function latestCode(destination: string) {
  let code = '';
  await expect.poll(() => {
    const messages = JSON.parse(readFileSync(mailbox, 'utf8')) as { to: string; code: string }[];
    code = messages.filter(m => m.to === destination && m.code).at(-1)?.code ?? '';
    return code.length;
  }).toBe(6);
  return code;
}
for (const mobile of [false, true]) {
  test(`backup lifecycle through real API (${mobile ? 'mobile EN' : 'desktop ES'})`, async ({ page, request }) => {
    if (mobile) await page.setViewportSize({ width: 390, height: 844 });
    const email = mobile ? 'mobile@example.com' : 'desktop@example.com';
    const response = await request.post('http://127.0.0.1:8000/api/auth/register', { data: { email, password, first_name: 'Test', last_name: 'Account' } });
    expect(response.status()).toBe(201);
    const { access_token } = await response.json();
    await page.addInitScript(({ token, lang }) => {
      localStorage.setItem('ajrdata_token', token);
      localStorage.setItem('ajrdata_lang', lang);
    }, { token: access_token, lang: mobile ? 'en' : 'es' });
    await page.goto('/cuenta/seguridad');
    await expect(page.getByRole('heading', { name: mobile ? 'Account security' : 'Seguridad de la cuenta' })).toBeVisible();
    await expect(page.getByRole('heading', { name: mobile ? 'No backup email' : 'Sin correo de respaldo' })).toBeVisible();
    await page.locator('#backup-password').fill('wrong-password');
    const backup = `${mobile ? 'm' : 'd'}.backup@example.com`;
    await page.locator('#backup-address').fill(backup);
    await page.getByRole('button', { name: mobile ? 'Send code' : 'Enviar código', exact: true }).click();
    await expect(page.getByRole('alert')).toContainText(mobile ? 'Your current password is incorrect.' : 'La contraseña actual no es correcta.');
    await expect(page.locator('#backup-address')).toHaveValue(backup);
    await page.locator('#backup-password').fill(password);
    await page.getByRole('button', { name: mobile ? 'Send code' : 'Enviar código', exact: true }).click();
    await expect(page.getByRole('heading', { name: mobile ? 'Pending verification' : 'Pendiente de verificación', exact: true })).toBeVisible();
    const previousCode = await latestCode(backup);
    await page.locator('#backup-password').fill(password);
    await page.getByRole('button', { name: mobile ? 'Resend code' : 'Reenviar código', exact: true }).click();
    await expect(page.getByRole('status')).toContainText(mobile ? 'We sent a new code.' : 'Enviamos un nuevo código.');
    const resentCode = await latestCode(backup);
    expect(resentCode).not.toBe(previousCode);
    await page.locator('#backup-code').fill(resentCode);
    await page.getByRole('button', { name: mobile ? 'Verify code' : 'Verificar código', exact: true }).click();
    await expect(page.getByRole('heading', { name: mobile ? 'Verified backup email' : 'Correo de respaldo verificado', exact: true })).toBeVisible();
    // Replacement remains pending while previous verified method stays visible.
    await page.locator('#backup-password').fill(password);
    const replacement = `${mobile ? 'm' : 'd'}.replacement@example.com`;
    await page.locator('#backup-address').fill(replacement);
    await page.getByRole('button', { name: mobile ? 'Verify a new address' : 'Verificar un nuevo correo' }).click();
    await expect(page.getByText(backup, { exact: true })).toBeVisible();
    await page.locator('#backup-code').fill(await latestCode(replacement));
    await page.getByRole('button', { name: mobile ? 'Verify code' : 'Verificar código', exact: true }).click();
    await expect(page.getByText(replacement, { exact: true })).toBeVisible();
    await page.evaluate(() => window.scrollTo(0, 0));
    if (process.env.AJR_E2E_SCREENSHOTS) await page.screenshot({ path: `${process.env.AJR_E2E_SCREENSHOTS}/${mobile ? 'mobile' : 'desktop'}.png`, fullPage: true });
    await page.reload();
    await expect(page.getByText(replacement, { exact: true })).toBeVisible();
    await expect(page.getByRole('button', { name: mobile ? 'Remove and cancel pending verification' : 'Eliminar y cancelar pendientes' })).toBeDisabled();
    await page.locator('#backup-password').fill(password);
    await page.getByRole('checkbox').check();
    await page.getByRole('button', { name: mobile ? 'Remove and cancel pending verification' : 'Eliminar y cancelar pendientes' }).click();
    await expect(page.getByRole('heading', { name: mobile ? 'No backup email' : 'Sin correo de respaldo', exact: true })).toBeVisible();
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true);
    const me = await request.get('http://127.0.0.1:8000/api/auth/me', { headers: { Authorization: `Bearer ${access_token}` } });
    expect((await me.json()).email).toBe(email);
    // Existing account route remains usable and no raw translation keys appear.
    await page.getByRole('link', { name: mobile ? 'Back to my account' : 'Volver a mi cuenta' }).click();
    await expect(page).toHaveURL(/\/cuenta$/);
    await expect(page.locator('body')).not.toContainText('security.');
  });
}
