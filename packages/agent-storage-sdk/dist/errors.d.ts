export type AgentStorageErrorOptions = {
    status: number;
    statusText?: string;
    url?: string;
    method?: string;
    body?: unknown;
    response?: Response;
};
export declare class AgentStorageError extends Error {
    readonly name = "AgentStorageError";
    readonly status: number;
    readonly statusText?: string;
    readonly url?: string;
    readonly method?: string;
    readonly body?: unknown;
    readonly response?: Response;
    constructor(message: string, options: AgentStorageErrorOptions);
}
export declare function parseResponseBody(response: Response): Promise<any>;
export declare function assertOkResponse(response: Response, input?: {
    url?: string;
    method?: string;
}): Promise<Response>;
//# sourceMappingURL=errors.d.ts.map