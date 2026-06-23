"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.AgentStorageError = void 0;
exports.parseResponseBody = parseResponseBody;
exports.assertOkResponse = assertOkResponse;
class AgentStorageError extends Error {
    name = 'AgentStorageError';
    status;
    statusText;
    url;
    method;
    body;
    response;
    constructor(message, options) {
        super(message);
        this.status = options.status;
        this.statusText = options.statusText;
        this.url = options.url;
        this.method = options.method;
        this.body = options.body;
        this.response = options.response;
    }
}
exports.AgentStorageError = AgentStorageError;
async function parseResponseBody(response) {
    if (response.status === 204)
        return undefined;
    const contentType = response.headers.get('content-type') ?? '';
    if (contentType.includes('application/json')) {
        try {
            return await response.json();
        }
        catch {
            return undefined;
        }
    }
    const text = await response.text();
    if (!text)
        return undefined;
    try {
        return JSON.parse(text);
    }
    catch {
        return text;
    }
}
async function assertOkResponse(response, input = {}) {
    if (response.ok)
        return response;
    const body = await parseResponseBody(response);
    const detail = typeof body === 'string'
        ? body.slice(0, 180)
        : body && typeof body === 'object' && 'error' in body
            ? String(body.error)
            : response.statusText || 'request failed';
    throw new AgentStorageError(`AgentStorage ${input.method ?? 'request'} failed with ${response.status}${detail ? `: ${detail}` : ''}`, {
        status: response.status,
        statusText: response.statusText,
        url: input.url,
        method: input.method,
        body,
        response,
    });
}
//# sourceMappingURL=errors.js.map