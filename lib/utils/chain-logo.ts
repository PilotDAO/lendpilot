/**
 * Client-side utility for getting chain logos and names
 * This file is safe to use in client components (no fs dependency)
 */

// Static mapping of marketKey to chainId (client-safe)
const MARKET_TO_CHAIN_ID: Record<string, number> = {
  "ethereum-v3": 1,
  "ethereum-ether-fi-v3": 1,
  "ethereum-lido-v3": 1,
  "ethereum-horizon-v3": 1,
  "optimism-v3": 10,
  "bnb-v3": 56,
  "gnosis-v3": 100,
  "polygon-v3": 137,
  "sonic-v3": 146,
  "zk-sync-v3": 324,
  "metis-v3": 1088,
  "soneium-v3": 1868,
  "base-v3": 8453,
  "plasma-v3": 9745,
  "arbitrum-v3": 42161,
  "celo-v3": 42220,
  "avalanche-v3": 43114,
  "ink-v3": 57073,
  "linea-v3": 59144,
  "scroll-v3": 534352,
};

// Map chainId to chain logo URL
// Using multiple CDN sources for reliability
const CHAIN_LOGO_MAP: Record<number, string> = {
  1: "https://cryptologos.cc/logos/ethereum-eth-logo.png", // Ethereum
  10: "https://cryptologos.cc/logos/optimism-ethereum-op-logo.png", // Optimism
  56: "https://cryptologos.cc/logos/bnb-bnb-logo.png", // BNB Chain
  100: "https://cryptologos.cc/logos/gnosis-gno-logo.png", // Gnosis
  137: "https://cryptologos.cc/logos/polygon-matic-logo.png", // Polygon
  146: "https://cryptologos.cc/logos/ethereum-eth-logo.png", // Sonic (fallback to ETH)
  324: "https://cryptologos.cc/logos/ethereum-eth-logo.png", // ZKsync (fallback to ETH)
  1088: "https://cryptologos.cc/logos/metis-andromeda-metis-logo.png", // Metis
  1868: "https://cryptologos.cc/logos/ethereum-eth-logo.png", // Soneium (fallback)
  8453: "https://assets.coingecko.com/coins/images/27509/small/base.png", // Base
  9745: "https://cryptologos.cc/logos/ethereum-eth-logo.png", // Plasma (fallback)
  42161: "https://cryptologos.cc/logos/arbitrum-arb-logo.png", // Arbitrum
  42220: "https://cryptologos.cc/logos/celo-celo-logo.png", // Celo
  43114: "https://cryptologos.cc/logos/avalanche-avax-logo.png", // Avalanche
  57073: "https://cryptologos.cc/logos/ethereum-eth-logo.png", // Ink (fallback)
  59144: "https://assets.coingecko.com/coins/images/31049/small/linea.png", // Linea
  534352: "https://assets.coingecko.com/coins/images/31050/small/scroll.png", // Scroll
};

// Map chainId to chain name
const CHAIN_NAME_MAP: Record<number, string> = {
  1: "Ethereum",
  10: "Optimism",
  56: "BNB Chain",
  100: "Gnosis",
  137: "Polygon",
  146: "Sonic",
  324: "ZKsync",
  1088: "Metis",
  1868: "Soneium",
  8453: "Base",
  9745: "Plasma",
  42161: "Arbitrum",
  42220: "Celo",
  43114: "Avalanche",
  57073: "Ink",
  59144: "Linea",
  534352: "Scroll",
};

/**
 * Get blockchain logo URL based on marketKey
 * Returns a URL to the chain logo (using external CDN or local assets)
 * Client-safe: no fs dependency
 */
export function getChainLogoUrl(marketKey: string): string | null {
  const chainId = MARKET_TO_CHAIN_ID[marketKey];
  if (!chainId) {
    return null;
  }

  return CHAIN_LOGO_MAP[chainId] || null;
}

/**
 * Get chain name from marketKey
 * Client-safe: no fs dependency
 */
export function getChainName(marketKey: string): string {
  const chainId = MARKET_TO_CHAIN_ID[marketKey];
  if (!chainId) {
    // Fallback: extract from marketKey
    return marketKey
      .replace(/-v3$/i, "")
      .replace(/-/g, " ")
      .replace(/\b\w/g, (l) => l.toUpperCase());
  }

  return CHAIN_NAME_MAP[chainId] || marketKey;
}
