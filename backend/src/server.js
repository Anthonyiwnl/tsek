import http from 'node:http'
import { loadConfig } from './config.js'
import { createOpenAiProvider, ProviderError } from './provider.js'

const MAX_BODY_BYTES = 1024 * 1024

function sendJson(response, status, body, corsOrigin = '') {
  if (corsOrigin) {
    response.setHeader('Access-Control-Allow-Origin', corsOrigin)
  }
  response.writeHead(status, {
    'Content-Type': 'application/json; charset=utf-8',
    'Cache-Control': 'no-store',
  })
  response.end(JSON.stringify(body))
}

function requestBody(request) {
  return new Promise((resolve, reject) => {
    let body = ''
    let size = 0

    request.setEncoding('utf8')
    request.on('data', (chunk) => {
      size += Buffer.byteLength(chunk)
      if (size > MAX_BODY_BYTES) {
        reject(new ProviderError('Request body is too large.', 'REQUEST_TOO_LARGE', 413))
        request.pause()
        return
      }
      body += chunk
    })
    request.on('end', () => resolve(body))
    request.on('error', reject)
  })
}

function validInput(value) {
  return typeof value === 'string' && value.trim().length > 0 && value.trim().length <= 10000
}

function errorResponse(error) {
  if (error instanceof ProviderError) {
    return {
      status: error.status,
      body: { error: { code: error.code, message: error.message } },
    }
  }

  return {
    status: 500,
    body: { error: { code: 'INTERNAL_ERROR', message: 'The request could not be completed.' } },
  }
}

export function createRequestHandler({ env = process.env, provider } = {}) {
  const config = loadConfig(env)
  const verify = provider || createOpenAiProvider({
    apiKey: config.openAiApiKey,
    model: config.openAiModel,
    timeoutMs: config.timeoutMs,
  })

  return async function requestHandler(request, response) {
    const origin = config.frontendUrl && request.headers.origin === config.frontendUrl
      ? config.frontendUrl
      : ''

    if (request.method === 'OPTIONS') {
      if (origin) response.setHeader('Access-Control-Allow-Origin', origin)
      response.setHeader('Access-Control-Allow-Methods', 'GET,POST,OPTIONS')
      response.setHeader('Access-Control-Allow-Headers', 'Content-Type')
      response.writeHead(204)
      response.end()
      return
    }

    const url = new URL(request.url, `http://${request.headers.host || 'localhost'}`)

    if (request.method === 'GET' && url.pathname === '/health') {
      sendJson(response, 200, { status: 'ok' }, origin)
      return
    }

    if (request.method === 'POST' && url.pathname === '/api/verify') {
      try {
        const rawBody = await requestBody(request)
        let body
        try {
          body = JSON.parse(rawBody)
        } catch {
          throw new ProviderError('Request body must be valid JSON.', 'INVALID_JSON', 400)
        }

        if (body === null || typeof body !== 'object' || !validInput(body.input)) {
          throw new ProviderError(
            'The input field must be a non-empty string of 10,000 characters or fewer.',
            'INVALID_INPUT',
            400,
          )
        }

        const providerResponse = await verify({ input: body.input.trim() })
        sendJson(response, 200, {
          result: providerResponse.result,
          model: providerResponse.model,
        }, origin)
      } catch (error) {
        const failure = errorResponse(error)
        if (failure.status === 413) response.setHeader('Connection', 'close')
        sendJson(response, failure.status, failure.body, origin)
      }
      return
    }

    sendJson(response, 404, {
      error: { code: 'NOT_FOUND', message: 'Route not found.' },
    }, origin)
  }
}

export function createServer(options = {}) {
  return http.createServer(createRequestHandler(options))
}
