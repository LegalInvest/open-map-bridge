import { z } from 'zod';

export const developerCapabilitySchema = z.enum(['metadata', 'temporal-catalog', 'tiles']);
export type DeveloperCapability = z.infer<typeof developerCapabilitySchema>;

export const developerPermissionSchema = z.enum([
  'read-source-metadata',
  'read-temporal-catalog',
  'read-tiles',
]);
export type DeveloperPermission = z.infer<typeof developerPermissionSchema>;

const localDeveloperPath = z
  .string()
  .min(1)
  .max(1024)
  .refine((value) => value.startsWith('/api/v1/developer/') && !value.includes('?'), 'link must be a local V1 path');

export const developerSourceDescriptorSchema = z
  .object({
    apiVersion: z.literal('v1'),
    id: z.string().min(1).max(128).regex(/^[A-Za-z0-9][A-Za-z0-9._:-]*$/),
    name: z.string().trim().min(1).max(256),
    providerKind: z.enum(['imported', 'synthetic', 'ovi-bridge']),
    protocol: z.enum(['xyz', 'tms', 'wmts', 'wms', 'arcgis', 'ovi-template', 'temporal-adapter']),
    projection: z.union([z.literal('unknown'), z.string().regex(/^EPSG:\d{4,6}$/)]),
    lifecycle: z.enum([
      'received',
      'parsed',
      'confirmed',
      'probed',
      'rendered',
      'saved',
      'invalid',
      'unsupported',
      'blocked',
      'needs-credential',
      'needs-data',
      'probe-failed',
      'render-failed',
      'stale',
      'disabled',
      'configured',
      'ready',
    ]),
    accessStatus: z.enum(['metadata-only', 'ready']),
    capabilities: z.array(developerCapabilitySchema).min(1).max(3),
    datePrecision: z.enum(['capture-date', 'request-date-only']).nullable(),
    attribution: z.string().max(2048).nullable(),
    license: z.string().max(256).nullable(),
    links: z
      .object({
        self: localDeveloperPath,
        dates: localDeveloperPath.optional(),
        tileTemplate: localDeveloperPath.optional(),
      })
      .strict(),
  })
  .strict()
  .superRefine((value, context) => {
    const capabilities = new Set(value.capabilities);
    if (capabilities.size !== value.capabilities.length) {
      context.addIssue({ code: 'custom', path: ['capabilities'], message: 'capabilities must be unique' });
    }
    if (!capabilities.has('metadata')) {
      context.addIssue({ code: 'custom', path: ['capabilities'], message: 'metadata capability is required' });
    }
    const shouldBeReady = capabilities.size > 1;
    if ((value.accessStatus === 'ready') !== shouldBeReady) {
      context.addIssue({ code: 'custom', path: ['accessStatus'], message: 'access status must match capabilities' });
    }
    const hasDates = capabilities.has('temporal-catalog');
    if (hasDates !== (value.links.dates !== undefined) || hasDates !== (value.datePrecision !== null)) {
      context.addIssue({ code: 'custom', path: ['links', 'dates'], message: 'date capability contract is inconsistent' });
    }
    if (capabilities.has('tiles') !== (value.links.tileTemplate !== undefined)) {
      context.addIssue({ code: 'custom', path: ['links', 'tileTemplate'], message: 'tile capability contract is inconsistent' });
    }
  });

export type DeveloperSourceDescriptor = z.infer<typeof developerSourceDescriptorSchema>;

const requiredPermission: Record<DeveloperCapability, DeveloperPermission> = {
  metadata: 'read-source-metadata',
  'temporal-catalog': 'read-temporal-catalog',
  tiles: 'read-tiles',
};

export const developerAppManifestSchema = z
  .object({
    schemaVersion: z.literal(1),
    id: z.string().min(3).max(128).regex(/^[a-z0-9][a-z0-9.-]*$/),
    name: z.string().trim().min(1).max(128),
    apiVersion: z.literal('v1'),
    requiredCapabilities: z.array(developerCapabilitySchema).min(1).max(3),
    permissions: z.array(developerPermissionSchema).min(1).max(3),
  })
  .strict()
  .superRefine((value, context) => {
    if (new Set(value.requiredCapabilities).size !== value.requiredCapabilities.length) {
      context.addIssue({ code: 'custom', path: ['requiredCapabilities'], message: 'capabilities must be unique' });
    }
    if (new Set(value.permissions).size !== value.permissions.length) {
      context.addIssue({ code: 'custom', path: ['permissions'], message: 'permissions must be unique' });
    }
    const permissions = new Set(value.permissions);
    for (const capability of value.requiredCapabilities) {
      const permission = requiredPermission[capability];
      if (!permissions.has(permission)) {
        context.addIssue({ code: 'custom', path: ['permissions'], message: `${permission} is required` });
      }
    }
  });

export type DeveloperAppManifest = z.infer<typeof developerAppManifestSchema>;

export function parseDeveloperSourceDescriptor(value: unknown): DeveloperSourceDescriptor {
  return developerSourceDescriptorSchema.parse(value);
}

export function parseDeveloperAppManifest(value: unknown): DeveloperAppManifest {
  return developerAppManifestSchema.parse(value);
}

export function permissionForCapability(capability: DeveloperCapability): DeveloperPermission {
  return requiredPermission[capability];
}
