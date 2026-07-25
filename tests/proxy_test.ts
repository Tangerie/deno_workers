import { assert, assertEquals, assertRejects, assertStringIncludes } from "@std/assert";
import { closeWorker, createWorkerProxy, getWorker } from "../runtime/proxy.ts";

const FIXTURE = import.meta.resolve("./fixtures/math.worker.ts");

Deno.test("round-trips sync and async calls", async () => {
    const p = createWorkerProxy(FIXTURE);
    const add = p.bind("add");
    const slow = p.bind("slow");
    assertEquals(await add(1, 2), 3);
    assertEquals(await slow("x", 10), "slow:x");
    await p.close();
});

Deno.test("interleaved concurrent calls resolve to the right ids", async () => {
    const p = createWorkerProxy(FIXTURE);
    const add = p.bind("add");
    const slow = p.bind("slow");

    const [s1, a1, s2, a2] = await Promise.all([
        slow("first", 100),
        add(10, 20),
        slow("second", 20),
        add(3, 4)
    ]);

    assertEquals([s1, a1, s2, a2], ["slow:first", 30, "slow:second", 7]);
    await p.close();
});

Deno.test("worker errors reject with the original message", async () => {
    const p = createWorkerProxy(FIXTURE);
    const err = await assertRejects(() => p.bind("boom")("kapow"), Error);
    assertStringIncludes(err.message, "kapow");
    await p.close();
});

Deno.test("missing and non-function exports reject clearly", async () => {
    const p = createWorkerProxy(FIXTURE);
    const e1 = await assertRejects(() => p.bind("nope")(), Error);
    assertStringIncludes(e1.message, '"nope" is not an exported function');
    const e2 = await assertRejects(() => p.bind("notAFunction")(), Error);
    assertStringIncludes(e2.message, '"notAFunction" is not an exported function');
    await p.close();
});

Deno.test("graceful close waits for in-flight calls", async () => {
    const p = createWorkerProxy(FIXTURE);
    const pending = p.bind("slow")("draining", 150);
    const start = Date.now();
    await p.close();
    assert(Date.now() - start >= 100, "close resolved before the in-flight call finished");
    assertEquals(await pending, "slow:draining");
});

Deno.test("force close rejects in-flight calls", async () => {
    const p = createWorkerProxy(FIXTURE);
    const pending = p.bind("slow")("doomed", 5000);
    await p.close({ force: true });
    const err = await assertRejects(() => pending, Error);
    assertStringIncludes(err.message, "Worker closed");
});

Deno.test("calls after close respawn the worker", async () => {
    const p = createWorkerProxy(FIXTURE);
    assertEquals(await p.bind("add")(1, 1), 2);
    await p.close();
    assertEquals(await p.bind("add")(2, 2), 4);
    await p.close();
});

Deno.test("registry: getWorker/closeWorker by URL, query-insensitive", async () => {
    const p = createWorkerProxy(FIXTURE + "?raw-worker=");
    assert(getWorker(FIXTURE) === p);
    assertEquals(await p.bind("add")(5, 5), 10);
    await closeWorker(FIXTURE);
    await closeWorker(import.meta.resolve("./fixtures/never-created.worker.ts"));
});

Deno.test("bad module URL rejects pending calls and stays dead", async () => {
    const missing = import.meta.resolve("./fixtures/does-not-exist.worker.ts");
    const p = createWorkerProxy(missing);
    await assertRejects(() => p.bind("anything")(), Error);
    await assertRejects(() => p.bind("anything")(), Error);
    await p.close();
});
