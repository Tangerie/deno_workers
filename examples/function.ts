import { loadWorker } from "@tangerie/workers";
import type { Add, Foo } from "./function.worker.ts";

const { use, close } = loadWorker(new URL("./function.worker.ts", import.meta.url));

const add = use<Add>("add");
const foo = use<Foo>("foo");

const r = await add(2, 4);
const b = await add(2, 5);
console.log(r, b);
console.log(await foo(""))

await close();