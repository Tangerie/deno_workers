// Message maps as seen from the PARENT side.
// The worker entry instantiates its emitter with these swapped.

export type ParentOut = {
    init: [url: string];
    call: [id: number, name: string, args: unknown[]];
};

export type ParentIn = {
    ready: [names: string[]];
    initError: [message: string];
    result: [id: number, value: unknown];
    error: [id: number, message: string];
};
