export function escapeMailHtml(value) {
  return String(value ?? '').replace(
    /[&<>"']/g,
    (character) =>
      ({
        '&': '&amp;',
        '<': '&lt;',
        '>': '&gt;',
        '"': '&quot;',
        "'": '&#39;',
      })[character],
  );
}

function applicationLink(env, path) {
  try {
    const url = new URL(path, env.FRONTEND_URL || env.APP_URL);
    return ['https:', 'http:'].includes(url.protocol) && !url.username && !url.password
      ? url.href
      : null;
  } catch {
    return null;
  }
}

// Email clients need table layout and inline styles; no external fonts, scripts or images.
export function renderMailTemplate({
  title,
  intro,
  label,
  sections,
  notice,
  actionPath,
  actionLabel = 'เปิดระบบ IQI Asset',
  env = process.env,
}) {
  const escape = escapeMailHtml;
  const accent = '#92400e';
  const tint = '#fef3c7';
  const href = applicationLink(env, actionPath || '/');
  const content = sections
    .map(
      (section) => `
    <tr><td style="padding:24px 28px 0;">
      <h2 style="margin:0 0 12px;font-size:16px;line-height:1.6;color:#422a08;">${escape(section.title)}</h2>
      ${
        section.items.length
          ? section.items
              .map(
                (item) => `
        <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="margin:0 0 12px;border:1px solid #f0dfad;border-radius:10px;border-collapse:separate;background:#ffffff;">
          <tr><td colspan="2" style="padding:16px 16px 10px;word-break:break-word;">
            <p style="margin:0;font-size:15px;line-height:1.7;font-weight:bold;color:#422a08;">${escape(item.title || 'รายการครุภัณฑ์')}</p>
            ${item.badge ? `<p style="margin:8px 0 0;font-size:12px;color:${accent};">${escape(item.badge)}</p>` : ''}
          </td></tr>
          ${item.fields
            .map(
              ([key, value]) => `<tr>
            <td valign="top" width="36%" style="padding:6px 16px;font-size:13px;line-height:1.8;color:#786b52;">${escape(key)}</td>
            <td valign="top" style="padding:6px 16px 6px 0;font-size:13px;line-height:1.8;color:#443820;word-break:break-word;white-space:pre-line;">${escape(value || '—')}</td>
          </tr>`,
            )
            .join('')}
          <tr><td colspan="2" height="10"></td></tr>
        </table>`,
              )
              .join('')
          : '<p style="margin:0;padding:16px;background:#fffbeb;border-radius:8px;font-size:13px;color:#786b52;">ไม่มีรายการในกลุ่มนี้</p>'
      }
    </td></tr>`,
    )
    .join('');
  return `<!DOCTYPE html>
<html lang="th"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>${escape(title)}</title></head>
<body style="margin:0;padding:0;background:#fffbeb;font-family:Tahoma,Arial,sans-serif;color:#443820;">
  <div style="display:none;max-height:0;overflow:hidden;opacity:0;">${escape(intro)}</div>
  <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="background:#fffbeb;"><tr><td align="center" style="padding:28px 12px;">
    <table role="presentation" width="600" cellspacing="0" cellpadding="0" style="width:100%;max-width:600px;background:#ffffff;border:1px solid #f0dfad;border-radius:16px;border-collapse:separate;">
      <tr><td style="padding:24px 28px;background:#facc15;border-radius:15px 15px 0 0;">
        <p style="margin:0;color:#422a08;font-size:22px;font-weight:bold;letter-spacing:0.5px;">IQI Asset</p>
        <p style="margin:4px 0 0;color:#604600;font-size:12px;">ระบบจัดการครุภัณฑ์ · IT Service Portal</p>
      </td></tr>
      <tr><td style="padding:28px 28px 0;">
        <p style="display:inline-block;margin:0 0 12px;padding:5px 10px;border-radius:6px;background:${tint};color:${accent};font-size:12px;font-weight:bold;">${escape(label)}</p>
        <h1 style="margin:0 0 12px;font-size:24px;line-height:1.5;color:#422a08;">${escape(title)}</h1>
        <p style="margin:0;font-size:14px;line-height:1.9;color:#786b52;">${escape(intro)}</p>
      </td></tr>
      ${content}
      ${notice ? `<tr><td style="padding:12px 28px 0;"><p style="margin:0;padding:14px 16px;background:${tint};border-left:3px solid ${accent};font-size:13px;line-height:1.9;color:#665127;">${escape(notice)}</p></td></tr>` : ''}
      ${href ? `<tr><td align="center" style="padding:24px 28px 0;"><table role="presentation" cellspacing="0" cellpadding="0"><tr><td bgcolor="#facc15" style="border-radius:8px;"><a href="${escape(href)}" style="display:inline-block;padding:13px 24px;color:#422a08;text-decoration:none;font-size:14px;font-weight:bold;">${escape(actionLabel)}</a></td></tr></table></td></tr>` : ''}
      <tr><td style="padding:24px 28px 28px;"><p style="margin:0;border-top:1px solid #f0dfad;padding-top:18px;font-size:11px;line-height:1.9;color:#867555;text-align:center;">อีเมลแจ้งเตือนอัตโนมัติจาก IQI Asset<br>หากข้อมูลไม่ถูกต้อง กรุณาติดต่อเจ้าหน้าที่ IT ของหน่วยงาน</p></td></tr>
    </table>
  </td></tr></table>
</body></html>`;
}

export function loanMailItem(row) {
  return {
    title: row[9] || row[7],
    badge: row[14],
    fields: [
      ['เลขคำขอ', row[0]],
      ['ผู้ยืม', row[3]],
      ['ทีม', row[4]],
      ['เลขครุภัณฑ์', row[7]],
      ['S/N', row[8]],
      ['วันที่ต้องการยืม', row[11]],
      ['กำหนดวันส่งคืน', row[12]],
    ],
  };
}
