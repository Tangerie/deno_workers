import { assert, assertEquals, assertThrows } from "@std/assert";
import { extractExportedNames, stripLiterals } from "../hooks/extract.ts";

const names = (src : string) => extractExportedNames(src).names.sort();

Deno.test("declaration exports", () => {
    assertEquals(
        names(`
            export function add(a: number, b: number) { return a + b; }
            export async function slow() {}
            export function* gen() {}
            export const answer = 42;
            export let counter = 0;
            export var legacy = true;
            export class Thing {}
            export enum Mode { A, B }
        `),
        ["Mode", "Thing", "add", "answer", "counter", "gen", "legacy", "slow"]
    );
});

Deno.test("brace exports incl. aliases and re-exports", () => {
    assertEquals(names(`const a = 1, b = 2; export { a, b as renamed };`), ["a", "renamed"]);
    assertEquals(names(`export { foo, bar as baz } from "./other.ts";`), ["baz", "foo"]);
});

Deno.test("default exports", () => {
    assert(extractExportedNames(`export default function main() {}`).hasDefault);
    assert(extractExportedNames(`const f = () => {}; export { f as default };`).hasDefault);
    assertEquals(extractExportedNames(`export default () => {}`).names, []);
});

Deno.test("type-only exports are ignored", () => {
    assertEquals(names(`export type Foo = number; export interface Bar { x: number }`), []);
    assertEquals(names(`export type { Baz } from "./other.ts";`), []);
    assertEquals(names(`type A = 1; const b = 2; export { type A, b };`), ["b"]);
});

Deno.test("exports inside comments/strings/templates are ignored", () => {
    assertEquals(
        names(`
            // export function commented() {}
            /* export const blockCommented = 1; */
            const s = "export function inString() {}";
            const t = \`export const inTemplate = \${"export const inInterp = 1"}\`;
            export function real() {}
        `),
        ["real"]
    );
});

Deno.test("template interpolation does not derail the lexer", () => {
    const src = 'const t = `a ${ { b: "}" } } c`;\nexport const after = 1;';
    assertEquals(names(src), ["after"]);
    assert(stripLiterals(src).includes("export const after"));
});

Deno.test("unsupported forms throw loudly", () => {
    assertThrows(() => extractExportedNames(`export * from "./other.ts";`), Error, "export *");
    assertThrows(() => extractExportedNames(`export const { a, b } = obj;`), Error, "destructuring");
    assertThrows(() => extractExportedNames(`export const [x] = arr;`), Error, "destructuring");
});
