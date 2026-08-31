import { z } from 'zod';

export type CredentialPlacement = 'query' | 'header';

export interface CredentialField {
  placement: CredentialPlacement;
  name: string;
  value: string;
}

export interface CredentialBundle {
  fields: CredentialField[];
}

const queryName = /^[A-Za-z0-9._~-]{1,128}$/;
const headerName = /^[!#$%&'*+.^_`|~0-9A-Za-z-]{1,128}$/;

export const credentialFieldSchema = z
  .object({
    placement: z.enum(['query', 'header']),
    name: z.string().min(1).max(128),
    value: z.string().min(1).max(4096),
  })
  .strict()
  .superRefine((field, context) => {
    const pattern = field.placement === 'query' ? queryName : headerName;
    if (!pattern.test(field.name)) {
      context.addIssue({ code: 'custom', path: ['name'], message: `${field.placement} credential name is invalid` });
    }
    if (/[\u0000\r\n]/.test(field.value)) {
      context.addIssue({ code: 'custom', path: ['value'], message: 'credential value contains a forbidden control character' });
    }
  });

export const credentialBundleSchema = z
  .object({ fields: z.array(credentialFieldSchema).min(1).max(16) })
  .strict()
  .superRefine((bundle, context) => {
    const seen = new Set<string>();
    let bytes = 0;
    for (const [index, field] of bundle.fields.entries()) {
      const identity = `${field.placement}:${field.placement === 'header' ? field.name.toLowerCase() : field.name}`;
      if (seen.has(identity)) {
        context.addIssue({ code: 'custom', path: ['fields', index, 'name'], message: 'credential field is duplicated' });
      }
      seen.add(identity);
      bytes += new TextEncoder().encode(field.name).byteLength + new TextEncoder().encode(field.value).byteLength;
    }
    if (bytes > 16_384) context.addIssue({ code: 'custom', message: 'credential bundle exceeds 16 KiB' });
  });

export function parseCredentialBundle(value: unknown): CredentialBundle {
  return credentialBundleSchema.parse(value) as CredentialBundle;
}
