import nodemailer from 'nodemailer';

export function smtpSettings(env = process.env) {
  const required = ['SMTP_HOST', 'SMTP_USER', 'SMTP_PASS', 'MAIL_FROM'];
  const missing = required.filter((key) => !env[key]?.trim());
  if (missing.length) throw new Error(`กรุณาตั้งค่า ${missing.join(', ')}`);
  const port = Number(env.SMTP_PORT || 587);
  if (!Number.isInteger(port) || port < 1 || port > 65535) throw new Error('SMTP_PORT ไม่ถูกต้อง');
  const from = env.MAIL_FROM.trim();
  if (!/^[^\s<>@,]+@[^\s<>@,]+\.[^\s<>@,]+$/.test(from))
    throw new Error('MAIL_FROM ต้องเป็นอีเมลที่ถูกต้อง');
  return {
    from,
    transport: {
      host: env.SMTP_HOST.trim(),
      port,
      secure: port === 465,
      requireTLS: port !== 465,
      auth: { user: env.SMTP_USER, pass: env.SMTP_PASS },
      connectionTimeout: 15000,
      greetingTimeout: 15000,
      socketTimeout: 30000,
    },
  };
}

export function mailSettings(env = process.env, recipient) {
  const settings = smtpSettings(env);
  if (
    typeof recipient !== 'string' ||
    recipient.length > 254 ||
    !/^[^\s<>@,;]+@[^\s<>@,;]+\.[^\s<>@,;]+$/.test(recipient.trim())
  )
    throw new Error('อีเมลผู้รับไม่ถูกต้อง');
  return { ...settings, to: [recipient.trim()] };
}

export function createMailer(settings) {
  const transport = nodemailer.createTransport(settings.transport);
  return {
    verify: () => transport.verify(),
    async send(message) {
      const result = await transport.sendMail({
        ...message,
        from: settings.from,
        to: settings.to,
        disableFileAccess: true,
        disableUrlAccess: true,
      });
      if (result.rejected?.length)
        throw new Error('SMTP ปฏิเสธผู้รับบางราย กรุณาตรวจสอบก่อนส่งซ้ำ');
      return result;
    },
  };
}
