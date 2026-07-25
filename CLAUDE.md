# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this
repository.

## What this is

`@tangerie/workers` — a JSR package that lets consumers import a `*.worker.ts` module and
transparently get Worker-backed RPC proxies for its exports, implemented with Deno 2.8+ loader hooks
(`module.registerHooks` from `node:module`). Requires Deno >= 2.8.

## Commands

- `deno task check` — type-check everything, including the compile-time assertions in
  `tests/types_test.ts` (`Equal<>`, `@ts-expect-error`).
- `deno task test` — full test suite (`deno test -A tests/`); spawns real workers, no network needed
  once deps are cached. Single file: `deno test -A tests/proxy_test.ts`. Single case:
  `deno test -A tests/ --filter "graceful close"`.
- `deno task example` — runs `examples/main.ts` end-to-end through the real hooks. The task preloads
  `jsr:@tangerie/workers/register`, but because `deno.json` `name` is `@tangerie/workers` that
  self-resolves to the local `register.ts` — it does exercise local hook changes.
- `deno task dry` — `deno publish --dry-run --allow-dirty`; verifies JSR publish (no-slow-types
  etc.). The `unanalyzable-dynamic-import` warning for `runtime/worker_entry.ts` is expected and
  harmless (it imports an absolute `file:` URL at runtime).

## Style

Source is hand-formatted, not `deno fmt`-formatted: 4-space indent, `if(` with no space, spaced type
colons (`url : string`, `) : LoadResult`), double quotes, no trailing commas. There is deliberately
no `fmt` block in `deno.json` — **do not run `deno fmt`**, it reverts all of the above.

`deno lint` reports 3 known problems that should be left alone: two `no-explicit-any` (the deliberate
`as any` on the `node:module` import in `register.ts` and `tests/integration_test.ts`) and one
`verbatim-module-syntax` in `tests/types_test.ts`.

## Architecture

Three layers; data flows: consumer import → loader hooks → generated proxy module → `runtime/` →
`core/` transport → worker entry → user's worker module.

- **`hooks/`** — pure, synchronous loader hooks. `resolve` rewrites `file:` URLs matching
  `\.worker\.(ts|js|mts|mjs)$` by adding `?worker-proxy`; `load` intercepts marked URLs, reads the
  real TS source via `nextLoad`, extracts export names statically (`extract.ts`: a literal/comment
  stripper + regexes; throws on `export *` and destructuring exports), and emits a generated JS
  module that imports `@tangerie/workers/runtime` and does `p.bind("<name>")` per export. The
  `?raw-worker` marker makes both hooks pass a URL through untouched.
- **`runtime/`** — `proxy.ts`: `createWorkerProxy(rawUrl)` factory with a module-global registry
  keyed by query-stripped URL. Lazy-spawns the worker on first call, respawns after close; pending
  calls are a `Map<id, PromiseWithResolvers>`; graceful close drains in-flight calls, `force`
  rejects them. `worker_entry.ts` is the worker-side bootstrap: attaches its listener synchronously
  (postMessage FIFO ⇒ `init` always precedes `call`s, so no handshake queue), dynamic-imports the
  user module, validates `typeof fn === "function"` per call. `protocol.ts` defines the message maps
  from the parent's perspective (`init`/`call` out, `ready`/`initError`/`result`/`error` in).
- **`core/`** — `createWorkerEmitter<In, Out>(url?)`: typed emitter over the Worker/`self` boundary
  (wraps `@tangerie/utils/emitter`). `In`/`Out` are `Record<event, argsTuple>` maps, deliberately
  swapped between the two sides: parent uses `<ParentIn, ParentOut>`, worker entry uses
  `<ParentOut, ParentIn>`.
- **`register.ts`** — side-effect entry preloaded with `--import`; no-ops inside workers
  (`isWorker()` guard). Registration must happen before user code, hence `--import`, not a normal
  import (static imports hoist).

## Invariants / gotchas

- The generated proxy imports the bare specifier `@tangerie/workers/runtime` — it must stay in
  `deno.json` `exports`, and the self-referencing entries in `imports` are what make it resolve
  inside this repo (consumers get it from their own `deno add` mapping). Hook-produced source cannot
  use `jsr:`/`npm:` specifiers directly.
- Never make the design depend on hooks running inside worker threads (undocumented in Deno); the
  `?raw-worker` marker + `isWorker()` guard keep it correct either way.
- TS types of a proxied import come from the real module, so sync worker functions look sync-typed;
  consumers must `await` every call. `Workerized<M>` in `runtime/types.ts` is the honest-type
  mapping.
- Hooks are process-wide once registered — all hook-registered test assertions live in
  `tests/integration_test.ts` only; `proxy_test.ts` exercises the runtime without hooks by passing
  URLs to `createWorkerProxy` directly.
- JSR no-slow-types: every public symbol needs explicit types (that's why `WorkerEmitter` exists in
  `core/core.ts`).
- `.github/workflows/publish.yml` runs `npx jsr publish` on **every push to `main`** — bump `version`
  in `deno.json` alongside any functional change, or the publish step fails on a duplicate version.
- `deno.json` `publish.include` is an allowlist: a new top-level source directory ships nothing until
  it is added there. `tests/` and `examples/` are intentionally excluded.
