import { defineWorkerFunction } from "@tangerie/workers";

const add = (a : number, b : number) => a + b;
const foo = async (arg : string) => await new Promise(resolve => setTimeout(resolve, 5000));

defineWorkerFunction("add", add);
defineWorkerFunction("foo", foo);

export type Add = typeof add;
export type Foo = typeof foo;