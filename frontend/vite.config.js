import react from "@vitejs/plugin-react";
import { defineConfig } from "vite";
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
export default defineConfig({ plugins: [react(), sampleApi()] });
