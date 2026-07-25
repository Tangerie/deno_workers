/**
 * What importing a `*.worker.ts` module actually returns at runtime: every
 * function export becomes Promise-returning, non-function exports are stripped.
 */
export type Workerized<M> = {
    [K in keyof M as M[K] extends (...args : never[]) => unknown ? K : never] : M[K] extends (...args : infer A) => infer R ? (...args : A) => Promise<Awaited<R>> : never
}

/**
 * Re-type a `*.worker.ts` module namespace as what the generated proxy actually
 * is at runtime — identity at runtime, `Workerized<M>` to the type-checker.
 *
 * Only meaningful on modules imported through the loader hooks; on a plain
 * import it merely promise-wraps the types while calls stay in-thread.
 *
 * @example
 * ```ts
 * import * as mathWorker from "./math.worker.ts";
 *
 * const math = workerized(mathWorker);
 * await math.add(1, 2); // typed Promise<number>
 * ```
 */
export function workerized<M>(mod : M) : Workerized<M> {
    return mod as Workerized<M>;
}
