"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.buildStorageAuthMessage = buildStorageAuthMessage;
exports.createStorageAuthHeaders = createStorageAuthHeaders;
exports.normalizeStoragePath = normalizeStoragePath;
const viem_1 = require("viem");
function buildStorageAuthMessage(input) {
    return [
        'AgentStorage auth',
        `method:${input.method.toUpperCase()}`,
        `path:${normalizeStoragePath(input.path)}`,
        `wallet:${(0, viem_1.getAddress)(input.wallet)}`,
        `timestamp:${input.timestamp}`,
    ].join('\n');
}
async function createStorageAuthHeaders(input) {
    const timestamp = input.timestamp ?? Date.now();
    const message = buildStorageAuthMessage({
        method: input.method,
        path: input.path,
        wallet: input.account.address,
        timestamp,
    });
    const signature = await input.account.signMessage({ message });
    return {
        'x-auth-wallet': input.account.address,
        'x-auth-timestamp': String(timestamp),
        'x-auth-signature': signature,
    };
}
function normalizeStoragePath(path) {
    return path.replace(/^\/+/, '');
}
//# sourceMappingURL=auth.js.map