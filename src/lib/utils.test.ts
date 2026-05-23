import { describe, it, expect } from 'vitest';
import { formatPrice, cn } from './utils';

describe('formatPrice', () => {
  it('форматирует целое число в рубли', () => {
    expect(formatPrice(19900)).toMatch(/19\s?900/);
  });

  it('не отображает копейки для целых сумм', () => {
    expect(formatPrice(4900)).not.toContain(',00');
  });
});

describe('cn', () => {
  it('объединяет классы строкой', () => {
    expect(cn('a', 'b')).toBe('a b');
  });

  it('фильтрует falsy значения', () => {
    expect(cn('a', false, null, undefined, 'b')).toBe('a b');
  });

  it('разрешает Tailwind-конфликты в пользу последнего', () => {
    expect(cn('p-2', 'p-4')).toBe('p-4');
  });
});
