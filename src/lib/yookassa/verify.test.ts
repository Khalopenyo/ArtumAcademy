import { describe, it, expect } from 'vitest';

import {
  parseWebhookEvent,
  mapYookassaStatus,
  isValidWebhookSecret,
  yookassaAmountToMinor,
  amountsMatch,
  minorToYookassaValue,
} from './verify';

describe('mapYookassaStatus', () => {
  it('маппит статусы YooKassa в наши', () => {
    expect(mapYookassaStatus('succeeded')).toBe('succeeded');
    expect(mapYookassaStatus('canceled')).toBe('canceled');
    expect(mapYookassaStatus('pending')).toBe('pending');
    expect(mapYookassaStatus('waiting_for_capture')).toBe('pending');
    expect(mapYookassaStatus('что-то новое')).toBe('pending');
  });
});

describe('isValidWebhookSecret', () => {
  const expected = 'a'.repeat(40);
  it('пропускает только точное совпадение', () => {
    expect(isValidWebhookSecret(expected, expected)).toBe(true);
  });
  it('отклоняет неверный/пустой/несовпадающий по длине', () => {
    expect(isValidWebhookSecret('b'.repeat(40), expected)).toBe(false);
    expect(isValidWebhookSecret('a'.repeat(39), expected)).toBe(false);
    expect(isValidWebhookSecret('', expected)).toBe(false);
    expect(isValidWebhookSecret(undefined, expected)).toBe(false);
    expect(isValidWebhookSecret(expected, '')).toBe(false);
  });
});

describe('amount helpers', () => {
  it('конвертит рубли в копейки', () => {
    expect(yookassaAmountToMinor({ value: '990.00' })).toBe(99000);
    expect(yookassaAmountToMinor({ value: '1.50' })).toBe(150);
    expect(yookassaAmountToMinor(undefined)).toBeNull();
    expect(yookassaAmountToMinor({ value: 'abc' })).toBeNull();
  });
  it('копейки в строку YooKassa', () => {
    expect(minorToYookassaValue(99000)).toBe('990.00');
    expect(minorToYookassaValue(150)).toBe('1.50');
    expect(minorToYookassaValue(0)).toBe('0.00');
  });
  it('сверяет ожидаемую сумму с фактической (анти-подмена цены)', () => {
    expect(amountsMatch(99000, { value: '990.00' })).toBe(true);
    expect(amountsMatch(99000, { value: '1.00' })).toBe(false);
    expect(amountsMatch(99000, undefined)).toBe(false);
  });
});

describe('parseWebhookEvent', () => {
  it('парсит валидное событие', () => {
    const ev = parseWebhookEvent({
      event: 'payment.succeeded',
      object: { id: 'pay_123', status: 'succeeded', amount: { value: '990.00', currency: 'RUB' }, metadata: { payment_id: 'uuid' } },
    });
    expect(ev?.object.id).toBe('pay_123');
    expect(ev?.object.metadata?.payment_id).toBe('uuid');
  });
  it('возвращает null на мусоре', () => {
    expect(parseWebhookEvent({ foo: 'bar' })).toBeNull();
    expect(parseWebhookEvent(null)).toBeNull();
    expect(parseWebhookEvent({ event: 'x', object: { id: '' } })).toBeNull();
  });
});
