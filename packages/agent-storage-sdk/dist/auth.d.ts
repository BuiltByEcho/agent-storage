import type { PrivateKeyAccount } from 'viem/accounts';
export declare function buildStorageAuthMessage(input: {
    method: string;
    path: string;
    wallet: string;
    timestamp: number;
}): string;
export declare function createStorageAuthHeaders(input: {
    account: PrivateKeyAccount;
    method: string;
    path: string;
    timestamp?: number;
}): Promise<{
    'x-auth-wallet': `0x${string}`;
    'x-auth-timestamp': string;
    'x-auth-signature': `0x${string}`;
}>;
export declare function normalizeStoragePath(path: string): string;
//# sourceMappingURL=auth.d.ts.map