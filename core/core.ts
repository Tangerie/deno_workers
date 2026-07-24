import type { TMessage } from "./types.ts";
import { Emitter, hideEmit } from "@tangerie/utils/emitter";

export type WorkerEmitter<
    In extends Record<string, unknown[]>,
    Out extends Record<string, unknown[]>,
> = Omit<Emitter<In>, "emit"> & {
    send<K extends keyof Out>(type: K, ...payload: Out[K]): void;
    close(): void;
};

export function createWorkerEmitter<
    const In extends Record<string, unknown[]>,
    const Out extends Record<string, unknown[]>,
>(url?: URL): WorkerEmitter<In, Out> {
    const context = url ? new Worker(url!, { type: "module" }) : self;
    const emitter = new Emitter<In>();

    context.addEventListener("message", (ev) => {
        if ("data" in ev) {
            const { type, payload } = ev.data as TMessage<In, keyof In>;
            emitter.emit(type, ...payload);
        }
    });

    function send<K extends keyof Out>(type: K, ...payload: Out[K]) {
        context.postMessage({ type, payload });
    }

    const close = ("terminate" in context ? context.terminate : context.close).bind(context);

    return { ...hideEmit(emitter), send, close };
}
