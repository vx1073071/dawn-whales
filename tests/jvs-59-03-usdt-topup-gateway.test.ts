/**
 * J-59-03 Tests: USDT Topup Gateway (R59 v19)
 *
 * Tests:
 * 01-03: TRC-20 topup flow
 * 04-06: Confirmation + failure
 * 07-08: Internal transfer + platform wallet
 */
import { describe, it, expect, beforeEach } from 'vitest';
import {
  USDTTopupGateway,
  getTopupGateway,
  resetTopupGateway,
} from '../electron/engine/portfolio/usdt-topup-gateway';

describe('J-59-03: USDTTopupGateway', () => {
  let gateway: USDTTopupGateway;

  beforeEach(() => {
    resetTopupGateway();
    gateway = getTopupGateway();
  });

  describe('TRC-20 Topup', () => {
    it('01: initiate topup creates pending record', () => {
      const record = gateway.initiateTopup('alice', 100, 'trc20');
      expect(record.status).toBe('pending');
      expect(record.amountUSDT).toBe(100);
      expect(record.creator).toBe('alice');
      expect(record.toAddress.length).toBeGreaterThan(10);
    });

    it('02: confirmTopup updates status', () => {
      const record = gateway.initiateTopup('alice', 50);
      gateway.confirmTopup(record.id);

      const confirmed = gateway.getCreatorTopups('alice')[0];
      expect(confirmed.status).toBe('confirmed');
      expect(gateway.getCreatorTotalDeposited('alice')).toBe(50);
    });

    it('03: failTopup marks failed', () => {
      const record = gateway.initiateTopup('alice', 50);
      gateway.failTopup(record.id, 'Network timeout');

      const failed = gateway.getCreatorTopups('alice')[0];
      expect(failed.status).toBe('failed');
      expect(failed.errorMessage).toBe('Network timeout');
      expect(gateway.getCreatorTotalDeposited('alice')).toBe(0); // not counted
    });

    it('04: reject negative amount', () => {
      expect(() => gateway.initiateTopup('alice', -1)).toThrow('positive');
    });

    it('05: reject zero amount', () => {
      expect(() => gateway.initiateTopup('alice', 0)).toThrow('positive');
    });
  });

  describe('Topup History', () => {
    it('06: getCreatorTopups returns all for creator', () => {
      gateway.initiateTopup('alice', 10);
      gateway.initiateTopup('alice', 20);
      gateway.initiateTopup('bob', 30);

      expect(gateway.getCreatorTopups('alice').length).toBe(2);
      expect(gateway.getCreatorTopups('bob').length).toBe(1);
    });

    it('07: getCreatorTotalDeposited only counts confirmed', () => {
      const r1 = gateway.initiateTopup('alice', 10);
      gateway.initiateTopup('alice', 20);

      gateway.confirmTopup(r1.id);
      expect(gateway.getCreatorTotalDeposited('alice')).toBe(10);
    });
  });

  describe('Internal Transfer', () => {
    it('08: internal transfer is immediate', () => {
      const transfer = gateway.internalTransfer('alice', 'bob', 50, 'Gift');
      expect(transfer.status).toBe('completed');
      expect(transfer.fromCreator).toBe('alice');
      expect(transfer.toCreator).toBe('bob');
      expect(transfer.amountUSDT).toBe(50);
      expect(transfer.description).toBe('Gift');
    });

    it('09: reject self-transfer', () => {
      expect(() => gateway.internalTransfer('alice', 'alice', 50)).toThrow('self');
    });

    it('10: getInternalTransfers filters by creator', () => {
      gateway.internalTransfer('alice', 'bob', 10);
      gateway.internalTransfer('charlie', 'alice', 20);

      expect(gateway.getInternalTransfers('alice').length).toBe(2);
    });
  });

  describe('Platform Wallet & Exchange Rate', () => {
    it('11: platform wallet address is generated', () => {
      const wallet = gateway.getPlatformWallet();
      expect(wallet.address.length).toBeGreaterThan(20);
      expect(wallet.totalReceivedUSDT).toBe(0);
    });

    it('12: exchange rate is 7.2', () => {
      expect(gateway.getExchangeRate()).toBe(7.2);
      expect(gateway.usdtToCny(10)).toBe(72);
      expect(gateway.cnyToUsdt(72)).toBe(10);
    });

    it('13: reset clears everything', () => {
      gateway.initiateTopup('alice', 50);
      gateway.reset();

      expect(gateway.getAllTopups().length).toBe(0);
      expect(gateway.getCreatorTotalDeposited('alice')).toBe(0);
    });
  });
});
