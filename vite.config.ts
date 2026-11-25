import { defineConfig, loadEnv, type Plugin } from 'vite';
import react from '@vitejs/plugin-react';
import tailwindcss from '@tailwindcss/vite';
import { handleElevenLabsProxyRequest } from './server/elevenlabsProxy';

function elevenLabsProxyPlugin(serverApiKey: string): Plugin {
  const attachMiddleware = (
    middlewares: {
      use: (
        fn: (
          req: import('node:http').IncomingMessage,
          res: import('node:http').ServerResponse,
          next: () => void
        ) => void
      ) => void;
    }
  ) => {
    middlewares.use((req, res, next) => {
      if (!req.url?.startsWith('/api/tts/')) {
        next();
        return;
      }
      void handleElevenLabsProxyRequest(req, res, { serverApiKey }).then((handled) => {
        if (!handled) next();
      });
    });
  };

  return {
    name: 'pagikata-elevenlabs-tts-proxy',
    configureServer(server) {
      attachMiddleware(server.middlewares);
    },
    configurePreviewServer(server) {
      attachMiddleware(server.middlewares);
    },
  };
}

export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, process.cwd(), '');
  const serverApiKey = env.ELEVENLABS_API_KEY || process.env.ELEVENLABS_API_KEY || '';

  return {
    plugins: [react(), tailwindcss(), elevenLabsProxyPlugin(serverApiKey)],
  };
});
