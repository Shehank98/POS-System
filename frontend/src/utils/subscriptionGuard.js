import {
  getCachedSubscription,
  getLastVerifiedOnline, setLastVerifiedOnline,
  getLastRunTimestamp,   setLastRunTimestamp,
  getTampered,           setTampered,
} from './offlineDB';

const GRACE_DAYS         = 5;
const EXPIRY_WARN_DAYS   = 7;
const TAMPER_TOLERANCE   = 2 * 60 * 1000; // 2 minutes — allows minor clock drift

// Called on every successful online auth (login or /me)
export async function recordOnlineVerification() {
  await setLastVerifiedOnline(Date.now());
}

// Called on app startup and every 5 minutes — seeds the anti-tamper check
export async function recordRunTimestamp() {
  const now  = Date.now();
  const last = await getLastRunTimestamp();
  if (last && now < last - TAMPER_TOLERANCE) {
    await setTampered(true);
  }
  await setLastRunTimestamp(now);
}

// Clears tamper flag — called on fresh successful login (user explicitly re-authenticated)
export async function clearTampered() {
  await setTampered(false);
}

/**
 * Returns a subscription state object used by SubscriptionGuard and SubscriptionStatusBar.
 * Priority: time_tampered → needs_online → suspended → locked → in_grace → expiring_soon → active
 *
 * @param {object|null} user  — live user from authStore (most recent data)
 */
export async function getSubscriptionState(user) {
  const [sub, lastVerified, tampered] = await Promise.all([
    getCachedSubscription(),
    getLastVerifiedOnline(),
    getTampered(),
  ]);

  // 1. Time tamper check
  if (tampered) {
    return {
      status: 'time_tampered', canUsePOS: false, isReadOnly: true,
      message: 'System time manipulation detected. Please correct your device time to continue.',
    };
  }

  // 2. Max offline without verification: 5 days
  const daysSinceVerified = lastVerified
    ? (Date.now() - lastVerified) / 86_400_000
    : Infinity;
  if (daysSinceVerified > GRACE_DAYS && !navigator.onLine) {
    return {
      status: 'needs_online', canUsePOS: false, isReadOnly: true,
      daysSince: Math.floor(daysSinceVerified),
      message: `Offline for ${Math.floor(daysSinceVerified)} days. Please connect to the internet to verify your subscription.`,
    };
  }

  // 3. Use live user data if available, else fall back to cached subscription
  const status  = user?.subscription_status   ?? sub?.subscription_status;
  const endDate = user?.subscription_end_date  ?? sub?.subscription_end_date;

  if (status === 'suspended') {
    return {
      status: 'suspended', canUsePOS: false, isReadOnly: true,
      message: 'This account has been suspended. Please contact support.',
    };
  }

  if (endDate) {
    const msPerDay    = 86_400_000;
    const daysOverdue = (Date.now() - new Date(endDate).getTime()) / msPerDay;
    const daysLeft    = Math.ceil(-daysOverdue);

    if (daysOverdue > GRACE_DAYS) {
      return {
        status: 'locked', canUsePOS: false, isReadOnly: true, graceRemaining: 0,
        message: 'Your subscription has expired. Please renew to continue.',
      };
    }

    if (daysOverdue > 0) {
      const graceRemaining = Math.ceil(GRACE_DAYS - daysOverdue);
      return {
        status: 'in_grace', canUsePOS: true, isReadOnly: false, graceRemaining,
        message: `Your subscription has expired. Grace period: ${graceRemaining} day${graceRemaining === 1 ? '' : 's'} left. Please connect to the internet to renew.`,
      };
    }

    if (daysLeft <= EXPIRY_WARN_DAYS) {
      return {
        status: 'expiring_soon', canUsePOS: true, isReadOnly: false, daysLeft,
        message: `Your subscription expires in ${daysLeft} day${daysLeft === 1 ? '' : 's'}.`,
      };
    }
  } else if (status === 'expired') {
    return {
      status: 'locked', canUsePOS: false, isReadOnly: true, graceRemaining: 0,
      message: 'Your subscription has expired. Please renew to continue.',
    };
  }

  return { status: 'active', canUsePOS: true, isReadOnly: false, message: '' };
}
