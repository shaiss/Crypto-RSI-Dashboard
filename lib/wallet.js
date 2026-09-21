/**
 * Clerk Web3 wallet helpers (read-only; no on-chain execution).
 */

function normalizeWalletAddress(raw) {
  if (raw == null) {
    return null;
  }
  const address = String(raw).trim();
  if (!address) {
    return null;
  }
  return address;
}

/**
 * Extract a connected wallet address from a Clerk User object.
 * Uses web3Wallets (and web3 external accounts as a fallback).
 *
 * @param {import('@clerk/backend').User | null | undefined} user
 * @returns {string|null}
 */
function getWalletAddressFromClerkUser(user) {
  if (!user || typeof user !== 'object') {
    return null;
  }

  const wallets = Array.isArray(user.web3Wallets) ? user.web3Wallets : [];
  if (wallets.length > 0) {
    const primaryId = user.primaryWeb3WalletId;
    const selected = primaryId
      ? wallets.find((entry) => entry.id === primaryId)
      : null;
    const wallet = selected || wallets[0];
    const fromWallet = wallet?.web3Wallet ?? wallet?.address ?? wallet?.walletAddress;
    const normalized = normalizeWalletAddress(fromWallet);
    if (normalized) {
      return normalized;
    }
  }

  const external = Array.isArray(user.externalAccounts) ? user.externalAccounts : [];
  for (const account of external) {
    const provider = String(account.provider || '').toLowerCase();
    const strategy = String(account.verification?.strategy || '').toLowerCase();
    if (provider.includes('web3') || strategy === 'web3' || provider === 'metamask') {
      const normalized = normalizeWalletAddress(
        account.web3Wallet ?? account.username ?? account.publicMetadata?.walletAddress,
      );
      if (normalized) {
        return normalized;
      }
    }
  }

  return null;
}

/**
 * @param {string|null} address
 * @returns {string|null}
 */
function truncateWalletAddress(address) {
  const normalized = normalizeWalletAddress(address);
  if (!normalized) {
    return null;
  }
  if (normalized.length <= 12) {
    return normalized;
  }
  return `${normalized.slice(0, 6)}…${normalized.slice(-4)}`;
}

/**
 * @param {import('@clerk/backend').User | null | undefined} user
 */
function getWalletSummaryFromClerkUser(user) {
  const address = getWalletAddressFromClerkUser(user);
  return {
    walletConnected: Boolean(address),
    walletAddress: address,
    walletAddressTruncated: truncateWalletAddress(address),
  };
}

module.exports = {
  getWalletAddressFromClerkUser,
  getWalletSummaryFromClerkUser,
  truncateWalletAddress,
  normalizeWalletAddress,
};
