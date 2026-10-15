import { allow, checkOtp, normalizeEmail } from './otpStore.js';

// Emailed-code sign-in is for signers/contacts only. Staff and admins use their password.
async function AuthLoginAsMail(request) {
  try {
    const email = normalizeEmail(request.params.email);
    const ip = request.headers?.['x-real-ip'] || request.ip || 'unknown';
    if (!email || !allow(`login-ip:${ip}`, 60, 60 * 60 * 1000)) return 'Invalid Otp';
    if (!(await checkOtp(email, request.params.otp))) return 'Invalid Otp';

    const user = await new Parse.Query(Parse.User).equalTo('email', email).first({ useMasterKey: true });
    if (!user) return 'user not found!';
    const admin = await new Parse.Query('contracts_Users')
      .equalTo('Email', email)
      .equalTo('UserRole', 'contracts_Admin')
      .first({ useMasterKey: true });
    if (admin) return 'user not found!';
    // Contacts are created with their email as password; anyone with a real password signs in with it.
    let session;
    try {
      session = await Parse.User.logIn(user.get('username'), email);
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
