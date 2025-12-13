export type AnyFn = (...args : any[]) => any;

export interface WorkerRequest {
    id : number;
    func : string;
    args : any[];
}


export interface WorkerResponseError {
    id : number;
    error : string;
}

export interface WorkerResponseSuccess {
    id : number;
    result : any;
}

export type WorkerResponse = WorkerResponseSuccess | WorkerResponseError;

export type AwaitedRet<F extends AnyFn> = Awaited<ReturnType<F>>;
export type RemoteRet<F extends AnyFn> = Promise<AwaitedRet<F>>;

export type ResolveRejectPair<T> = [(value: T | PromiseLike<T>) => void, (reason?: any) => void];