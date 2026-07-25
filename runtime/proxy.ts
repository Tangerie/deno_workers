import { createWorkerEmitter, type WorkerEmitter } from "../core/mod.ts";
import type { ParentIn, ParentOut } from "./protocol.ts";

export interface CloseOptions {
    /** Reject in-flight calls and terminate immediately instead of draining. */
    force? : boolean
}

export interface WorkerProxy extends AsyncDisposable {
    /** The worker module URL (query stripped) this proxy is registered under. */
    readonly url : string
    /** Returns an async function that RPCs `name` in the worker. */
    bind(name : string) : (...args : unknown[]) => Promise<unknown>
    /** Terminate the worker. Graceful by default: waits for in-flight calls. */
    close(opts? : CloseOptions) : Promise<void>
}

interface Session {
    emitter : WorkerEmitter<ParentIn, ParentOut>
    pending : Map<number, PromiseWithResolvers<unknown>>
    dead? : string
    onDrained? : () => void
}

const registry = new Map<string, WorkerProxy>();

function stripQuery(url : string | URL) : string {
    const u = new URL(url);
    u.search = "";
    return u.href;
}

/**
 * Create (or reuse) the proxy for a worker module. `rawUrl` should carry the
 * `?raw-worker` marker so the worker's dynamic import bypasses the loader hooks.
 * The worker is spawned lazily on the first call and respawned after close().
 */
export function createWorkerProxy(rawUrl : string) : WorkerProxy {
    const key = stripQuery(rawUrl);
    const existing = registry.get(key);
    if(existing) return existing;

    let session : Session | null = null;
    let nextId = 0;

    function spawn() : Session {
        const emitter = createWorkerEmitter<ParentIn, ParentOut>(new URL("./worker_entry.ts", import.meta.url));
        const s : Session = { emitter, pending: new Map() };

        const settle = (id : number, act : (p : PromiseWithResolvers<unknown>) => void) => {
            const p = s.pending.get(id);
            if(!p) return;
            s.pending.delete(id);
            act(p);
            if(s.pending.size === 0) s.onDrained?.();
        }

        emitter.on("result", (id, value) => settle(id, p => p.resolve(value)));
        emitter.on("error", (id, message) => settle(id, p => p.reject(new Error(message))));
        emitter.on("initError", message => {
            s.dead = message;
            for(const p of s.pending.values()) p.reject(new Error(message));
            s.pending.clear();
            emitter.close();
            s.onDrained?.();
        });

        emitter.send("init", rawUrl);
        return s;
    }

    function bind(name : string) : (...args : unknown[]) => Promise<unknown> {
        return (...args : unknown[]) : Promise<unknown> => {
            session ??= spawn();
            const s = session;
            if(s.dead) return Promise.reject(new Error(s.dead));

            const id = nextId++;
            const p = Promise.withResolvers<unknown>();
            s.pending.set(id, p);
            s.emitter.send("call", id, name, args);
            return p.promise;
        }
    }

    async function close(opts : CloseOptions = {}) : Promise<void> {
        const s = session;
        session = null;
        if(!s) return;

        if(!opts.force && !s.dead && s.pending.size > 0) {
            await new Promise<void>(resolve => {
                s.onDrained = resolve;
            });
        }

        for(const p of s.pending.values()) p.reject(new Error("Worker closed"));
        s.pending.clear();
        s.emitter.close();
    }

    const proxy : WorkerProxy = {
        url: key,
        bind,
        close,
        [Symbol.asyncDispose]: () => close()
    };

    registry.set(key, proxy);
    return proxy;
}

/** Look up the proxy for a worker module URL, if one has been created. */
export function getWorker(url : string | URL) : WorkerProxy | undefined {
    return registry.get(stripQuery(url));
}

/**
 * Terminate the worker behind a `*.worker.ts` module. Resolves immediately if
 * no worker exists for the URL.
 *
 * @example
 * ```ts
 * await closeWorker(import.meta.resolve("./math.worker.ts"));
 * ```
 */
export function closeWorker(url : string | URL, opts? : CloseOptions) : Promise<void> {
    return registry.get(stripQuery(url))?.close(opts) ?? Promise.resolve();
}

/** Terminate every worker created through this package. */
export async function closeAllWorkers(opts? : CloseOptions) : Promise<void> {
    await Promise.all([...registry.values()].map(x => x.close(opts)));
}
