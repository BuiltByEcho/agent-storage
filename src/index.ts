import 'dotenv/config';
import { createApp } from './app.js';
import { SERVER_CONFIG } from './config.js';
import { initializeResourceServer } from './cdpFacilitator.js';

async function main() {
  await initializeResourceServer();

  const app = createApp();

  app.listen(SERVER_CONFIG.port, () => {
    console.log(`🚀 Vaultline running on port ${SERVER_CONFIG.port}`);
    console.log(`   Storage backend: Cloudflare R2`);
    console.log(`   Payment protocol: x402 (USDC on Base)`);
    console.log(`   Treasury configured: ${process.env.X402_TREASURY_WALLET ? 'yes' : 'no'}`);
  });
}

main().catch((error) => {
  console.error('Failed to initialize Vaultline:', error);
  process.exit(1);
});
