/// <reference types="vite/client" />

/** Set by tools/with-commit-dates.sh for the credit on the HIRED card. */
interface ImportMetaEnv {
  readonly VITE_FIRST_COMMIT?: string;
  readonly VITE_LAST_COMMIT?: string;
}
