/**
 * Frontend utility unit tests.
 * Run with: npx vitest (Vite's built-in test runner)
 * Or add to package.json: "test": "vitest"
 */

import { describe, it, expect } from 'vitest';

// ── fmtMoney helper (copied from AgentPortalPage pattern) ─────
const fmt = new Intl.NumberFormat('en-LK', { minimumFractionDigits: 2 });
const fmtMoney = (v) => `LKR ${fmt.format(Number(v) || 0)}`;
const fmtDate  = (d) => d
  ? new Date(d).toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' })
  : '-';

describe('fmtMoney', () => {
  it('formats zero', () => {
    expect(fmtMoney(0)).toBe('LKR 0.00');
  });

  it('formats a normal amount', () => {
    expect(fmtMoney(2500)).toBe('LKR 2,500.00');
  });

  it('handles null/undefined gracefully', () => {
    expect(fmtMoney(null)).toBe('LKR 0.00');
    expect(fmtMoney(undefined)).toBe('LKR 0.00');
  });

  it('handles string numbers', () => {
    expect(fmtMoney('500')).toBe('LKR 500.00');
  });
});

describe('fmtDate', () => {
  it('formats a date string', () => {
    const result = fmtDate('2026-05-06');
    expect(result).toContain('2026');
    expect(result).toContain('May');
  });

  it('returns em-dash for null', () => {
    expect(fmtDate(null)).toBe('-');
    expect(fmtDate(undefined)).toBe('-');
  });
});

// ── Subscription status logic ─────────────────────────────────
const statusInfo = (status) => {
  const map = {
    active:          { label: 'Active',           cls: 'badge-active'  },
    trial:           { label: 'Active',           cls: 'badge-active'  }, // trial shows as active
    expired:         { label: 'Expired',          cls: 'badge-expired' },
    pending_payment: { label: 'Pending Payment',  cls: 'badge-warning' },
    suspended:       { label: 'Suspended',        cls: 'badge-gray'    },
  };
  return map[status] || { label: status, cls: 'badge-gray' };
};

describe('statusInfo', () => {
  it('maps active correctly', () => {
    expect(statusInfo('active').label).toBe('Active');
  });

  it('maps trial to Active (no trial badge per business rules)', () => {
    expect(statusInfo('trial').label).toBe('Active');
    expect(statusInfo('trial').cls).toBe('badge-active');
  });

  it('maps expired correctly', () => {
    expect(statusInfo('expired').label).toBe('Expired');
  });

  it('handles unknown status gracefully', () => {
    const result = statusInfo('unknown_status');
    expect(result.label).toBe('unknown_status');
  });
});

// ── Commission type label ─────────────────────────────────────
const commTypeLabel = (t) =>
  t === 'onboarding' ? 'Onboarding' : t === 'monthly' ? 'Monthly' : t;

describe('commTypeLabel', () => {
  it('labels onboarding', () => expect(commTypeLabel('onboarding')).toBe('Onboarding'));
  it('labels monthly',    () => expect(commTypeLabel('monthly')).toBe('Monthly'));
  it('passes through unknown', () => expect(commTypeLabel('special')).toBe('special'));
});
