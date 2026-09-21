const { describe, it } = require('node:test');
const assert = require('node:assert/strict');
const {
  getWalletAddressFromClerkUser,
  getWalletSummaryFromClerkUser,
  truncateWalletAddress,
} = require('../lib/wallet');

describe('wallet helpers', () => {
  it('reads primary web3 wallet from Clerk user', () => {
    const user = {
      primaryWeb3WalletId: 'w2',
      web3Wallets: [
        { id: 'w1', web3Wallet: '0x1111111111111111111111111111111111111111' },
        { id: 'w2', web3Wallet: '0x2222222222222222222222222222222222222222' },
      ],
    };
    assert.equal(
      getWalletAddressFromClerkUser(user),
      '0x2222222222222222222222222222222222222222',
    );
  });

  it('returns wallet summary flags', () => {
    const summary = getWalletSummaryFromClerkUser({
      web3Wallets: [{ id: 'w1', web3Wallet: '0xabcdefabcdefabcdefabcdefabcdefabcdefabcd' }],
    });
    assert.equal(summary.walletConnected, true);
    assert.equal(summary.walletAddressTruncated, truncateWalletAddress(summary.walletAddress));
  });

  it('returns disconnected when no wallets', () => {
    const summary = getWalletSummaryFromClerkUser({ web3Wallets: [] });
    assert.equal(summary.walletConnected, false);
    assert.equal(summary.walletAddress, null);
  });
});
