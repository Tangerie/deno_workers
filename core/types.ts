export interface TMessage<M extends Record<string, unknown[]>, K extends keyof M> {
    type : K,
    payload : M[K]
}
