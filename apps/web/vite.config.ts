import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

export default defineConfig(({ command }) => {
  const gatewayToken = process.env.OMB_GATEWAY_TOKEN;
  const gatewayPort = Number(process.env.OMB_GATEWAY_PORT ?? '4174');
  if (command === 'serve' && !gatewayToken) throw new Error('OMB_GATEWAY_TOKEN is required for the local API proxy');
  if (command === 'serve' && (!Number.isInteger(gatewayPort) || gatewayPort < 1 || gatewayPort > 65_535)) {
    throw new Error('OMB_GATEWAY_PORT must be an integer between 1 and 65535');
  }
  return {
    plugins: [react()],
    build: { chunkSizeWarningLimit: 700 },
    server: {
      host: '127.0.0.1',
      port: 5173,
      allowedHosts: ['127.0.0.1', 'localhost'],
      ...(gatewayToken
        ? {
            proxy: {
              '/api': {
                target: `http://127.0.0.1:${gatewayPort}`,
                changeOrigin: true,
                headers: {
                  authorization: `Bearer ${gatewayToken}`,
                  'x-omb-csrf': '1',
                },
              },
            },
          }
        : {}),
    },
  };
});
