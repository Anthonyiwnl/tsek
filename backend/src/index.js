import { createServer } from './server.js'
import { loadConfig } from './config.js'

const config = loadConfig()
const server = createServer()

server.listen(config.port, () => {
  console.log(`TSEK backend listening on port ${config.port}`)
})
