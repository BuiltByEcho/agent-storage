import { HTTPFacilitatorClient, x402ResourceServer } from '@x402/core/server';
import { ExactEvmScheme } from '@x402/evm/exact/server';
import { generateJwt } from '@coinbase/cdp-sdk/auth';
import { X402_CONFIG } from './config.js';

export const X402_MAINNET_NETWORK = 'eip155:8453' as const;

const CDP_HOST = 'api.cdp.coinbase.com';

function isCdpFacilitator(url: string) {
  try {
    return new URL(url).host === CDP_HOST;
  } catch {
    return false;
  }
}

async function createCdpAuthHeaders(requestPath: string) {
  if (!X402_CONFIG.cdpApiKeyId || !X402_CONFIG.cdpApiKeySecret) {
    throw new Error(
      'CDP facilitator selected but CDP_API_KEY_ID/CDP_API_KEY_SECRET are missing. Mainnet x402 requires authenticated CDP facilitator access.'
    );
  }

  const jwt = await generateJwt({
    apiKeyId: X402_CONFIG.cdpApiKeyId,
    apiKeySecret: X402_CONFIG.cdpApiKeySecret,
    requestMethod: requestPath === '/supported' ? 'GET' : 'POST',
    requestHost: CDP_HOST,
    requestPath: `/platform/v2/x402${requestPath}`,
    expiresIn: 120,
  });

  return { Authorization: `Bearer ${jwt}` };
}

export function createFacilitatorClient(url = X402_CONFIG.facilitatorUrl) {
  const createAuthHeaders = isCdpFacilitator(url)
    ? async () => ({
        supported: await createCdpAuthHeaders('/supported'),
        verify: await createCdpAuthHeaders('/verify'),
        settle: await createCdpAuthHeaders('/settle'),
      })
    : undefined;

  return new HTTPFacilitatorClient({
    url: url as `${string}://${string}`,
    createAuthHeaders,
  });
}

function buildResourceServer() {
  return new x402ResourceServer(createFacilitatorClient()).register(X402_MAINNET_NETWORK, new ExactEvmScheme());
}

const sharedResourceServer = buildResourceServer();
let sharedResourceServerInit: Promise<void> | null = null;

export function getResourceServer() {
  return sharedResourceServer;
}

export function initializeResourceServer() {
  if (!sharedResourceServerInit) {
    sharedResourceServerInit = sharedResourceServer.initialize();
  }
  return sharedResourceServerInit;
}

export async function assertFacilitatorSupport(network: string) {
  const client = createFacilitatorClient();
  const supported = await client.getSupported();
  const networks = supported.kinds.map((kind) => `${kind.x402Version}:${kind.scheme}:${kind.network}`);
  const matched = supported.kinds.some((kind) => kind.network === network && kind.x402Version === 2);

  if (!matched) {
    throw new Error(
      `Facilitator ${X402_CONFIG.facilitatorUrl} does not advertise x402 v2 support for ${network}. Supported kinds: ${networks.join(', ')}`
    );
  }

  return supported;
}
