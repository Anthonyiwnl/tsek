import { createApp } from './app.js';
import { createPool } from './db.js';
import { serverConfig } from './config.js';
import { catalogueRepository } from './catalogue.js';

const { port, origin } = serverConfig();
const pool = createPool();
const server = createApp({ catalogue: catalogueRepository(pool), origin }).listen(port, () => {
  console.log(`TSEK API listening on port ${port}`);
});
server.on('error', async () => {
  console.error('HTTP server failed to start. Check PORT and whether it is already in use.');
  await pool.end();
  process.exitCode = 1;
});
let stopping = false;
function shutdown() {
  if (stopping) return;
  stopping = true;
  const timeout = setTimeout(() => process.exit(1), 10000);
  timeout.unref();
  server.close(async () => {
    await pool.end();
    clearTimeout(timeout);
  });
}
process.on('SIGINT', shutdown);
process.on('SIGTERM', shutdown);
