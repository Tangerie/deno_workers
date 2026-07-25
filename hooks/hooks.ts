import { extractExportedNames } from "./extract.ts";

// Minimal structural types for node:module registerHooks — kept local so the
// package has no dependency on @types/node.
export interface ResolveContext {
    conditions? : string[]
    importAttributes? : Record<string, string>
    parentURL? : string
}
export interface ResolveResult {
    url : string
    format? : string | null
    importAttributes? : Record<string, string>
    shortCircuit? : boolean
}
export type NextResolve = (specifier : string, context? : ResolveContext) => ResolveResult;

export interface LoadContext {
    format? : string | null
    conditions? : string[]
    importAttributes? : Record<string, string>
}
export interface LoadResult {
    format : string
    source : string | Uint8Array | null
    shortCircuit? : boolean
}
export type NextLoad = (url : string, context? : LoadContext) => LoadResult;

const WORKER_RE = /\.worker\.(ts|js|mts|mjs)$/;
export const PROXY_PARAM = "worker-proxy";
export const RAW_PARAM = "raw-worker";

export function resolve(specifier : string, context : ResolveContext, nextResolve : NextResolve) : ResolveResult {
    const result = nextResolve(specifier, context);
    const url = new URL(result.url);

    if(url.protocol !== "file:") return result;
    if(url.searchParams.has(RAW_PARAM) || url.searchParams.has(PROXY_PARAM)) return result;
    if(!WORKER_RE.test(url.pathname)) return result;

    url.searchParams.set(PROXY_PARAM, "");
    return { url: url.href, shortCircuit: true };
}

export function load(url : string, context : LoadContext, nextLoad : NextLoad) : LoadResult {
    const u = new URL(url);
    if(u.protocol !== "file:" || !u.searchParams.has(PROXY_PARAM)) return nextLoad(url, context);

    u.searchParams.delete(PROXY_PARAM);
    const real = nextLoad(u.href, context);
    const source = typeof real.source === "string" ? real.source : new TextDecoder().decode(real.source ?? new Uint8Array());
    const { names, hasDefault } = extractExportedNames(source, u.href);

    u.searchParams.set(RAW_PARAM, "");

    return {
        source: generateProxyModule(u.href, names, hasDefault),
        format: "module",
        shortCircuit: true
    };
}

export function generateProxyModule(rawUrl : string, names : string[], hasDefault : boolean) : string {
    return [
        `import { createWorkerProxy } from "@tangerie/workers/runtime";`,
        `const p = createWorkerProxy(${JSON.stringify(rawUrl)});`,
        ...names.map(x => `export const ${x} = p.bind(${JSON.stringify(x)});`),
        ...(hasDefault ? [`export default p.bind("default");`] : [])
    ].join("\n");
}
