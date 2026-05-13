import 'dotenv/config';
import { X402_CONFIG } from './src/config.js';
import { assertFacilitatorSupport } from './src/cdpFacilitator.js';

const network = process.argv[2] ?? 'eip155:8453';

async function main() {
  console.log(`facilitator: ${X402_CONFIG.facilitatorUrl}`);
  console.log(`network: ${network}`);

  const supported = await assertFacilitatorSupport(network);
  console.log('supported kinds:');
  for (const kind of supported.kinds) {
    console.log(`- v${kind.x402Version} ${kind.scheme} ${kind.network}`);
  }

  console.log('mainnet facilitator support confirmed');
}

main().catch((err) => {
  console.error('facilitator check failed:', err instanceof Error ? err.message : err);
  process.exit(1);
});
