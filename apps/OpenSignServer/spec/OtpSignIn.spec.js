// Light NC Sign: emailed sign-in codes are short-lived, limited in tries, rate limited,
// and only work for signer/contact accounts.
import axios from 'axios';
import { saveOtp } from '../cloud/parsefunction/otpStore.js';

const BASE = 'http://localhost:30001/test';
const APP = { 'X-Parse-Application-Id': 'test', 'X-Parse-Javascript-Key': 'test', 'Content-Type': 'application/json' };
const call = async (fn, body) =>
  (await axios.post(`${BASE}/functions/${fn}`, body, { headers: APP, validateStatus: () => true })).data;
const makeUser = async (email, password) => {
  const u = new Parse.User();
  u.set('username', email);
  u.set('email', email);
  u.set('password', password);
  return u.save(null, { useMasterKey: true });
};
const otpRows = email => new Parse.Query('defaultdata_Otp').equalTo('Email', email).find({ useMasterKey: true });

describe('emailed sign-in code', () => {
  beforeAll(async () => {
    await makeUser('contact@example.org', 'contact@example.org'); // contact: email is the password
    await makeUser('staff2@example.org', 'Staff-pass-456'); // real password
    await makeUser('boss@example.org', 'boss@example.org');
    await new Parse.Object('contracts_Users').save({ Email: 'boss@example.org', UserRole: 'contracts_Admin' }, { useMasterKey: true });
  });

  it('makes a 6-digit code that is stored hashed and expires in 10 minutes', async () => {
    const code = await saveOtp('six@example.org');
    expect(code).toMatch(/^\d{6}$/);
    const [row] = await otpRows('six@example.org');
    expect(row.get('OTP')).not.toContain(code);
    const ms = row.get('ExpiresAt').getTime() - Date.now();
    expect(ms).toBeGreaterThan(9 * 60 * 1000);
    expect(ms).toBeLessThanOrEqual(10 * 60 * 1000);
  });

  it('signs a contact in once, then deletes the code', async () => {
    const code = await saveOtp('contact@example.org');
    const ok = await call('AuthLoginAsMail', { email: 'contact@example.org', otp: code });
    expect(ok.result.sessionToken).toBeDefined();
    expect(await otpRows('contact@example.org')).toEqual([]);
    const again = await call('AuthLoginAsMail', { email: 'contact@example.org', otp: code });
    expect(again.result).toBe('Invalid Otp');
  });

  it('invalidates the code after 5 wrong tries, even for the right code', async () => {
    const code = await saveOtp('contact@example.org');
    const wrong = code === '000000' ? '111111' : '000000';
    for (let i = 0; i < 5; i++) {
      expect((await call('AuthLoginAsMail', { email: 'contact@example.org', otp: wrong })).result).toBe('Invalid Otp');
    }
    expect((await call('AuthLoginAsMail', { email: 'contact@example.org', otp: code })).result).toBe('Invalid Otp');
    expect(await otpRows('contact@example.org')).toEqual([]);
  });

  it('refuses an expired code', async () => {
    const code = await saveOtp('contact@example.org');
    const [row] = await otpRows('contact@example.org');
    row.set('ExpiresAt', new Date(Date.now() - 1000));
    await row.save(null, { useMasterKey: true });
    expect((await call('AuthLoginAsMail', { email: 'contact@example.org', otp: code })).result).toBe('Invalid Otp');
  });

  it('refuses an admin and a user who has a real password, even with a correct code', async () => {
    for (const email of ['boss@example.org', 'staff2@example.org']) {
      const code = await saveOtp(email);
      const res = await call('AuthLoginAsMail', { email, otp: code });
      expect(res.result).toBe('user not found!');
    }
  });

  it('rate limits sending codes per email', async () => {
    const email = 'flood@example.org';
    const results = [];
    for (let i = 0; i < 4; i++) results.push(await call('SendOTPMailV1', { email }));
    expect(results[0].result).toBe('Otp send');
    expect(results[3].code).toBeDefined(); // 4th request inside 10 minutes is refused
    expect(results[3].error).toMatch(/Too many/);
  });

  it('rejects a malformed email', async () => {
    expect((await call('SendOTPMailV1', { email: 'nope' })).result).toBe('Please Enter valid email');
  });

  it('no longer has the updateuserasadmin function', async () => {
    expect((await call('updateuserasadmin', { email: 'x@example.org', masterkey: 'test' })).code).toBe(141);
  });
});
