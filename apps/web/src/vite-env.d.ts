/// <reference types="vite/client" />

interface ImportMetaEnv {
  readonly VITE_FIREBASE_API_KEY: string
  readonly VITE_FIREBASE_AUTH_DOMAIN: string
  readonly VITE_FIREBASE_PROJECT_ID: string
  readonly VITE_FIREBASE_STORAGE_BUCKET: string
  readonly VITE_FIREBASE_MESSAGING_SENDER_ID: string
  readonly VITE_FIREBASE_APP_ID: string
  readonly VITE_SIGNALING_SERVER_URL?: string
  readonly VITE_DEV_SIGNALING_SERVER_URL?: string
  readonly VITE_PROD_SIGNALING_SERVER_URL?: string
  readonly VITE_FALLBACK_TURN_USERNAME?: string
  readonly VITE_FALLBACK_TURN_CREDENTIAL?: string
  readonly VITE_FALLBACK_TURN_URL_UDP?: string
  readonly VITE_FALLBACK_TURN_URL_TCP?: string
  readonly VITE_FALLBACK_TURN_URL_TCP_SSL?: string
}

interface ImportMeta {
  readonly env: ImportMetaEnv
}