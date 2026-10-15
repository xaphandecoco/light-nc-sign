import { randomPassword } from '../cloud/parsefunction/otpStore.js';

// One-off (runs once at start-up, then leaves a marker row): older builds made every contact and
// signer account with their email address as the password. Give each of them a long random one.
// Staff and admins (anyone with a contracts_Users row) keep their own passwords. Resetting a
// password also ends that account's open sessions, which is what we want.
const NAME = 'resetContactPasswords_1';
const MARKER = 'LncMigration';
const master = { useMasterKey: true };

export default async function resetContactPasswords() {
  try {
    if (await new Parse.Query(MARKER).equalTo('name', NAME).first(master)) return 0;

    const staff = new Set();
    await new Parse.Query('contracts_Users')
      .exists('UserId')
      .select('UserId')
      .each(row => staff.add(row.get('UserId').id), master);

    const done = new Set();
    await new Parse.Query('contracts_Contactbook')
      .exists('UserId')
      .select('UserId')
      .each(async row => {
        const id = row.get('UserId').id;
        if (staff.has(id) || done.has(id)) return;
        done.add(id);
        const user = new Parse.User();
        user.id = id;
        user.set('password', randomPassword());
        await user.save(null, master);
      }, master);

    await new Parse.Object(MARKER).save({ name: NAME, count: done.size }, master);
    console.log(` INFO  Contact passwords reset: ${done.size} account(s).`);
    return done.size;
  } catch (err) {
    console.log(' ERROR  resetContactPasswords failed, will retry at next start:', err?.message);
    return -1;
  }
}
