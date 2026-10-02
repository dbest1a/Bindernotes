/// <reference types="vite/client" />

interface ImportMetaEnv {
  readonly VITE_PRIVACY_POLICY_URL?: string;
  readonly VITE_TERMS_URL?: string;
  readonly VITE_DESMOS_API_KEY?: string;
  readonly NEXT_PUBLIC_DESMOS_API_KEY?: string;
}

interface ImportMeta {
  readonly env: ImportMetaEnv;
}
