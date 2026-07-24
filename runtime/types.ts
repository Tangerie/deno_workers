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
