import { createWorkerEmitter } from "../core/mod.ts";
import type { ParentIn, ParentOut } from "./protocol.ts";

function formatError(err : unknown) : string {
    if(err instanceof Error) return err.stack ?? `${err.name}: ${err.message}`;
    return String(err);
}

// Listener must attach during initial synchronous evaluation — postMessage FIFO
// then guarantees "init" is handled before any "call" without a ready handshake.
const emitter = createWorkerEmitter<ParentOut, ParentIn>();

let modPromise : Promise<Record<string, unknown>> | undefined;

emitter.on("init", url => {
    modPromise = import(url);
    modPromise
        .then(mod => emitter.send("ready", Object.keys(mod).filter(x => typeof mod[x] === "function")))
        .catch(err => emitter.send("initError", formatError(err)));
});

emitter.on("call", async (id, name, args) => {
    if(!modPromise) {
        emitter.send("error", id, `Received call "${name}" before init`);
        return;
    }

    try {
        const mod = await modPromise;
        const fn = mod[name];
        if(typeof fn !== "function") throw new Error(`"${name}" is not an exported function of the worker module`);
        emitter.send("result", id, await fn(...args));
    } catch(err) {
        emitter.send("error", id, formatError(err));
    }
});
