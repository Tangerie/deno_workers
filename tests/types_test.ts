// Compile-time assertions — exercised by `deno task check`.
import { workerized } from "../runtime/types.ts";
import type { Workerized } from "../runtime/types.ts";
import type * as fixture from "./fixtures/math.worker.ts";

type Equal<A, B> = (<T>() => T extends A ? 1 : 2) extends (<T>() => T extends B ? 1 : 2) ? true
    : false;
const assertType = <_T extends true>(): void => {};

type Mod = {
    add(a: number, b: number): number;
    slow(x: string): Promise<string>;
    notAFunction: number;
};
type Remote = Workerized<Mod>;

// Sync functions become Promise-returning, async stay single-wrapped.
assertType<Equal<Remote["add"], (a: number, b: number) => Promise<number>>>();
assertType<Equal<Remote["slow"], (x: string) => Promise<string>>>();

// Non-function exports are stripped.
assertType<Equal<keyof Remote, "add" | "slow">>();

// workerized() re-types a module namespace as its proxy shape.
assertType<Equal<ReturnType<typeof workerized<typeof fixture>>, Workerized<typeof fixture>>>();
assertType<
    Equal<Workerized<typeof fixture>["add"], (a: number, b: number) => Promise<number>>
>();

// Wrong argument types are rejected through Workerized (never executed).
const compileOnly = (remote: Remote) => {
    // @ts-expect-error — add takes numbers
    remote.add("1", "2");
    // @ts-expect-error — notAFunction is stripped
    remote.notAFunction;
};

Deno.test("types_test compiles", () => {
    void compileOnly;
});
