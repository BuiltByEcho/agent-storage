export type AgentStorageErrorOptions = {
  status: number;
  statusText?: string;
  url?: string;
  method?: string;
  body?: unknown;
  response?: Response;
};

export class AgentStorageError extends Error {
  readonly name = 'AgentStorageError';
  readonly status: number;
  readonly statusText?: string;
  readonly url?: string;
  readonly method?: string;
  readonly body?: unknown;
  readonly response?: Response;

  constructor(message: string, options: AgentStorageErrorOptions) {
    super(message);
    this.status = options.status;
    this.statusText = options.statusText;
    this.url = options.url;
    this.method = options.method;
    this.body = options.body;
    this.response = options.response;
  }
}

export async function parseResponseBody(response: Response) {
  if (response.status === 204) return undefined;

  const contentType = response.headers.get('content-type') ?? '';
  if (contentType.includes('application/json')) {
    try {
      return await response.json();
    } catch {
      return undefined;
    }
  }

  const text = await response.text();
  if (!text) return undefined;

  try {
    return JSON.parse(text);
  } catch {
    return text;
  }
}

export async function assertOkResponse(response: Response, input: { url?: string; method?: string } = {}) {
  if (response.ok) return response;

  const body = await parseResponseBody(response);
  const detail = typeof body === 'string'
    ? body.slice(0, 180)
    : body && typeof body === 'object' && 'error' in body
      ? String((body as { error?: unknown }).error)
      : response.statusText || 'request failed';

  throw new AgentStorageError(
    `AgentStorage ${input.method ?? 'request'} failed with ${response.status}${detail ? `: ${detail}` : ''}`,
    {
      status: response.status,
      statusText: response.statusText,
      url: input.url,
      method: input.method,
      body,
      response,
    }
  );
}
