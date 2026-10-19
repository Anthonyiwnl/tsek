import react from "@vitejs/plugin-react";
import { defineConfig } from "vite";
import handler from "./api/services.js";
function sampleApi() {
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
    configureServer(server) {
      server.middlewares.use(middleware);
    },
    configurePreviewServer(server) {
      server.middlewares.use(middleware);
    },
  };
}
export default defineConfig({ plugins: [react(), sampleApi()] });
