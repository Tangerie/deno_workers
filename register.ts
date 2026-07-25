import { isWorker } from "./core/util.ts";
import { load, resolve } from "./hooks/mod.ts";

// No-ops inside a worker thread — the worker must import its module verbatim.
if(!isWorker()) {
    const mod = await import("node:module") as any;
    if(typeof mod.registerHooks !== "function") throw new Error("Requires Deno >= 2.8");
    mod.registerHooks({ resolve, load });
}
