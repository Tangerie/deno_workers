import type { AnyFn, AwaitedRet, RemoteRet, ResolveRejectPair, WorkerRequest, WorkerResponse } from "./internal.ts";

export function loadWorker(url : URL) {
    const worker = new Worker(
        url.href,
        { type: "module" },
    );

    const waiting : Map<number, ResolveRejectPair<any>> = new Map();
    let onFinal : (() => void) | undefined = undefined;
    let curId = 0;

    worker.onmessage = (e : MessageEvent<WorkerResponse>) => {
        if(!waiting.has(e.data.id)) return console.error("No listener for id", e.data.id);
        const [resolve, reject] = waiting.get(e.data.id)!;
        waiting.delete(e.data.id);
        if("error" in e.data) {
            reject(e.data.error);
        } else {
            resolve(e.data.result);
        }
        if(waiting.size === 0 && onFinal) onFinal();
    }

    const use = <F extends AnyFn>(func : string) => (...args : Parameters<F>) : RemoteRet<F> => {
        return new Promise<AwaitedRet<F>>((resolve, reject) => {
            const id = curId++;
            waiting.set(id, [resolve, reject]);
            const msg : WorkerRequest = {
                id, func, args
            };
            worker.postMessage(msg);
        });
    }

    const close = () => {
        if(waiting.size === 0) {
            worker.terminate();
            return;
        }
        return new Promise((resolve) => { onFinal = () => { worker.terminate(); resolve(undefined); } });
    }

    return { use, close };
}