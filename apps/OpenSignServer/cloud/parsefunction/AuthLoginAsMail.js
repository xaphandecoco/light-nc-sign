import { allow, checkOtp, normalizeEmail, randomPassword } from './otpStore.js';

// Emailed-code sign-in is for signers/contacts only. Staff and admins use their password.
// Nobody knows a contact's password: once the code checks out we set a fresh random one, log in
// with it to open the session, and throw it away.
async function AuthLoginAsMail(request) {
  try {
    const email = normalizeEmail(request.params.email);
    const ip = request.headers?.['x-real-ip'] || request.ip || 'unknown';
    if (!email || !allow(`login-ip:${ip}`, 60, 60 * 60 * 1000)) return 'Invalid Otp';
    if (!(await checkOtp(email, request.params.otp))) return 'Invalid Otp';

    const user = await new Parse.Query(Parse.User).equalTo('email', email).first({ useMasterKey: true });
    if (!user) return 'user not found!';
    // Anyone with a staff/admin row has a real password and must use it; only plain contacts may continue.
    const staff = Parse.Query.or(
      new Parse.Query('contracts_Users').equalTo('UserId', user),
      new Parse.Query('contracts_Users').equalTo('Email', email)
    );
    if (await staff.first({ useMasterKey: true })) return 'user not found!';
    const contact = await new Parse.Query('contracts_Contactbook').equalTo('UserId', user).first({ useMasterKey: true });
    if (!contact) return 'user not found!';

    const password = randomPassword();
    user.set('password', password);
    await user.save(null, { useMasterKey: true });
    let session;
    try {
      session = await Parse.User.logIn(user.get('username'), password);
    } catch (e) {
      return 'user not found!';
    }
    if (!session.get('emailVerified')) {
      session.set('emailVerified', true);
      await session.save(null, { useMasterKey: true });
    }
    return session.toJSON();
  } catch (err) {
    console.log('err in AuthLoginAsMail', err?.message);
    return 'Result not found';
  }
}
export default AuthLoginAsMail;
