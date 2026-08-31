import { expect, it } from 'vitest';
import { parseCredentialBundle } from './credential.js';

it('accepts bounded query and header credentials without transforming values', () => {
  const bundle = parseCredentialBundle({
    fields: [
      { placement: 'query', name: 'api_key', value: 'fixture-value' },
      { placement: 'header', name: 'Authorization', value: 'Bearer fixture' },
    ],
  });
  expect(bundle.fields).toHaveLength(2);
  expect(bundle.fields[1]?.value).toBe('Bearer fixture');
});

it.each([
  { fields: [] },
  { fields: [{ placement: 'query', name: 'bad name', value: 'value' }] },
  { fields: [{ placement: 'header', name: 'Authorization', value: 'line\r\nbreak' }] },
  { fields: [{ placement: 'query', name: 'token', value: 'x'.repeat(4097) }] },
  {
    fields: [
      { placement: 'header', name: 'Authorization', value: 'first' },
      { placement: 'header', name: 'authorization', value: 'second' },
    ],
  },
])('rejects an unsafe credential bundle %#', (value) => {
  expect(() => parseCredentialBundle(value)).toThrow();
});
