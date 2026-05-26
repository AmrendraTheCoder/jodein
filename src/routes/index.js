// src/routes/index.js
// Centralized routing table registering all decoupled modules.

import webhookRoutes from './webhook.js'
import adipRoutes from './adip.js'
import adminRoutes from './admin.js'
import demoRoutes from './demo.js'

export default async function routerIndex(fastify, options) {
  // Webhook gateway: Meta Verification (GET) + Message Queue Ingestion (POST)
  await fastify.register(webhookRoutes)

  // ADIP Standard Interoperability Protocol Endpoints v1 (GET /adip/v1/*)
  await fastify.register(adipRoutes, { prefix: '/adip/v1' })

  // Administrative Operations (Ingestion / Config Patching) (PATCH/POST /admin/*)
  await fastify.register(adminRoutes, { prefix: '/admin' })

  // Live Manual Chat Testing Client UI (GET/POST /demo/*)
  await fastify.register(demoRoutes, { prefix: '/demo' })
}
