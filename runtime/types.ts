/**
 * What importing a `*.worker.ts` module actually returns at runtime: every
 * function export becomes Promise-returning, non-function exports are stripped.
 * TS sees the real module's types, so this is the honest-types escape hatch —
 * in practice just `await` every call (awaiting a sync-typed value type-checks).
 */
export type Workerized<M> = {
    [K in keyof M as M[K] extends (...args: never[]) => unknown ? K : never]: M[K] extends
        (...args: infer A) => infer R ? (...args: A) => Promise<Awaited<R>> : never;
};

/**
 * Re-type a `*.worker.ts` module namespace as what the generated proxy actually
 * is at runtime — identity at runtime, `Workerized<M>` to the type-checker:
 *
 * ```ts
 * import * as mathWorker from "./math.worker.ts";
 * const math = workerized(mathWorker);
 * await math.add(1, 2); // typed Promise<number>
 * ```
 *
 * Only meaningful on modules imported through the loader hooks; on a plain
 * import it merely promise-wraps the types while calls stay in-thread.
 */
export function workerized<M>(mod: M): Workerized<M> {
    return mod as Workerized<M>;
}
