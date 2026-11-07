import { APPLICATION_MESSAGES, HR_POSITION_MESSAGES } from '@org/shared';
import { en } from './en';
import { vi } from './vi';

/** Structure only: object keys (sorted) and array lengths, every leaf replaced by its type */
function shape(value: unknown): unknown {
  if (Array.isArray(value)) return value.map(shape);
  if (value && typeof value === 'object') {
    return Object.fromEntries(
      Object.entries(value)
        .sort(([a], [b]) => a.localeCompare(b))
        .map(([key, child]) => [key, shape(child)]),
    );
  }
  return typeof value;
}

/** [path, text] of every string leaf */
function leaves(value: unknown, path = ''): [string, string][] {
  if (typeof value === 'string') return [[path, value]];
  if (value && typeof value === 'object') {
    return Object.entries(value).flatMap(([key, child]) => leaves(child, path ? `${path}.${key}` : key));
  }
  return [];
}

const placeholders = (text: string) => [...text.matchAll(/\{(\w+)\}/g)].map((m) => m[1]).sort();

describe('dictionaries (AC-13, AC-15)', () => {
  it('vi has exactly the same keys and list lengths as en', () => {
    expect(shape(vi)).toEqual(shape(en));
  });

  it('has no empty text', () => {
    for (const [path, text] of [...leaves(en), ...leaves(vi)]) {
      expect(`${path}: ${text.trim()}`).not.toBe(`${path}: `);
    }
  });

  it('uses the same {placeholders} in both languages', () => {
    const viTexts = new Map(leaves(vi));
    for (const [path, text] of leaves(en)) {
      expect([path, placeholders(viTexts.get(path) ?? '')]).toEqual([path, placeholders(text)]);
    }
  });

  it('translates every API error code; English reuses the shared messages', () => {
    expect(Object.keys(vi.applicationMessages).sort()).toEqual(Object.keys(APPLICATION_MESSAGES).sort());
    expect(en.applicationMessages).toEqual(APPLICATION_MESSAGES);
  });

  it('translates every code of the HR positions / catalog API (hr-positions AC-18); English reuses the shared messages', () => {
    expect(Object.keys(vi.hrPositions.errors).sort()).toEqual(Object.keys(HR_POSITION_MESSAGES).sort());
    expect(en.hrPositions.errors).toEqual(HR_POSITION_MESSAGES);
  });
});
