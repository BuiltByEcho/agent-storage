import { x402Client } from '@x402/core/client';
import { x402HTTPClient } from '@x402/core/http';
import { ExactEvmScheme, toClientEvmSigner } from '@x402/evm';
import type { PrivateKeyAccount } from 'viem/accounts';
import { createStorageAuthHeaders, normalizeStoragePath } from './auth.js';
import type {
  AgentStorageClientOptions,
  DeleteOptions,
  DeleteResponse,
  DownloadOptions,
  HeadOptions,
  ListOptions,
  ListResponse,
  StorageTier,
  UploadOptions,
  UploadResponse,
} from './types.js';

export class AgentStorageClient {
  readonly baseUrl: string;
  readonly account: PrivateKeyAccount;
  readonly fetchImpl: typeof fetch;
  readonly client: x402Client;
  readonly httpClient: x402HTTPClient;

  constructor(options: AgentStorageClientOptions) {
    this.baseUrl = options.baseUrl.replace(/\/$/, '');
    this.account = options.account;
    this.fetchImpl = options.fetch ?? fetch;
    this.client = new x402Client().register('eip155:*', new ExactEvmScheme(toClientEvmSigner(this.account)));
    this.httpClient = new x402HTTPClient(this.client);
  }

  async upload(path: string, body: BodyInit, options: UploadOptions = {}) {
    const normalizedPath = normalizeStoragePath(path);
    const tier = options.tier ?? 'open';
    const headers = new Headers();

    if (options.contentType) headers.set('content-type', options.contentType);
    headers.set('x-storage-tier', tier);

    if (tier === 'private') {
      const authHeaders = await createStorageAuthHeaders({
        account: this.account,
        method: 'PUT',
        path: normalizedPath,
      });
      for (const [key, value] of Object.entries(authHeaders)) headers.set(key, value);
      if (options.ownerWallet) headers.set('x-owner-wallet', options.ownerWallet);
      if (options.allowedWallets?.length) headers.set('x-allowed-wallets', options.allowedWallets.join(','));
    }

    const response = await this.request(`/v1/files/${normalizedPath}`, {
      method: 'PUT',
      body,
      headers,
    });

    return {
      response,
      data: (await response.json()) as UploadResponse,
    };
  }

  async download(path: string, options: DownloadOptions = {}) {
    const normalizedPath = normalizeStoragePath(path);
    const response = await this.request(`/v1/files/${normalizedPath}`, {
      method: 'GET',
      headers: await this.buildAccessHeaders('GET', normalizedPath, options.tier),
    });

    return {
      response,
      data: new Uint8Array(await response.arrayBuffer()),
    };
  }

  async downloadText(path: string, options: DownloadOptions = {}) {
    const normalizedPath = normalizeStoragePath(path);
    const response = await this.request(`/v1/files/${normalizedPath}`, {
      method: 'GET',
      headers: await this.buildAccessHeaders('GET', normalizedPath, options.tier),
    });

    return {
      response,
      text: await response.text(),
    };
  }

  async head(path: string, options: HeadOptions = {}) {
    const normalizedPath = normalizeStoragePath(path);
    return this.request(`/v1/files/${normalizedPath}`, {
      method: 'HEAD',
      headers: await this.buildAccessHeaders('HEAD', normalizedPath, options.tier),
    });
  }

  async delete(path: string, options: DeleteOptions = {}) {
    const normalizedPath = normalizeStoragePath(path);
    const response = await this.request(`/v1/files/${normalizedPath}`, {
      method: 'DELETE',
      headers: await this.buildAccessHeaders('DELETE', normalizedPath, options.tier),
    });

    return {
      response,
      data: (await response.json()) as DeleteResponse,
    };
  }

  async list(prefix = '', options: ListOptions = {}) {
    const normalizedPrefix = normalizeStoragePath(prefix);
    const suffix = normalizedPrefix ? `/v1/list/${normalizedPrefix}` : '/v1/list';
    const response = await this.request(suffix, {
      method: 'GET',
      headers: options.includePrivate
        ? await this.buildAccessHeaders('GET', normalizedPrefix || '/v1/list', 'private')
        : undefined,
    });

    return {
      response,
      data: (await response.json()) as ListResponse,
    };
  }

  async request(path: string, init: RequestInit = {}) {
    const url = `${this.baseUrl}${path}`;
    const initial = await this.fetchImpl(url, init);
    if (initial.status !== 402) return initial;

    const bodyText = await initial.text();
    const parsedBody = bodyText ? JSON.parse(bodyText) : {};
    const paymentRequired = this.httpClient.getPaymentRequiredResponse(
      (name) => initial.headers.get(name),
      parsedBody
    );
    const paymentPayload = await this.client.createPaymentPayload(paymentRequired);

    const headers = new Headers(init.headers ?? undefined);
    const paymentHeaders = this.httpClient.encodePaymentSignatureHeader(paymentPayload);
    for (const [key, value] of Object.entries(paymentHeaders)) headers.set(key, value);

    return this.fetchImpl(url, {
      ...init,
      headers,
    });
  }

  private async buildAccessHeaders(method: string, path: string, tier: StorageTier = 'open') {
    if (tier !== 'private') return undefined;
    const authHeaders = await createStorageAuthHeaders({
      account: this.account,
      method,
      path,
    });
    return new Headers(authHeaders);
  }
}
