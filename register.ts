// Side-effect module: registers the loader hooks that turn `*.worker.ts`
// imports into Worker-backed proxies. Preload it before user code:
//
//   deno run -A --import @tangerie/workers/register main.ts
//
// No-ops inside a worker thread — the worker must import its module verbatim.
import { isWorker } from "./core/util.ts";
import { load, resolve } from "./hooks/mod.ts";

if (!isWorker()) {
    const mod = await import("node:module") as unknown as {
        registerHooks?: (hooks: { resolve: typeof resolve; load: typeof load }) => unknown;
    };
    if (typeof mod.registerHooks !== "function") {
        throw new Error(
            "@tangerie/workers/register requires Deno >= 2.8 (module.registerHooks is unavailable)",
        );
    }
    mod.registerHooks({ resolve, load });
}
