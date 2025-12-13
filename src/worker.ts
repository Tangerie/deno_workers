import type { AnyFn, WorkerRequest } from "./internal.ts";
import { ensureInWorker } from "./util.ts";

const registered : Record<string, AnyFn> = {};

export function defineWorkerFunction<A extends unknown[], R>(name : string, fn : (...args : A) => R) {
    ensureInWorker();
    
    if(Object.keys(registered).length === 0) {
        self.onmessage = async (e : MessageEvent<WorkerRequest>) => {
            const { id, func, args } = e.data;
            if(!(func in registered)) {
                self.postMessage({ id, error: `No function named ${func}` });
                return;
            } 

            try {
                const result = await registered[func](...args);
                self.postMessage({ id, result });
            } catch(err) {
                self.postMessage({ id, error: `Error executing ${func}: ${err}`})
            }
        }
    }
    
    registered[name] = fn;
}