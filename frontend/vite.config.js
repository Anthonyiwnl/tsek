import react from "@vitejs/plugin-react";
import { defineConfig, loadEnv } from "vite";
import handler from "./api/services.js";
/** Create a Vite plugin that serves the sample services handler during development and preview. */
function sampleApi() {
  /** Route service requests to the sample handler and pass other requests to the next middleware. */
  const middleware = (req, res, next) => {
    if (req.url.split("?")[0] !== "/api/services") return next();
    res.status = (code) => {
      res.statusCode = code;
      return res;
    };
    res.json = (data) => {
      res.setHeader("Content-Type", "application/json");
      res.end(JSON.stringify(data));
    };
    handler(req, res);
  };
  return {
    name: "tsek-sample-api",
    /** Register the sample API middleware on the Vite development server. */
    configureServer(server) {
      server.middlewares.use(middleware);
    },
    /** Register the sample API middleware on the Vite preview server. */
    configurePreviewServer(server) {
      server.middlewares.use(middleware);
    },
  };
}
export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, process.cwd(), '');
  const target = env.BACKEND_PROXY_TARGET || 'http://127.0.0.1:3000';
  const url = new URL(target);
  if (url.username || url.password || (url.protocol !== 'https:' && !(url.protocol === 'http:' && ['localhost', '127.0.0.1', '[::1]'].includes(url.hostname)))) throw new Error('Invalid BACKEND_PROXY_TARGET');
  const proxy = Object.fromEntries(['/api/document-types', '/api/applications'].map(path => [path, { target, changeOrigin: true }]));
  return { plugins: [react(), sampleApi()], server: { proxy }, preview: { proxy } };
});
