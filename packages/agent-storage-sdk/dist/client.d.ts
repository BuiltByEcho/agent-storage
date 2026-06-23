import { x402Client } from '@x402/core/client';
import { x402HTTPClient } from '@x402/core/http';
import type { PrivateKeyAccount } from 'viem/accounts';
import type { AgentStorageClientOptions, DeleteOptions, DeleteResponse, DownloadOptions, HeadOptions, ListOptions, ListResponse, UploadOptions, UploadResponse } from './types.js';
export declare class AgentStorageClient {
    readonly baseUrl: string;
    readonly account: PrivateKeyAccount;
    readonly fetchImpl: typeof fetch;
    readonly client: x402Client;
    readonly httpClient: x402HTTPClient;
    readonly timeoutMs: number;
    constructor(options: AgentStorageClientOptions);
    upload(path: string, body: BodyInit, options?: UploadOptions): Promise<{
        response: Response;
        data: UploadResponse;
    }>;
    download(path: string, options?: DownloadOptions): Promise<{
        response: Response;
        data: Uint8Array<ArrayBuffer>;
    }>;
    downloadText(path: string, options?: DownloadOptions): Promise<{
        response: Response;
        text: string;
    }>;
    head(path: string, options?: HeadOptions): Promise<Response>;
    delete(path: string, options?: DeleteOptions): Promise<{
        response: Response;
        data: DeleteResponse;
    }>;
    list(prefix?: string, options?: ListOptions): Promise<{
        response: Response;
        data: ListResponse;
    }>;
    request(path: string, init?: RequestInit): Promise<Response>;
    private withTimeout;
    private buildAccessHeaders;
}
//# sourceMappingURL=client.d.ts.map