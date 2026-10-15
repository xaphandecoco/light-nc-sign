import { appName, smtpenable, updateMailCount } from '../../Utils.js';
import { allow, isEmail, isLocked, normalizeEmail, saveOtp } from './otpStore.js';
async function getDocument(docId) {
  try {
    const query = new Parse.Query('contracts_Document');
    query.equalTo('objectId', docId);
    query.include('ExtUserPtr');
    query.notEqualTo('IsArchive', true);
    const res = await query.first({ useMasterKey: true });
    return res?.toJSON()?.ExtUserPtr?.objectId;
  } catch (err) {
    console.log('err ', err?.message);
  }
}
async function sendMailOTPv1(request) {
  const email = normalizeEmail(request.params.email);
  if (!isEmail(email)) return 'Please Enter valid email';
  const ip = request.headers?.['x-real-ip'] || request.ip || 'unknown';
  // 3 codes per email per 10 minutes, 10 per email per day, 20 per address per hour: stops inbox flooding.
  if (
    isLocked(email) ||
    !allow(`otp-email:${email}`, 3, 10 * 60 * 1000) ||
    !allow(`otp-day:${email}`, 10, 24 * 60 * 60 * 1000) ||
    !allow(`otp-ip:${ip}`, 20, 60 * 60 * 1000)
  ) {
    throw new Parse.Error(Parse.Error.CONNECTION_FAILED, 'Too many requests. Try again later.');
  }
  try {
    const TenantId = request.params.TenantId ? request.params.TenantId : undefined;
    const code = await saveOtp(email, TenantId);
    const AppName = appName;
    const mailsender = smtpenable ? process.env.SMTP_USER_EMAIL : process.env.MAILGUN_SENDER;
    try {
      await Parse.Cloud.sendEmail({
        sender: AppName + ' <' + mailsender + '>',
        recipient: email,
        subject: `Your ${AppName} OTP`,
        text: 'otp email',
        html:
          `<html><head><meta http-equiv='Content-Type' content='text/html;charset=UTF-8' /></head><body><div style='background-color:#f5f5f5;padding:20px'><div style='background-color:white;'><div style='background-color:red;padding:2px;font-family:system-ui;background-color:#47a3ad;'><p style='font-size:20px;font-weight:400;color:white;padding-left:20px;'>OTP Verification</p></div><div style='padding:20px;'><p style='font-family:system-ui;font-size:14px;'>Your OTP for ${AppName} verification is (valid for 10 minutes):</p><p style='text-decoration:none;font-weight:bolder;color:blue;font-size:45px;margin:20px;'>` +
          code +
          '</p></div></div></div></body></html>',
      });
      if (request.params?.docId) {
        const extUserId = await getDocument(request.params?.docId);
        if (extUserId) updateMailCount(extUserId);
      }
    } catch (err) {
      console.log('error in send OTP mail', err?.message);
    }
    return 'Otp send';
  } catch (err) {
    console.log('err in sendMailOTPv1', err?.message);
    return 'Please try again';
  }
}
export default sendMailOTPv1;
