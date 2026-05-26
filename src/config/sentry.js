// src/config/sentry.js
import * as Sentry from '@sentry/node'
import { config } from 'dotenv'
config()

const dsn = process.env.SENTRY_DSN || process.env.GLITCHTIP_DSN

if (dsn) {
  Sentry.init({
    dsn,
    environment: process.env.NODE_ENV || 'development',
    tracesSampleRate: 0.1, // Trace 10% of requests in production
    
    // Rule: Avoid exposing sensitive tokens/headers to Sentry alerts
    beforeSend(event) {
      // 1. Redact headers from HTTP requests
      if (event.request && event.request.headers) {
        const sensitiveHeaders = ['authorization', 'x-hub-signature-256', 'x-admin-secret', 'cookie']
        for (const key of Object.keys(event.request.headers)) {
          if (sensitiveHeaders.includes(key.toLowerCase())) {
            event.request.headers[key] = '[REDACTED]'
          }
        }
      }

      // 2. Redact sensitive fields in request body / payload data
      if (event.request && event.request.data) {
        if (typeof event.request.data === 'object' && event.request.data !== null) {
          const sensitiveKeys = ['accesstoken', 'whatsapp_access_token', 'token', 'adminsecret', 'secret', 'password', 'phone', 'wa_id']
          const redactObject = (obj) => {
            for (const key of Object.keys(obj)) {
              if (sensitiveKeys.some(sk => key.toLowerCase().includes(sk))) {
                obj[key] = '[REDACTED]'
              } else if (typeof obj[key] === 'object' && obj[key] !== null) {
                redactObject(obj[key])
              }
            }
          }
          try {
            redactObject(event.request.data)
          } catch (_) {}
        } else if (typeof event.request.data === 'string') {
          try {
            event.request.data = event.request.data.replace(/"(accessToken|token|adminSecret|secret|password|phone|wa_id)":"[^"]*"/gi, '"$1":"[REDACTED]"')
          } catch (_) {}
        }
      }

      // 3. Redact sensitive values from extra/context data
      if (event.extra) {
        const sensitiveExtraKeys = ['jobdata', 'adminsecret', 'token', 'secret']
        for (const key of Object.keys(event.extra)) {
          if (sensitiveExtraKeys.some(sk => key.toLowerCase().includes(sk))) {
            event.extra[key] = '[REDACTED]'
          }
        }
      }

      return event
    }
  })
  console.log('[Sentry] Telemetry initialized successfully')
} else {
  console.warn('[Sentry] No SENTRY_DSN or GLITCHTIP_DSN found in environment. Error reporting disabled.')
}

export { Sentry }
