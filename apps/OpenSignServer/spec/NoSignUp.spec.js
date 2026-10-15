// Light NC Sign: nobody can create an account on their own. Only the master key can
// (owner account at deploy), or a signed-in admin through the `adduser` function.
import axios from 'axios';

const BASE = 'http://localhost:30001/test';
const APP = { 'X-Parse-Application-Id': 'test', 'Content-Type': 'application/json' };
const MASTER = { ...APP, 'X-Parse-Master-Key': 'test' };
const post = (path, body, headers = APP) =>
  axios.post(BASE + path, body, { headers, validateStatus: () => true });
const userCount = async () => new Parse.Query(Parse.User).count({ useMasterKey: true });

const owner = {
  name: 'Owner',
  email: 'owner@example.org',
  password: 'Owner-pass-123',
  role: 'contracts_Admin',
  company: 'Light NC',
};

describe('public sign-up is closed', () => {
  it('refuses POST /users without a session (REST sign-up)', async () => {
    const before = await userCount();
    const res = await post('/users', { username: 'evil@example.org', password: 'x-123456', email: 'evil@example.org' });
    expect(res.status).toBeGreaterThanOrEqual(400);
    expect(res.data.code).toBe(119);
    expect(res.data.error).toBe('Sign-up is turned off.');
    expect(await userCount()).toBe(before);
  });

  it('refuses account creation through an auth adapter', async () => {
    const before = await userCount();
    const res = await post('/users', { authData: { google: { id: '1', id_token: 'x' } } });
    expect(res.status).toBeGreaterThanOrEqual(400);
    expect(await userCount()).toBe(before);
  });

  it('has no usersignup or newsletter function', async () => {
    for (const fn of ['usersignup', 'newsletter']) {
      const res = await post(`/functions/${fn}`, { userDetails: owner });
      expect(res.data.code).toBe(141); // invalid function
    }
  });

  it('refuses addadmin without the master key', async () => {
    const before = await userCount();
    const res = await post('/functions/addadmin', { userDetails: owner });
    expect(res.data.code).toBe(119);
    expect(await userCount()).toBe(before);
  });
});

describe('owner and staff accounts', () => {
  it('addadmin with the master key makes the owner; sign-up stays closed; admin can add staff', async () => {
    const made = await post('/functions/addadmin', { userDetails: owner }, MASTER);
    expect(made.status).toBe(200);
    expect(made.data.result.message).toBe('User sign up');

    const login = await axios.get(BASE + '/login', {
      headers: APP,
      params: { username: owner.email, password: owner.password },
      validateStatus: () => true,
    });
    expect(login.status).toBe(200);
    const session = { ...APP, 'X-Parse-Session-Token': login.data.sessionToken };

    // still closed for everyone else
    const stranger = await post('/users', { username: 'x@example.org', password: 'x-123456' });
    expect(stranger.data.code).toBe(119);
    // and for the owner's own session (a signed-in user cannot POST /users either)
    const viaOwner = await post('/users', { username: 'y@example.org', password: 'x-123456' }, session);
    expect(viaOwner.data.code).toBe(119);

    // the admin-only function that makes staff accounts still works
    const ext = await new Parse.Query('contracts_Users').equalTo('Email', owner.email).first({ useMasterKey: true });
    const added = await post(
      '/functions/adduser',
      {
        name: 'Staff One',
        email: 'staff@example.org',
        password: 'Staff-pass-123',
        role: 'User',
        tenantId: ext.get('TenantId').id,
        organization: { objectId: ext.get('OrganizationId').id, company: 'Light NC' },
        team: ext.get('TeamIds')[0].id,
      },
      session
    );
    expect(added.status).toBe(200);
    expect(added.data.result.Email).toBe('staff@example.org');
    const staff = await new Parse.Query(Parse.User).equalTo('username', 'staff@example.org').first({ useMasterKey: true });
    expect(staff).toBeDefined();
  });
});
