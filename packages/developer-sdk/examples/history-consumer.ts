import { OpenMapBridgeClient, parseDeveloperAppManifest } from '../src/index.js';

const manifest = parseDeveloperAppManifest({
  schemaVersion: 1,
  id: 'org.openmapbridge.history-example',
  name: 'Historical imagery example',
  apiVersion: 'v1',
  requiredCapabilities: ['metadata', 'temporal-catalog', 'tiles'],
  permissions: ['read-source-metadata', 'read-temporal-catalog', 'read-tiles'],
});

export async function discoverHistoricalFrames(gatewayToken: string, baseUrl = 'http://127.0.0.1:4174') {
  const client = new OpenMapBridgeClient({ baseUrl, manifest, gatewayToken });
  const sources = await client.listSources();
  const source = sources.find(
    (candidate) =>
      candidate.capabilities.includes('temporal-catalog') && candidate.capabilities.includes('tiles'),
  );
  if (!source) return { status: 'needs-runtime-binding' as const, sources };

  const dates = await client.listDates(source, {
    aoiId: 'baoying-lake',
    from: '2006-01-01',
    to: '2025-12-31',
  });
  const first = dates.find((date) => date.availability === 'available');
  const firstTile = first
    ? await client.fetchTile(source, { dateId: first.id, z: 8, x: 212, y: 102 })
    : null;
  return {
    status: 'ready' as const,
    source,
    dates,
    firstTile: firstTile ? { contentType: firstTile.contentType, byteLength: firstTile.body.byteLength } : null,
  };
}
