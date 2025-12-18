/// <reference types="vite/client" />

interface ImportMetaEnv {
  ///  readonly VITE_GCS_BUCKET_NAME: string
  readonly VITE_BACKEND_API_URL: string
  readonly VITE_GOOGLE_CLIENT_ID: string
}

interface ImportMeta {
  readonly env: ImportMetaEnv
}
