import crypto from 'node:crypto';

// One-time sign-in codes: 6 digits, 10 minutes, 5 wrong tries, deleted on success.
const TTL_MS = 10 * 60 * 1000;
const MAX_TRIES = 5;
const CLASS = 'defaultdata_Otp';

export const normalizeEmail = e =>
  typeof e === 'string' && e.length <= 254 ? e.trim().toLowerCase() : '';
export const isEmail = e => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(e);

const hash = (email, code) =>
  crypto
    .createHmac('sha256', process.env.MASTER_KEY || 'otp')
    .update(`${email}:${code}`)
    .digest('hex');

// ponytail: in-memory counters, fine for one server process; move to Mongo if we ever run two.
const hits = new Map();
export function allow(key, max, windowMs) {
  const now = Date.now();
  const recent = (hits.get(key) || []).filter(t => now - t < windowMs);
  if (recent.length >= max) {
    hits.set(key, recent);
    return false;
  }
  recent.push(now);
  hits.set(key, recent);
  return true;
}
setInterval(
  () => {
    const now = Date.now();
    for (const [k, v] of hits) if (v.every(t => now - t > 60 * 60 * 1000)) hits.delete(k);
  },
  10 * 60 * 1000
).unref();

export async function saveOtp(email, tenantId) {
  const code = String(crypto.randomInt(0, 1000000)).padStart(6, '0');
  const existing = await new Parse.Query(CLASS).equalTo('Email', email).first({ useMasterKey: true });
  const row = existing || new Parse.Object(CLASS);
  row.set('Email', email);
  row.set('OTP', hash(email, code));
  row.set('ExpiresAt', new Date(Date.now() + TTL_MS));
  row.set('Attempts', 0);
  if (tenantId) row.set('TenantId', tenantId);
  await row.save(null, { useMasterKey: true });
  return code;
}

// Returns true once for a correct, unexpired code; the code is deleted on success.
export async function checkOtp(email, code) {
  const row = await new Parse.Query(CLASS).equalTo('Email', email).first({ useMasterKey: true });
  if (!row) return false;
  const expires = row.get('ExpiresAt');
  if (!expires || expires.getTime() < Date.now()) {
    await row.destroy({ useMasterKey: true });
    return false;
  }
  row.increment('Attempts');
  await row.save(null, { useMasterKey: true });
  if (row.get('Attempts') > MAX_TRIES) {
    await row.destroy({ useMasterKey: true });
    return false;
  }
  const given = Buffer.from(hash(email, String(code ?? '').trim()));
  const want = Buffer.from(String(row.get('OTP')));
  if (given.length !== want.length || !crypto.timingSafeEqual(given, want)) {
    if (row.get('Attempts') >= MAX_TRIES) await row.destroy({ useMasterKey: true });
    return false;
  }
  await row.destroy({ useMasterKey: true });
  return true;
}
