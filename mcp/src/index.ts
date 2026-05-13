#!/usr/bin/env node

import { Server } from '@modelcontextprotocol/sdk/server/index.js';
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import {
  CallToolRequestSchema,
  ListToolsRequestSchema,
} from '@modelcontextprotocol/sdk/types.js';

const STORAGE_API = process.env.AGENT_STORAGE_URL ?? 'http://localhost:3001';

// Helper: make an x402-aware request to the storage API
async function storageRequest(method: string, path: string, body?: Buffer | object): Promise<{ status: number; data: any }> {
  const url = `${STORAGE_API}${path}`;
  const headers: Record<string, string> = {};

  let rawBody: Buffer | undefined;
  if (body && method !== 'GET' && method !== 'HEAD') {
    if (Buffer.isBuffer(body)) {
      headers['Content-Type'] = 'application/octet-stream';
      rawBody = body;
    } else {
      headers['Content-Type'] = 'application/json';
      rawBody = Buffer.from(JSON.stringify(body));
    }
  }

  const response = await fetch(url, { method, headers, body: rawBody ? new Uint8Array(rawBody) : undefined });
  const contentType = response.headers.get('content-type') ?? '';

  let data: any;
  if (contentType.includes('application/json')) {
    data = await response.json();
  } else if (contentType.includes('application/octet-stream')) {
    data = { binary: true, size: response.headers.get('content-length') ?? '0' };
  } else {
    data = await response.text();
  }

  return { status: response.status, data };
}

const server = new Server(
  {
    name: 'vaultline',
    version: '0.1.0',
  },
  {
    capabilities: {
      tools: {},
    },
  }
);

// List available tools
server.setRequestHandler(ListToolsRequestSchema, async () => ({
  tools: [
    {
      name: 'storage_upload',
      description: 'Upload a file to agent storage. Requires x402 payment for writes over free tier.',
      inputSchema: {
        type: 'object',
        properties: {
          path: { type: 'string', description: 'File path (e.g. "workspace/project/config.json")' },
          content: { type: 'string', description: 'File content (base64 encoded for binary)' },
          contentType: { type: 'string', description: 'MIME type (e.g. "application/json")' },
        },
        required: ['path', 'content'],
      },
    },
    {
      name: 'storage_download',
      description: 'Download a file from agent storage. Free for files under 1MB, x402 payment required for larger files.',
      inputSchema: {
        type: 'object',
        properties: {
          path: { type: 'string', description: 'File path to download' },
        },
        required: ['path'],
      },
    },
    {
      name: 'storage_delete',
      description: 'Delete a file from agent storage. Free operation.',
      inputSchema: {
        type: 'object',
        properties: {
          path: { type: 'string', description: 'File path to delete' },
        },
        required: ['path'],
      },
    },
    {
      name: 'storage_list',
      description: 'List files under a path prefix. Free operation.',
      inputSchema: {
        type: 'object',
        properties: {
          prefix: { type: 'string', description: 'Path prefix to list (e.g. "workspace/project/")' },
        },
        required: ['prefix'],
      },
    },
    {
      name: 'storage_metadata',
      description: 'Get file metadata (size, type, modification date). Free operation.',
      inputSchema: {
        type: 'object',
        properties: {
          path: { type: 'string', description: 'File path to check' },
        },
        required: ['path'],
      },
    },
    {
      name: 'storage_usage',
      description: 'Get current storage usage and estimated costs. Free operation.',
      inputSchema: {
        type: 'object',
        properties: {},
      },
    },
  ],
}));

// Handle tool calls
server.setRequestHandler(CallToolRequestSchema, async (request) => {
  const { name, arguments: args } = request.params;

  try {
    switch (name) {
      case 'storage_upload': {
        const content = Buffer.from(args!.content as string, 'base64');
        const result = await storageRequest('PUT', `/v1/files/${args!.path}`, content);
        if (result.status === 402) {
          return {
            content: [{ type: 'text', text: `Payment required: ${JSON.stringify(result.data, null, 2)}` }],
            isError: true,
          };
        }
        return {
          content: [{ type: 'text', text: JSON.stringify(result.data, null, 2) }],
        };
      }

      case 'storage_download': {
        const result = await storageRequest('GET', `/v1/files/${args!.path}`);
        if (result.status === 402) {
          return {
            content: [{ type: 'text', text: `Payment required: ${JSON.stringify(result.data, null, 2)}` }],
            isError: true,
          };
        }
        return {
          content: [{ type: 'text', text: JSON.stringify(result.data, null, 2) }],
        };
      }

      case 'storage_delete': {
        const result = await storageRequest('DELETE', `/v1/files/${args!.path}`);
        return {
          content: [{ type: 'text', text: JSON.stringify(result.data, null, 2) }],
        };
      }

      case 'storage_list': {
        const result = await storageRequest('GET', `/v1/list/${args!.prefix ?? ''}`);
        return {
          content: [{ type: 'text', text: JSON.stringify(result.data, null, 2) }],
        };
      }

      case 'storage_metadata': {
        const result = await storageRequest('HEAD', `/v1/files/${args!.path}`);
        return {
          content: [{ type: 'text', text: JSON.stringify(result.data, null, 2) }],
        };
      }

      case 'storage_usage': {
        const result = await storageRequest('GET', '/v1/usage');
        return {
          content: [{ type: 'text', text: JSON.stringify(result.data, null, 2) }],
        };
      }

      default:
        return {
          content: [{ type: 'text', text: `Unknown tool: ${name}` }],
          isError: true,
        };
    }
  } catch (error: any) {
    return {
      content: [{ type: 'text', text: `Error: ${error.message}` }],
      isError: true,
    };
  }
});

// Start
async function main() {
  const transport = new StdioServerTransport();
  await server.connect(transport);
  console.error('Vaultline MCP server running on stdio');
}

main().catch(console.error);