export function add(a: number, b: number): number {
    return a + b;
}

export async function slow(x: string, ms = 150): Promise<string> {
    await new Promise((resolve) => setTimeout(resolve, ms));
    return `slow:${x}`;
}

export function boom(message: string): never {
    throw new Error(message);
}

export const notAFunction = 42;
