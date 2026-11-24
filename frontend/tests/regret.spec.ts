// Lógica pura del botón de arrepentimiento (sin navegador ni backend).
import { test, expect } from '@playwright/test';
import { canRegret, regretDeadline } from '../src/lib/regret';

const created = '2026-11-01T12:00:00Z';
const at = (iso: string) => Date.parse(iso);

test('habilitado con menos de 10 días corridos', () => {
  expect(canRegret(created, at('2026-11-10T11:59:00Z'))).toBe(true);
});
test('deshabilitado desde el día 10 en adelante', () => {
  expect(canRegret(created, at('2026-11-11T12:00:00Z'))).toBe(false);
});
test('deshabilitado si ya se arrepintió', () => {
  expect(canRegret(created, at('2026-11-02T00:00:00Z'), '2026-11-02T00:00:00Z')).toBe(false);
});
test('el plazo vence a los 10 días exactos', () => {
  expect(regretDeadline(created).toISOString()).toBe('2026-11-11T12:00:00.000Z');
});
