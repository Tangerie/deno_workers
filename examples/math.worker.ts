// A plain module — no worker boilerplate. Imported from main.ts it runs in a
// Web Worker; every call below arrives via postMessage.

export function add(a: number, b: number): number {
    return a + b;
}

export async function slow(x: string): Promise<string> {
    await new Promise((resolve) => setTimeout(resolve, 500));
    return `slow(${x}) ran on thread "${self.name || "worker"}"`;
}

export function boom(): never {
    throw new Error("kaboom");
}
