export { closeAllWorkers, closeWorker, createWorkerProxy, getWorker } from "./runtime/proxy.ts";
export type { CloseOptions, WorkerProxy } from "./runtime/proxy.ts";
export { workerized } from "./runtime/types.ts";
export type { Workerized } from "./runtime/types.ts";
export { createWorkerEmitter } from "./core/mod.ts";
export { isWorker } from "./core/util.ts";
export type { TMessage } from "./core/types.ts";
