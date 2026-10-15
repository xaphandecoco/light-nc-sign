import { checkOtp, normalizeEmail } from './otpStore.js';

export default async function VerifyEmail(request) {
  try {
    if (!request?.user) {
      throw new Parse.Error(Parse.Error.INVALID_SESSION_TOKEN, 'User is not authenticated.');
    } else {
      const email = normalizeEmail(request.params.email);
      if (await checkOtp(email, request.params.otp)) {
        // Fetch the user by their objectId
        const isEmailVerified = request?.user?.get('emailVerified');
        if (isEmailVerified) {
          return { message: 'Email is already verified.' };
        } else {
          const userQuery = new Parse.Query(Parse.User);
          const user = await userQuery.get(request?.user.id, {
            sessionToken: request?.user.getSessionToken(),
          });

          // Update the emailVerified field to true
          user.set('emailVerified', true);
          // Save the user object
          const res = await user.save(null, { useMasterKey: true });
          if (res) {
            return { message: 'Email is verified.' };
          } else {
            const error = new Error('Something went wrong, please try again later!');
            error.code = 400; // Set the error code (e.g., 400 for bad request)
            throw error;
          }
        }
      } else {
        const error = new Error('OTP is invalid.');
        error.code = 400; // Set the error code (e.g., 400 for bad request)
        throw error;
      }
    }
  } catch (err) {
    console.log('err ', err.code + ' ' + err.message);
    throw err;
  }
}
