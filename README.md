# [Deno Workers](https://jsr.io/@tangerie/workers)

Import a module as a Web Worker. Powered by Deno 2.8+ loader hooks (`module.registerHooks`) — no
build step, no boilerplate.

```sh
deno add jsr:@tangerie/workers
```

## Usage

Write a plain module named `*.worker.ts` (or `.worker.js` / `.worker.mts` / `.worker.mjs`):

```ts
// math.worker.ts
export function add(a: number, b: number): number {
    return a + b;
}

export async function slow(x: string): Promise<string> {
    await heavyLifting();
    return x;
}
```

Import it like any other module — every call is a `postMessage` round-trip into a real `Worker`:

```ts
// main.ts
import { add, slow } from "./math.worker.ts";
import { closeWorker } from "@tangerie/workers";

console.log(await add(1, 2)); // runs on the worker thread
console.log(await slow("hi"));

await closeWorker(import.meta.resolve("./math.worker.ts"));
```

Run with the hooks preloaded:

```sh
deno run -A --import @tangerie/workers/register main.ts
```

## How it works

- A resolve hook rewrites `file:` imports matching `*.worker.{ts,js,mts,mjs}`; a load hook replaces
  the module with a generated proxy that spawns a `Worker` (lazily, on first call) and RPCs by
  export name (`call`/`result`/`error` messages, promise per call id).
- The worker side is a package-internal bootstrap that dynamic-imports your module verbatim (marked
  `?raw-worker` so the hooks skip it) — your worker file needs zero imports from this package.
- Errors thrown in the worker reject the caller's promise with the original message and stack.

## API

- `closeWorker(url, { force? })` — terminate the worker for a module URL. Graceful by default (waits
  for in-flight calls); `force: true` rejects them. Calling a proxy again respawns the worker.
- `getWorker(url)` — the underlying `WorkerProxy` handle (`AsyncDisposable`, so `await using`
  works).
- `closeAllWorkers({ force? })` — terminate everything.
- `workerized(mod)` / `Workerized<M>` — the type-checker sees the _original_ module (loader hooks
  don't run in the LSP), so sync worker functions look sync-typed. `await` works regardless (TS
  allows awaiting non-promises), but for honest IntelliSense re-type the namespace — identity at
  runtime:

  ```ts
  import * as mathWorker from "./math.worker.ts";
  import { workerized } from "@tangerie/workers";

  const math = workerized(mathWorker);
  await math.add(1, 2); // typed Promise<number>; non-function exports are stripped
  ```

  Alternatively, write worker functions `async` and the original types are already exact.
- `createWorkerEmitter<In, Out>(url?)` — the low-level typed message emitter both sides are built
  on, exported for manual worker wiring.

## Limitations

- Arguments and return values must survive structured clone.
- Worker modules must use statically analyzable exports: `export function`/`const`/`class`/`enum`,
  `export { a, b as c }`, `export default`. `export * from` and destructuring exports throw at
  import time; one declarator per `export const`.
- Only exported **functions** are callable; non-function exports become proxies that reject when
  called — keep worker modules function-only.
- Workers inherit the process permissions (`-A` in the examples).
- `deno compile`: worker module URLs only exist inside generated code, so pass them via `--include`.
- Inside a worker, `*.worker.ts` imports are not rewritten (a worker importing another worker file
  runs it in-thread).
