/// <reference types="vite/client" />

interface ImportMetaEnv {
  /** Base URL of the CI backend; empty means same origin. */
  readonly VITE_CI_API_BASE?: string
}
