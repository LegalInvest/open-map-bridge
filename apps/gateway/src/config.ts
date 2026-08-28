export interface OviBridgeConfig {
  baseUrl: string;
  mapType: number;
  sourceId: string;
}

export function parseOviBridgeConfig(environment: NodeJS.ProcessEnv): OviBridgeConfig | undefined {
  const portValue = environment.OMB_OVI_PORT;
  const mapTypeValue = environment.OMB_OVI_MAP_TYPE;
  const sourceId = environment.OMB_OVI_SOURCE_ID;
  const configuredCount = [portValue, mapTypeValue, sourceId].filter(Boolean).length;
  if (configuredCount > 0 && configuredCount < 3) {
    throw new Error('OMB_OVI_PORT, OMB_OVI_MAP_TYPE, and OMB_OVI_SOURCE_ID must be configured together');
  }
  if (!portValue || !mapTypeValue || !sourceId) return undefined;

  const port = Number(portValue);
  const mapType = Number(mapTypeValue);
  if (!Number.isInteger(port) || port < 1 || port > 65_535) {
    throw new Error('OMB_OVI_PORT must be an integer between 1 and 65535');
  }
  if (!Number.isInteger(mapType) || mapType < 1) {
    throw new Error('OMB_OVI_MAP_TYPE must be a positive integer');
  }
  if (!/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(sourceId)) {
    throw new Error('OMB_OVI_SOURCE_ID must be a UUID');
  }
  return { baseUrl: `http://127.0.0.1:${port}`, mapType, sourceId };
}
