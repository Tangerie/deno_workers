export function add(a : number, b : number) : number {
    return a + b;
}

export async function slow(x : string) : Promise<string> {
    await new Promise(res => setTimeout(res, 500));
    return `slow(${x}) ran on thread "${self.name || "worker"}"`;
}

export function boom() : never {
    throw new Error("kaboom");
}
