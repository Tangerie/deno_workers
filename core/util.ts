export const isWorker = () =>
    typeof WorkerGlobalScope !== "undefined" && self instanceof WorkerGlobalScope;
