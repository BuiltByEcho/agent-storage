"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.AgentStorageClient = void 0;
const client_1 = require("@x402/core/client");
const http_1 = require("@x402/core/http");
const evm_1 = require("@x402/evm");
const auth_js_1 = require("./auth.js");
const errors_js_1 = require("./errors.js");
class AgentStorageClient {
    baseUrl;
    account;
    fetchImpl;
    client;
    httpClient;
    timeoutMs;
    constructor(options) {
        this.baseUrl = options.baseUrl.replace(/\/$/, '');
        this.account = options.account;
        this.fetchImpl = options.fetch ?? fetch;
        this.timeoutMs = options.timeoutMs ?? 30_000;
        this.client = new client_1.x402Client().register('eip155:*', new evm_1.ExactEvmScheme((0, evm_1.toClientEvmSigner)(this.account)));
        this.httpClient = new http_1.x402HTTPClient(this.client);
    }
    async upload(path, body, options = {}) {
        const normalizedPath = (0, auth_js_1.normalizeStoragePath)(path);
        const tier = options.tier ?? 'open';
        const headers = new Headers();
        if (options.contentType)
            headers.set('content-type', options.contentType);
        headers.set('x-storage-tier', tier);
        if (tier === 'private') {
            const authHeaders = await (0, auth_js_1.createStorageAuthHeaders)({
                account: this.account,
                method: 'PUT',
                path: normalizedPath,
            });
            for (const [key, value] of Object.entries(authHeaders))
                headers.set(key, value);
            if (options.ownerWallet)
                headers.set('x-owner-wallet', options.ownerWallet);
            if (options.allowedWallets?.length)
                headers.set('x-allowed-wallets', options.allowedWallets.join(','));
        }
        const response = await this.request(`/v1/files/${normalizedPath}`, {
            method: 'PUT',
            body,
            headers,
        });
        await (0, errors_js_1.assertOkResponse)(response, { method: 'PUT', url: `${this.baseUrl}/v1/files/${normalizedPath}` });
        return {
            response,
            data: (await response.json()),
        };
    }
    async download(path, options = {}) {
        const normalizedPath = (0, auth_js_1.normalizeStoragePath)(path);
        const response = await this.request(`/v1/files/${normalizedPath}`, {
            method: 'GET',
            headers: await this.buildAccessHeaders('GET', normalizedPath, options.tier),
        });
        await (0, errors_js_1.assertOkResponse)(response, { method: 'GET', url: `${this.baseUrl}/v1/files/${normalizedPath}` });
        return {
            response,
            data: new Uint8Array(await response.arrayBuffer()),
        };
    }
    async downloadText(path, options = {}) {
        const normalizedPath = (0, auth_js_1.normalizeStoragePath)(path);
        const response = await this.request(`/v1/files/${normalizedPath}`, {
            method: 'GET',
            headers: await this.buildAccessHeaders('GET', normalizedPath, options.tier),
        });
        await (0, errors_js_1.assertOkResponse)(response, { method: 'GET', url: `${this.baseUrl}/v1/files/${normalizedPath}` });
        return {
            response,
            text: await response.text(),
        };
    }
    async head(path, options = {}) {
        const normalizedPath = (0, auth_js_1.normalizeStoragePath)(path);
        const response = await this.request(`/v1/files/${normalizedPath}`, {
            method: 'HEAD',
            headers: await this.buildAccessHeaders('HEAD', normalizedPath, options.tier),
        });
        return (0, errors_js_1.assertOkResponse)(response, { method: 'HEAD', url: `${this.baseUrl}/v1/files/${normalizedPath}` });
    }
    async delete(path, options = {}) {
        const normalizedPath = (0, auth_js_1.normalizeStoragePath)(path);
        const response = await this.request(`/v1/files/${normalizedPath}`, {
            method: 'DELETE',
            headers: await this.buildAccessHeaders('DELETE', normalizedPath, options.tier),
        });
        await (0, errors_js_1.assertOkResponse)(response, { method: 'DELETE', url: `${this.baseUrl}/v1/files/${normalizedPath}` });
        return {
            response,
            data: (await response.json()),
        };
    }
    async list(prefix = '', options = {}) {
        const normalizedPrefix = (0, auth_js_1.normalizeStoragePath)(prefix);
        const suffix = normalizedPrefix ? `/v1/list/${normalizedPrefix}` : '/v1/list';
        const response = await this.request(suffix, {
            method: 'GET',
            headers: options.includePrivate
                ? await this.buildAccessHeaders('GET', normalizedPrefix || '/v1/list', 'private')
                : undefined,
        });
        await (0, errors_js_1.assertOkResponse)(response, { method: 'GET', url: `${this.baseUrl}${suffix}` });
        return {
            response,
            data: (await response.json()),
        };
    }
    async request(path, init = {}) {
        const url = `${this.baseUrl}${path}`;
        const requestInit = this.withTimeout(init);
        const initial = await this.fetchImpl(url, requestInit);
        if (initial.status !== 402)
            return initial;
        const bodyText = await initial.text();
        const parsedBody = bodyText ? JSON.parse(bodyText) : {};
        const paymentRequired = this.httpClient.getPaymentRequiredResponse((name) => initial.headers.get(name), parsedBody);
        const paymentPayload = await this.client.createPaymentPayload(paymentRequired);
        const headers = new Headers(init.headers ?? undefined);
        const paymentHeaders = this.httpClient.encodePaymentSignatureHeader(paymentPayload);
        for (const [key, value] of Object.entries(paymentHeaders))
            headers.set(key, value);
        return this.fetchImpl(url, this.withTimeout({
            ...init,
            headers,
        }));
    }
    withTimeout(init) {
        if (!this.timeoutMs || init.signal)
            return init;
        return {
            ...init,
            signal: AbortSignal.timeout(this.timeoutMs),
        };
    }
    async buildAccessHeaders(method, path, tier = 'open') {
        if (tier !== 'private')
            return undefined;
        const authHeaders = await (0, auth_js_1.createStorageAuthHeaders)({
            account: this.account,
            method,
            path,
        });
        return new Headers(authHeaders);
    }
}
exports.AgentStorageClient = AgentStorageClient;
//# sourceMappingURL=client.js.map