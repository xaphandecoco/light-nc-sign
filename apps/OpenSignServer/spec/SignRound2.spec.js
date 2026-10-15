// Light NC Sign round 2: contacts never have a guessable password, the mail relay is closed,
// the visitor address comes from the proxy, and the sign-in code limits hold.
import axios from 'axios';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { saveOtp } from '../cloud/parsefunction/otpStore.js';
import sendMailOTPv1 from '../cloud/parsefunction/SendMailOTPv1.js';
import resetContactPasswords from '../migrationdb/resetContactPasswords.js';
import { getUserIP } from '../index.js';

const BASE = 'http://localhost:30001/test';
const APP = { 'X-Parse-Application-Id': 'test', 'X-Parse-Javascript-Key': 'test', 'Content-Type': 'application/json' };
const post = async (url, body, headers = {}) =>
  (await axios.post(`${BASE}/${url}`, body, { headers: { ...APP, ...headers }, validateStatus: () => true })).data;
const call = (fn, body, token) => post(`functions/${fn}`, body, token ? { 'X-Parse-Session-Token': token } : {});
const login = (username, password) => post('login', { username, password });
const makeUser = async (email, password) => {
  const u = new Parse.User();
  u.set('username', email);
  u.set('email', email);
  u.set('password', password);
  return u.save(null, { useMasterKey: true });
};
const makeStaff = async (email, password = 'Staff-pass-123456') => {
  const user = await makeUser(email, password);
  const ext = await new Parse.Object('contracts_Users').save({ Email: email, UserId: user }, { useMasterKey: true });
  return { user, ext, token: (await login(email, password)).sessionToken };
};
const makeContact = async email => {
  const user = await makeUser(email, 'y'.repeat(40));
  const contact = await new Parse.Object('contracts_Contactbook').save(
    { Email: email, Name: email, UserId: user },
    { useMasterKey: true }
  );
  return { user, contact };
};
const contactToken = async email => {
  const code = await saveOtp(email);
  return (await call('AuthLoginAsMail', { email, otp: code })).result.sessionToken;
};

describe('contact accounts have no guessable password', () => {
  it('savecontact makes an account that cannot log in with the email as password', async () => {
    const staff = await makeStaff('owner1@example.org');
    const res = await call('savecontact', { name: 'Sam', email: 'sam.signer@example.org' }, staff.token);
    expect(res.result.objectId).toBeDefined();
    expect((await login('sam.signer@example.org', 'sam.signer@example.org')).code).toBe(101);
  });

  it('a contact created by the contact-book hook cannot log in with the email as password', async () => {
    await new Parse.Object('contracts_Contactbook').save(
      { Name: 'Hook', Email: 'hook.signer@example.org' },
      { useMasterKey: true }
    );
    let user;
    for (let i = 0; i < 20 && !user; i++) {
      user = await new Parse.Query(Parse.User).equalTo('email', 'hook.signer@example.org').first({ useMasterKey: true });
      if (!user) await new Promise(r => setTimeout(r, 100));
    }
    expect(user).toBeDefined();
    expect((await login('hook.signer@example.org', 'hook.signer@example.org')).code).toBe(101);
  });

  it('no server file sets a password to the email address', () => {
    const dir = path.join(path.dirname(fileURLToPath(import.meta.url)), '..', 'cloud');
    const files = fs.readdirSync(dir, { recursive: true }).filter(f => String(f).endsWith('.js'));
    expect(files.length).toBeGreaterThan(20);
    for (const f of files) {
      const src = fs.readFileSync(path.join(dir, String(f)), 'utf8');
      expect(src).not.toMatch(/set\(\s*['"]password['"]\s*,\s*(email|Email|requestemail)/);
      expect(src).not.toMatch(/logIn\([^)]*,\s*email\s*\)/);
    }
  });

  it('emailed-code sign-in works and leaves no known password behind', async () => {
    await makeContact('door@example.org');
    expect((await login('door@example.org', 'door@example.org')).code).toBe(101);
    const token = await contactToken('door@example.org');
    expect(token).toBeDefined();
    expect((await login('door@example.org', 'door@example.org')).code).toBe(101);
    expect((await login('door@example.org', 'y'.repeat(40))).code).toBe(101); // old password was replaced
    const me = await axios.get(`${BASE}/users/me`, { headers: { ...APP, 'X-Parse-Session-Token': token } });
    expect(me.data.email).toBe('door@example.org');
  });

  it('the migration resets old email-as-password contacts and leaves staff alone, once', async () => {
    const oldUser = await makeUser('old.contact@example.org', 'old.contact@example.org');
    await new Parse.Object('contracts_Contactbook').save(
      { Email: 'old.contact@example.org', UserId: oldUser },
      { useMasterKey: true }
    );
    await makeStaff('keeps@example.org', 'keeps@example.org');
    expect((await login('old.contact@example.org', 'old.contact@example.org')).sessionToken).toBeDefined();

    expect(await resetContactPasswords()).toBeGreaterThanOrEqual(1);
    expect((await login('old.contact@example.org', 'old.contact@example.org')).code).toBe(101);
    expect((await login('keeps@example.org', 'keeps@example.org')).sessionToken).toBeDefined();
    expect(await resetContactPasswords()).toBe(0); // marker row: does not run twice
  });
});

describe('sendmailv3 is not an open relay', () => {
  const mail = { recipient: 'victim@example.org', subject: 'hi', html: '<b>hi</b>', from: 'Boss', cc: 'c@example.org' };

  it('refuses callers without a session', async () => {
    const res = await call('sendmailv3', mail);
    expect(res.code).toBe(209);
  });

  it('refuses a contact who sends their own recipient, subject and html', async () => {
    await makeContact('plain@example.org');
    const res = await call('sendmailv3', mail, await contactToken('plain@example.org'));
    expect(res.code).toBe(119);
  });

  it('staff must give exactly one valid recipient', async () => {
    const staff = await makeStaff('owner2@example.org');
    for (const recipient of ['a@example.org,b@example.org', 'a@example.org b@example.org', 'nope', '']) {
      expect((await call('sendmailv3', { ...mail, recipient }, staff.token)).code).toBe(102);
    }
    const ok = await call('sendmailv3', { ...mail, recipient: 'a@example.org' }, staff.token);
    expect(ok.code).toBeUndefined();
  });

  it('a signer may only trigger the fixed mail for their own document', async () => {
    const staff = await makeStaff('owner3@example.org');
    const a = await makeContact('first.signer@example.org');
    const b = await makeContact('second.signer@example.org');
    await makeContact('stranger@example.org');
    const ptr = o => ({ __type: 'Pointer', className: 'contracts_Contactbook', objectId: o.contact.id });
    const doc = await new Parse.Object('contracts_Document').save(
      {
        Name: 'Test doc',
        SendinOrder: true,
        ExtUserPtr: { __type: 'Pointer', className: 'contracts_Users', objectId: staff.ext.id },
        Placeholders: [
          { Id: 1, Role: 'signer', signerPtr: ptr(a), signerObjId: a.contact.id },
          { Id: 2, Role: 'signer', signerPtr: ptr(b), signerObjId: b.contact.id },
        ],
      },
      { useMasterKey: true }
    );
    const tokenA = await contactToken('first.signer@example.org');
    const tokenB = await contactToken('second.signer@example.org');
    const tokenC = await contactToken('stranger@example.org');

    // caller-chosen text and recipients are ignored; the stranger and a made-up document are refused
    const okA = await call('sendmailv3', { docId: doc.id, recipient: 'victim@example.org', html: 'x' }, tokenA);
    expect(okA.code).toBeUndefined();
    expect(okA.result).toBeDefined();
    expect((await call('sendmailv3', { docId: doc.id }, tokenC)).code).toBe(119);
    expect((await call('sendmailv3', { docId: 'nope' }, tokenA)).code).toBe(119);
    // the last signer has nobody after them
    expect((await call('sendmailv3', { docId: doc.id }, tokenB)).result).toEqual({ status: 'success' });
  });
});

describe('client address behind Caddy', () => {
  it('uses the single address Caddy sets, never the first entry a visitor typed', () => {
    const req = h => ({ headers: h, socket: { remoteAddress: '::ffff:172.18.0.5' } });
    expect(getUserIP(req({ 'x-forwarded-for': '203.0.113.9' }))).toBe('203.0.113.9');
    expect(getUserIP(req({ 'x-forwarded-for': '6.6.6.6, 203.0.113.9' }))).toBe('203.0.113.9');
    expect(getUserIP(req({}))).toBe('172.18.0.5');
  });
});

describe('sign-in code send limits', () => {
  it('caps codes per email per day', async () => {
    let now = Date.now();
    spyOn(Date, 'now').and.callFake(() => now);
    let n = 0;
    const send = () =>
      sendMailOTPv1({ params: { email: 'daily@example.org' }, headers: { 'x-real-ip': `10.0.0.${++n}` } });
    for (let i = 0; i < 10; i++) {
      expect(await send()).toBe('Otp send');
      if (i % 3 === 2) now += 11 * 60 * 1000; // the 10-minute limit allows 3 at a time
    }
    now += 11 * 60 * 1000;
    await expectAsync(send()).toBeRejectedWithError(/Too many/);
    now += 24 * 60 * 60 * 1000;
    expect(await send()).toBe('Otp send');
  });
});
