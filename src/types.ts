import type { AnyFn, RemoteRet } from "./internal.ts";

export type MaybePromise<T> = T | Promise<T>;

export type WorkerFunction<A extends unknown[] = unknown[], R = unknown> = (...args : A) => R;



export type RemoteWorkerFunction<F extends AnyFn> = (
  ...args: Parameters<F>
) => RemoteRet<F>;