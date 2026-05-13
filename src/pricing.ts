import { PRICING } from './config.js';
import type { StorageTier } from './services/storage.js';

export function calculatePaymentAmount(
  operation: 'write' | 'read' | 'delete' | 'storage',
  sizeBytes: number,
  tier: StorageTier = 'open'
): number {
  const MIN_WRITE_CHARGE = 0.001;
  const MIN_STORAGE_CHARGE = 0.001;

  switch (operation) {
    case 'write': {
      const cost = calculateWriteCost(sizeBytes, tier);
      return Math.max(cost, MIN_WRITE_CHARGE);
    }
    case 'read': {
      if (sizeBytes <= PRICING.freeReadMaxBytes) return 0;
      return calculateRetrievalCost(sizeBytes, tier);
    }
    case 'delete':
      return 0;
    case 'storage': {
      const cost = calculateStorageCost(sizeBytes, 1, tier);
      return Math.max(cost, MIN_STORAGE_CHARGE);
    }
    default:
      return 0;
  }
}

export function calculateStorageCost(bytes: number, months = 1, tier: StorageTier = 'open'): number {
  const gb = bytes / (1024 * 1024 * 1024);
  return gb * getTierPricing(tier).storage * months;
}

export function calculateRetrievalCost(bytes: number, tier: StorageTier = 'open'): number {
  if (bytes <= PRICING.freeReadMaxBytes) return 0;
  const gb = bytes / (1024 * 1024 * 1024);
  return gb * getTierPricing(tier).retrieval;
}

export function calculateWriteCost(bytes: number, tier: StorageTier = 'open'): number {
  const gb = bytes / (1024 * 1024 * 1024);
  return gb * getTierPricing(tier).write;
}

export function getTierPricing(tier: StorageTier = 'open') {
  return tier === 'private' ? PRICING.private : PRICING.open;
}
