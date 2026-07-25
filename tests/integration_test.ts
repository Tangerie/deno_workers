// Registers the loader hooks for real (process-wide) and imports a *.worker.ts
// module through them. All hook-registered assertions live in this one file.
import { assert, assertEquals, assertRejects, assertStringIncludes } from "@std/assert";
import { load, resolve } from "../hooks/mod.ts";
import { closeWorker, getWorker } from "../runtime/proxy.ts";
import { workerized } from "../runtime/types.ts";

const mod = await import("node:module") as any;
mod.registerHooks({ resolve, load });

const FIXTURE = import.meta.resolve("./fixtures/math.worker.ts");

Deno.test("importing a *.worker.ts yields RPC proxies", async () => {
    const worker = workerized(await import("./fixtures/math.worker.ts"));
    assertEquals(await worker.add(1, 2), 3);
    assertEquals(await worker.slow("hi", 10), "slow:hi");

    const err = await assertRejects(() => worker.boom("bang"), Error);
    assertStringIncludes(err.message, "bang");

    assert(getWorker(FIXTURE), "proxy should be registered under the fixture URL");
    await closeWorker(FIXTURE);
});

Deno.test("raw-worker marker bypasses the hooks (module runs in-thread)", async () => {
    const real = await import("./fixtures/math.worker.ts?raw-worker=");
    assertEquals(real.add(1, 2), 3); // plain synchronous value — not a proxy
    assertEquals(real.notAFunction, 42);
});
