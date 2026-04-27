declare module "*.mjs" {
  export const REQUIRED_CLIENT_ENV: string[];

  export function parseDotEnv(text: string): Record<string, string>;

  export function getClientEnvFileOrder(mode?: string): string[];

  export function loadClientEnvFiles(options?: {
    cwd?: string;
    env?: NodeJS.ProcessEnv;
    mode?: string;
  }): string[];

  export function assertRequiredClientEnv(env?: NodeJS.ProcessEnv): void;

  export function validateBuiltClientOutput(options?: {
    cwd?: string;
    env?: NodeJS.ProcessEnv;
    outDir?: string;
  }): void;
}
