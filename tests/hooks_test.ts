import { assert, assertEquals, assertStringIncludes } from "@std/assert";
import {
    load,
    type LoadResult,
    resolve,
    type ResolveContext,
    type ResolveResult,
} from "../hooks/mod.ts";

const ctx: ResolveContext = { parentURL: "file:///C:/app/main.ts" };
const passResolve = (specifier: string): ResolveResult => ({ url: specifier });

Deno.test("resolve rewrites *.worker.ts file URLs", () => {
    const r = resolve("file:///C:/app/math.worker.ts", ctx, passResolve);
    assertEquals(r.url, "file:///C:/app/math.worker.ts?worker-proxy=");
    assert(r.shortCircuit);
});

Deno.test("resolve passes through non-worker, marked, and non-file URLs", () => {
    assertEquals(resolve("file:///C:/app/util.ts", ctx, passResolve).url, "file:///C:/app/util.ts");
    assertEquals(
        resolve("file:///C:/app/math.worker.ts?raw-worker=", ctx, passResolve).url,
        "file:///C:/app/math.worker.ts?raw-worker=",
    );
    assertEquals(
        resolve("https://example.com/math.worker.ts", ctx, passResolve).url,
        "https://example.com/math.worker.ts",
    );
});

Deno.test("load generates a proxy module for marked URLs", () => {
    let loadedUrl: string | undefined;
    const fakeNext = (url: string): LoadResult => {
        loadedUrl = url;
        return { format: "module", source: "export function add(a: number, b: number) {}" };
    };
    const r = load("file:///C:/app/math.worker.ts?worker-proxy=", {}, fakeNext);
    assertEquals(loadedUrl, "file:///C:/app/math.worker.ts");
    assertEquals(r.format, "module");
    assert(r.shortCircuit);
    const src = String(r.source);
    assertStringIncludes(src, `import { createWorkerProxy } from "@tangerie/workers/runtime";`);
    assertStringIncludes(src, `createWorkerProxy("file:///C:/app/math.worker.ts?raw-worker=")`);
    assertStringIncludes(src, `export const add = p.bind("add");`);
});

Deno.test("load delegates unmarked URLs", () => {
    const real: LoadResult = { format: "module", source: "export const x = 1;" };
    const r = load("file:///C:/app/plain.ts", {}, () => real);
    assertEquals(r, real);
});
