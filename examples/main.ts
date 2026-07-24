// Run with the hooks preloaded:
//   deno task example
//   (equivalent to: deno run -A --import ./register.ts examples/main.ts)
import { add, boom, slow } from "./math.worker.ts";
import { closeWorker } from "@tangerie/workers";

console.log("add(1, 2) =", await add(1, 2));
console.log(await slow("hello"));

try {
    await boom();
} catch (err) {
    console.log("boom() rejected:", (err as Error).message.split("\n")[0]);
}

await closeWorker(import.meta.resolve("./math.worker.ts"));
console.log("worker closed");
