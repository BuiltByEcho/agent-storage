import express from 'express';
import cors from 'cors';
import { paymentMiddleware as paymentMiddlewareV2 } from '@x402/express';
import filesRouter from './routes/files.js';
import { SERVER_CONFIG, X402_CONFIG } from './config.js';
import { getResourceServer, X402_MAINNET_NETWORK } from './cdpFacilitator.js';

export function createApp() {
  const app = express();

  app.disable('x-powered-by');
  app.set('trust proxy', 1);

  app.use(
    cors({
      origin: SERVER_CONFIG.corsOrigins.includes('*') ? true : SERVER_CONFIG.corsOrigins,
    })
  );
  app.use(express.json({ limit: SERVER_CONFIG.bodyLimit }));
  app.use('/v1/files', express.raw({ type: () => true, limit: SERVER_CONFIG.bodyLimit }));

  app.use((req, _res, next) => {
    const paymentHeader = req.headers['x-payment'] || req.headers['payment-signature'];
    const hasXPayment = Boolean(paymentHeader);
    const logPath = req.path.startsWith('/v1/shares/') ? '/v1/shares/[redacted]' : req.path;
    if (req.path.startsWith('/v1/test/paid-ping')) {
      console.log(`${new Date().toISOString()} ${req.method} ${logPath} paymentHeader=${hasXPayment ? 'yes' : 'no'}`);
    } else {
      console.log(`${new Date().toISOString()} ${req.method} ${logPath}`);
    }
    next();
  });

  const testPayTo = (process.env.X402_TEST_PAYTO || X402_CONFIG.treasuryWallet) as `0x${string}` | '';
  if (testPayTo) {
    const resourceServer = getResourceServer();

    app.use(
      paymentMiddlewareV2(
        {
          'GET /v1/test/paid-ping': {
            accepts: {
              scheme: 'exact',
              price: '$0.001',
              network: X402_MAINNET_NETWORK,
              payTo: testPayTo,
            },
            description: 'Vaultline paid ping test',
            mimeType: 'application/json',
          },
        },
        resourceServer
      )
    );
  }

  app.get('/v1/test/paid-ping', (_req, res) => {
    res.json({ ok: true, paid: true, service: 'vaultline', ts: new Date().toISOString() });
  });

  app.use(filesRouter);

  app.get('/', (_req, res) => {
    res.json({
      service: 'Vaultline — Dropbox for Agents',
      version: '0.1.1',
      docs: '/v1/health',
      endpoints: {
        upload: 'PUT /v1/files/{path}',
        download: 'GET /v1/files/{path}',
        delete: 'DELETE /v1/files/{path}',
        metadata: 'HEAD /v1/files/{path}',
        list: 'GET /v1/list/{prefix}',
        usage: 'GET /v1/usage',
        health: 'GET /v1/health',
      },
      pricing: {
        open: {
          storage: '$0.08/GB/month',
          retrieval: '$0.015/GB (free under 1MB)',
          write: '$0.03/GB',
        },
        private: {
          storage: '$0.12/GB/month',
          retrieval: '$0.02/GB (free under 1MB, auth still required)',
          write: '$0.045/GB',
        },
        encrypted: 'coming soon',
        list: 'free',
        metadata: 'free',
        delete: 'free',
      },
      payments: {
        protocol: 'x402',
        currency: 'USDC on Base',
        contract: '0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913',
      },
    });
  });

  return app;
}
