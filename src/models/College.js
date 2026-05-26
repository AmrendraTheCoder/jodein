/**
 * @file College.js
 * @description Mongoose schema and model for College. 
 * Represents a single isolated tenant (college) in the platform. Handles WhatsApp credentials, 
 * AI settings (model, prompts, context windows), vector DB namespaces for RAG, feature toggles, 
 * ERP credentials, and per-user limits.
 */

import mongoose from 'mongoose'

/**
 * @typedef {Object} WhatsAppCredentials
 * @property {string} phoneNumberId The Meta/WhatsApp phone number ID (e.g. "1234567890").
 * @property {string} accessToken The system access token for sending WhatsApp messages. Encrypted in production.
 */

/**
 * @typedef {Object} AIConfig
 * @property {string} model LLM model identifier (e.g., "gemini-2.0-flash").
 * @property {string} systemPrompt Base instructions provided to the AI for defining personality and constraints.
 * @property {number} temperature Temperature for controlling randomness/creativity (0.0 to 1.0).
 * @property {number} maxTokens Maximum output tokens for the AI response.
 * @property {number} contextWindow Number of past messages in the conversation history to feed back into the AI.
 * @property {string} [vectorDbNamespace] The Pinecone or Qdrant collection/namespace used for college RAG (e.g. "jodein-lnmiit").
 */

/**
 * @typedef {Object} FeatureToggles
 * @property {boolean} webSearch Toggle to allow Google Search grounding for real-time information.
 * @property {boolean} imageUnderstanding Toggle to allow visual query understanding (multimodal).
 * @property {boolean} voiceTranscription Toggle to allow transcribing audio messages into text.
 * @property {boolean} ragEnabled Toggle to retrieve campus-specific knowledge from vector store.
 * @property {boolean} attendanceAlerts Toggle to send automated absence notifications to parents.
 */

/**
 * @typedef {Object} ERPIntegration
 * @property {string} type Type of ERP adapter in use ('manual', 'fedena', 'google-sheet', 'csv-email').
 * @property {mongoose.Schema.Types.Mixed} [config] Adapter-specific connection configuration, API keys, or email parameters.
 */

/**
 * @typedef {Object} CollegeLimits
 * @property {number} maxMessagesPerUserPerHour Max interactions allowed for a single student per hour.
 * @property {number} maxMessagesPerUserPerDay Max interactions allowed for a single student per day.
 */

/**
 * @typedef {Object} College
 * @property {string} collegeId Unique, URL-friendly slug identifying the college (e.g., "lnmiit").
 * @property {string} name Full name of the academic institution.
 * @property {string} [city] City where the campus is located.
 * @property {string} [adminEmail] Admin email address associated with the tenant dashboard account.
 * @property {string} [apiKey] Secret API key used for custom dashboard or API level integrations.
 * @property {WhatsAppCredentials} whatsapp Dedicated WhatsApp Business API credentials for the college.
 * @property {AIConfig} ai Specific Large Language Model and prompts configuration.
 * @property {FeatureToggles} features Enabled integrations and platform features.
 * @property {ERPIntegration} erp Credentials and type for the automated attendance ingestion adapters.
 * @property {CollegeLimits} limits Hard limits imposed on college students to prevent token quota abuse.
 * @property {string} status The operation status of the tenant ('active', 'paused', 'draft').
 */

const CollegeSchema = new mongoose.Schema({
  // ─── Identity ───────────────────────────────────────────────────────────
  /**
   * Unique identifier/slug for the college tenant.
   * Used for isolating collections, caches, and vector namespaces.
   * @type {String}
   */
  collegeId: { 
    type: String, 
    required: true, 
    unique: true, 
    trim: true,
    index: true 
  },

  /**
   * Official name of the college.
   * @type {String}
   */
  name: { 
    type: String, 
    required: true,
    trim: true
  },

  /**
   * Physical city where the college is located.
   * @type {String}
   */
  city: { 
    type: String,
    trim: true
  },

  /**
   * Primary administrative email used for dashboard access and portal authorization.
   * @type {String}
   */
  adminEmail: { 
    type: String,
    trim: true
  },

  /**
   * Dedicated API key for remote integration and dashboard CRUD client authorization.
   * Generate with crypto.randomBytes(32).toString('hex').
   * @type {String}
   */
  apiKey: { 
    type: String,
    trim: true
  },

  // ─── WhatsApp Credentials ───────────────────────────────────────────────
  /**
   * Holds access tokens and endpoint configs for sending messages via Meta Graph APIs.
   */
  whatsapp: {
    phoneNumberId: { 
      type: String, 
      required: true,
      trim: true
    },
    accessToken: { 
      type: String, 
      required: true,
      trim: true
    }
  },

  // ─── AI Configuration ───────────────────────────────────────────────────
  /**
   * Defines LLM behaviors, baseline system instructions, and RAG configuration.
   */
  ai: {
    model: { 
      type: String, 
      default: 'gemini-2.0-flash' 
    },
    systemPrompt: {
      type: String,
      default: 'You are a helpful campus assistant. Answer only academic and campus-related queries.'
    },
    temperature: { 
      type: Number, 
      default: 0.7,
      min: 0,
      max: 2.0
    },
    maxTokens: { 
      type: Number, 
      default: 500,
      min: 1,
      max: 4096
    },
    contextWindow: { 
      type: Number, 
      default: 10,
      min: 0,
      max: 50
    },
    /**
     * Vector DB collection/namespace identifier (e.g. "jodein-lnmiit" or Pinecone namespace).
     * Partitions document embeddings during retrieval to isolate intellectual property per college.
     * @type {String}
     */
    vectorDbNamespace: { 
      type: String,
      trim: true,
      default: function() {
        return this.collegeId ? `jodein-${this.collegeId}` : '';
      }
    }
  },

  // ─── Feature Toggles ────────────────────────────────────────────────────
  /**
   * Toggles to enable or disable features per-college, avoiding runtime errors 
   * if optional services (such as RAG document indexes) are not yet provisioned.
   */
  features: {
    webSearch: { 
      type: Boolean, 
      default: false 
    },
    imageUnderstanding: { 
      type: Boolean, 
      default: false 
    },
    voiceTranscription: { 
      type: Boolean, 
      default: false 
    },
    ragEnabled: { 
      type: Boolean, 
      default: false 
    },
    attendanceAlerts: { 
      type: Boolean, 
      default: false 
    }
  },

  // ─── ERP / Attendance Integration ───────────────────────────────────────
  /**
   * Configuration for automating attendance retrieval.
   * 'manual' indicates manual CSV upload, while others connect via specific adapters.
   */
  erp: {
    type: { 
      type: String, 
      enum: ['manual', 'fedena', 'google-sheet', 'csv-email'], 
      default: 'manual' 
    },
    config: { 
      type: mongoose.Schema.Types.Mixed 
    }
  },

  // ─── Per-User Rate Limits ────────────────────────────────────────────────
  /**
   * Overrides the global rate limits for students in this college. 
   * Helps colleges control their token and API expenses.
   */
  limits: {
    maxMessagesPerUserPerHour: { 
      type: Number, 
      default: 20 
    },
    maxMessagesPerUserPerDay: { 
      type: Number, 
      default: 50 
    }
  },

  // ─── Status ─────────────────────────────────────────────────────────────
  /**
   * The operating status of the bot instance.
   * 'draft'  → being configured, webhook ignored.
   * 'active' → live, processing and answering WhatsApp messages.
   * 'paused' → temporarily suspended, messages are dropped in the queue.
   */
  status: { 
    type: String, 
    enum: ['active', 'paused', 'draft'], 
    default: 'draft' 
  }

}, { 
  timestamps: true 
})

export const College = mongoose.model('College', CollegeSchema)
