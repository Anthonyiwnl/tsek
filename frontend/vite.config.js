import react from "@vitejs/plugin-react";
import { defineConfig, loadEnv } from "vite";

export function backendProxyTarget(value = "http://127.0.0.1:3000") {
  const url = new URL(value);
  const loopback = ['localhost', '127.0.0.1', '[::1]'].includes(url.hostname);
  if (url.username || url.password || (url.protocol !== 'https:' && !(url.protocol === 'http:' && loopback))) {
    throw new Error('BACKEND_PROXY_TARGET must use HTTPS, or HTTP on a loopback host.');
  }
  return url.href;
}

export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, process.cwd(), "");
  const proxy = { "/api": {
    target: backendProxyTarget(env.BACKEND_PROXY_TARGET || undefined),
    changeOrigin: true,
  } };
  return { plugins: [react()], server: { proxy }, preview: { proxy } };
});
