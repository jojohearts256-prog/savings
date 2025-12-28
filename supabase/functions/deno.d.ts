// Minimal Deno ambient declarations for TypeScript in this repo.
// These are intentionally permissive (any) to avoid blocking compilation
// in the workspace. The real Deno runtime is available when the function
// is deployed to Supabase.

declare const Deno: {
  env: {
    get(key: string): string | undefined;
  };
  serve(handler: (req: Request) => Promise<Response> | Response): void;
};

export {};
