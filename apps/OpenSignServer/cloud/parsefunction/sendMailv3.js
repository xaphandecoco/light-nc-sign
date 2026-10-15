import formData from 'form-data';
import Mailgun from 'mailgun.js';
import { appName, mailTemplate, smtpenable, smtpsecure, updateMailCount } from '../../Utils.js';
import { createTransport } from 'nodemailer';
import { allow, isEmail } from './otpStore.js';
export async function sendMailProvider(req) {
  const app = appName;
  const extUserId = req.params?.extUserId || '';
  const reportMsg = `<p style="font-size: 13px; color:grey; text-align: center;">This email was sent through Light NC Sign. If you were not expecting it, you can ignore it.</p>`;

  const mailgunApiKey = process.env.MAILGUN_API_KEY;
  let transporterSMTP;
  try {
    let mailgunClient;
    let mailgunDomain;
    if (smtpenable) {
      let transporterConfig = {
        host: process.env.SMTP_HOST,
        port: process.env.SMTP_PORT || 465,
        secure: smtpsecure,
      };

      // ✅ Add auth only if BOTH username & password exist
      const smtpUser = process.env.SMTP_USERNAME;
      const smtpPass = process.env.SMTP_PASS;

      if (smtpUser && smtpPass) {
        transporterConfig.auth = {
          user: process.env.SMTP_USERNAME ? process.env.SMTP_USERNAME : process.env.SMTP_USER_EMAIL,
          pass: smtpPass,
        };
      }
      transporterSMTP = createTransport(transporterConfig);
    } else {
      if (mailgunApiKey) {
        const mailgun = new Mailgun(formData);
        mailgunClient = mailgun.client({ username: 'api', key: mailgunApiKey });
        mailgunDomain = process.env.MAILGUN_DOMAIN;
      }
    }

    const from = req.params.from || '';
    const mailsender = smtpenable ? process.env.SMTP_USER_EMAIL : process.env.MAILGUN_SENDER;
    const replyto = req.params?.replyto || '';
    const messageParams = {
      from: from + ' <' + mailsender + '>',
      to: req.params.recipient,
      subject: req.params.subject,
      text: req.params.text || 'mail',
      html: req.params?.html ? req.params.html + reportMsg : '',
      bcc: req.params.bcc ? req.params.bcc : undefined,
      cc: req.params.cc ? req.params.cc : undefined,
      replyTo: replyto ? replyto : undefined,
    };

    if (transporterSMTP) {
      const res = await transporterSMTP.sendMail(messageParams);
      console.log('smtp transporter res: ', res?.response);
      if (!res.err) {
        if (extUserId) {
          await updateMailCount(extUserId);
        }
        return { status: 'success' };
      }
    } else {
      if (mailgunApiKey) {
        const res = await mailgunClient.messages.create(mailgunDomain, messageParams);
        console.log('mailgun res: ', res?.status);
        if (res.status === 200) {
          if (extUserId) {
            await updateMailCount(extUserId);
          }
          return { status: 'success' };
        }
      } else {
        return { status: 'error' };
      }
    }
  } catch (err) {
    console.log(`sendmailv3 Error: ${err}`);
    if (err) {
      return { status: 'error' };
    }
  } finally {
    if (transporterSMTP) {
      transporterSMTP?.close?.();
    }
  }
}

const forbidden = msg => new Parse.Error(Parse.Error.OPERATION_FORBIDDEN, msg);

// Staff (anyone with a contracts_Users row) write their own request/resend mail: one recipient,
// no cc/bcc. Everyone else may only ask for the fixed "your turn to sign" mail for a document
// they are a signer on; the server works out the recipient and the text.
async function sendmailv3(req) {
  if (!req.user) throw new Parse.Error(Parse.Error.INVALID_SESSION_TOKEN, 'User is not authenticated.');
  if (!allow(`mail-user:${req.user.id}`, 100, 60 * 60 * 1000)) {
    throw new Parse.Error(Parse.Error.CONNECTION_FAILED, 'Too many requests. Try again later.');
  }
  const staff = await new Parse.Query('contracts_Users').equalTo('UserId', req.user).first({ useMasterKey: true });
  if (staff) {
    const recipient = typeof req.params.recipient === 'string' ? req.params.recipient.trim() : '';
    if (!isEmail(recipient) || /[,;\s]/.test(recipient)) {
      throw new Parse.Error(Parse.Error.INVALID_QUERY, 'A single valid recipient is required.');
    }
    return sendMailProvider({ params: { ...req.params, recipient, cc: undefined, bcc: undefined } });
  }
  return notifyNextSigner(req);
}

async function notifyNextSigner(req) {
  const docId = req.params.docId;
  if (typeof docId !== 'string' || !docId) throw forbidden('Not allowed.');
  const doc = await new Parse.Query('contracts_Document')
    .equalTo('objectId', docId)
    .notEqualTo('IsArchive', true)
    .notEqualTo('IsCompleted', true)
    .notEqualTo('IsDeclined', true)
    .include('ExtUserPtr')
    .include('Signers')
    .include('Placeholders.signerPtr')
    .first({ useMasterKey: true });
  if (!doc) throw forbidden('Not allowed.');
  const d = doc.toJSON();
  const placeholders = (d.Placeholders || []).filter(x => x?.Role !== 'prefill');
  const index = placeholders.findIndex(x => x?.signerPtr?.UserId?.objectId === req.user.id);
  if (index < 0 || !d.SendinOrder) throw forbidden('Not allowed.');
  const next = placeholders[index + 1];
  if (!next) return { status: 'success' };
  const recipient = next.signerPtr?.Email || next.email || '';
  if (!isEmail(recipient)) return { status: 'success' };
  // one document may notify one address at most 3 times an hour
  if (!allow(`mail-next:${docId}:${recipient}`, 3, 60 * 60 * 1000)) return { status: 'success' };

  const sender = d.ExtUserPtr || {};
  const senderMail = d.SenderMail || sender.Email || '';
  const senderName = d.SenderName || sender.Name || senderMail;
  const base = (process.env.PUBLIC_URL || req.headers?.public_url || '').replace(/\/+$/, '');
  const signerId = next.signerObjId || next.signerPtr?.objectId;
  const code = Buffer.from(`${docId}/${recipient}${signerId ? `/${signerId}` : ''}`).toString('base64');
  const expire = new Date(d.createdAt);
  expire.setDate(expire.getDate() + (d.TimeToCompleteDays || 15));
  const mail = mailTemplate({
    note: d.Note || '',
    senderName,
    senderMail,
    title: d.Name,
    organization: sender.Company || '',
    localExpireDate: expire.toLocaleDateString('en-US', { day: 'numeric', month: 'long', year: 'numeric' }),
    signingUrl: `${base}/login/${code}`,
  });
  return sendMailProvider({
    params: {
      extUserId: sender.objectId,
      recipient,
      subject: mail.subject,
      from: senderName,
      replyto: senderMail,
      html: mail.body,
    },
  });
}

export default sendmailv3;
