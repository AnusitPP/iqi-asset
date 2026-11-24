import { requestStatusPresentation } from '../../../../shared/features/lending/status.js';
import { escapeMailHtml } from './templates.js';

export function renderStatusUpdateTemplate({
  id,
  oldStatus,
  status,
  assetName,
  kind,
  env = process.env,
}) {
  const escape = escapeMailHtml;
  const clean = (value) => String(value ?? '').trim();
  const current = clean(status),
    previous = clean(oldStatus);
  const requestId = clean(id),
    device = clean(assetName);
  const presentation = requestStatusPresentation(current);
  // The supplied status-update design treats an approved, active loan as success.
  const tone = current === 'กำลังยืม' ? 'green' : presentation.color;
  const palette = {
    green: ['#27824A', '#EFFBF3', '&#10003;'],
    teal: ['#27824A', '#EFFBF3', '&#10003;'],
    yellow: ['#A16207', '#FFFBEB', '&#9719;'],
    blue: ['#2563EB', '#EFF6FF', '&#9719;'],
    orange: ['#B45309', '#FFF7ED', '&#9719;'],
    red: ['#B42318', '#FEF2F2', '&#10005;'],
    gray: ['#71717A', '#F4F4F5', '&#8722;'],
    grape: ['#7E22CE', '#FAF5FF', '&#9719;'],
  };
  const [color, tint, icon] = palette[tone] || palette.gray;
  const descriptions = {
    รอดำเนินการ: 'คำขอของคุณอยู่ระหว่างรอเจ้าหน้าที่ตรวจสอบ',
    กำลังยืม: 'คำขอยืมของคุณได้รับการอนุมัติแล้ว',
    เสร็จสิ้น:
      kind === 'คืน' ? 'เจ้าหน้าที่รับคืนอุปกรณ์เรียบร้อยแล้ว' : 'คำขอของคุณดำเนินการเรียบร้อยแล้ว',
    ไม่อนุมัติ: 'คำขอของคุณไม่ได้รับการอนุมัติ กรุณาติดต่อเจ้าหน้าที่ IT หากต้องการข้อมูลเพิ่มเติม',
    ยกเลิก: 'คำขอของคุณถูกยกเลิกแล้ว',
    รอดำเนินการคืน: 'คำขอคืนของคุณอยู่ระหว่างรอเจ้าหน้าที่ดำเนินการ',
    รอรับคืน: 'คำขอคืนของคุณอยู่ระหว่างรอเจ้าหน้าที่รับคืนอุปกรณ์',
    รับคืนแล้ว: 'เจ้าหน้าที่รับคืนอุปกรณ์เรียบร้อยแล้ว',
    คืนแล้ว: 'การคืนอุปกรณ์ดำเนินการเรียบร้อยแล้ว',
    พร้อมยืม: 'อุปกรณ์พร้อมให้ยืมแล้ว',
  };
  const description = Object.hasOwn(descriptions, current)
    ? descriptions[current]
    : 'ตรวจสอบรายละเอียดล่าสุดได้ที่รายการของฉัน';
  const applicationUrl = (path) => {
    try {
      const url = new URL(path, env.FRONTEND_URL || env.APP_URL);
      return ['https:', 'http:'].includes(url.protocol) && !url.username && !url.password
        ? url.href
        : null;
    } catch {
      return null;
    }
  };
  const imageUrl = applicationUrl('/icon.png');
  const logoUrl = imageUrl?.startsWith('https:') ? imageUrl : null;
  const href = applicationUrl('/my-requests');
  return `<!DOCTYPE html>
<html lang="th">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>IQI Asset - Status Update</title>
</head>

<body style="margin:0;padding:0;background:#F1F2F4;font-family:Arial,Tahoma,sans-serif;color:#18181B;">

<table width="100%" cellpadding="0" cellspacing="0" role="presentation" style="table-layout:fixed;">
<tr>
<td align="center" style="padding:24px 12px;">

<!--[if mso]><table role="presentation" width="600" cellpadding="0" cellspacing="0"><tr><td><![endif]-->
  <table width="100%" cellpadding="0" cellspacing="0" role="presentation"
    style="table-layout:fixed;max-width:600px;background:#FFFFFF;border:1px solid #E4E4E7;border-radius:12px;">

    <!-- HEADER -->
    <tr>
      <td style="background:#202124;padding:20px 24px;border-radius:12px 12px 0 0;">
        <table width="100%" cellpadding="0" cellspacing="0" role="presentation" style="table-layout:fixed;">
          <tr>
            <td width="58" valign="middle">
              <!-- IQI_MAIL_LOGO_START -->
              ${
                logoUrl
                  ? `<img src="${escape(logoUrl)}"
                width="44" height="44"
                alt="IQI Asset"
                style="display:block;border:0;">`
                  : ''
              }
              <!-- IQI_MAIL_LOGO_END -->
            </td>

            <td valign="middle">
              <div style="font-size:22px;font-weight:bold;color:#FFFFFF;">
                IQI Asset
              </div>
              <div style="font-size:12px;color:#BDBDBD;margin-top:4px;">
                IT Service Portal
              </div>
            </td>

            <td align="right" valign="middle">
              <span style="font-size:10px;color:#FFCC00;font-weight:bold;letter-spacing:1px;">
                STATUS UPDATE
              </span>
            </td>
          </tr>
        </table>
      </td>
    </tr>

    <!-- BRAND LINE -->
    <tr>
      <td height="4" style="background:#FFCC00;font-size:0;line-height:0;">
        &nbsp;
      </td>
    </tr>


    <tr><td align="center" style="padding:28px 24px 20px;">
      <table role="presentation" width="60" height="60" cellpadding="0" cellspacing="0" style="background:${tint};border-radius:30px;"><tr><td align="center" valign="middle" style="width:60px;height:60px;">
        <table role="presentation" width="26" height="26" cellpadding="0" cellspacing="0" style="border:2px solid ${color};border-radius:15px;"><tr><td align="center" valign="middle" style="font-family:Arial,sans-serif;font-size:20px;line-height:26px;color:${color};">${icon}</td></tr></table>
      </td></tr></table>
      <p style="margin:10px 0 4px;font-size:13px;line-height:1.5;color:#71717A;">สถานะปัจจุบัน</p>
      ${current ? `<p style="margin:0;font-size:28px;line-height:1.5;font-weight:bold;color:${color};word-break:break-word;">${escape(presentation.label)}</p>` : ''}
      <p style="margin:6px 0 0;font-size:14px;line-height:1.6;color:#71717A;">${escape(description)}</p>
    </td></tr>
    ${
      current
        ? `<tr><td style="padding:0 16px 16px;">
      <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="table-layout:fixed;border:1px solid #E4E4E7;border-radius:8px;background:#F8F9FA;">
        <tr><td ${previous ? 'colspan="3"' : ''} align="center" style="padding:14px 12px 10px;font-size:13px;line-height:1.5;color:#71717A;">การเปลี่ยนแปลงสถานะ</td></tr>
        <tr>${previous ? `<td width="44%" align="center" valign="middle" style="padding:0 8px 16px;word-break:break-word;"><p style="margin:0;font-size:12px;line-height:1.5;color:#71717A;">สถานะเดิม</p><p style="margin:5px 0 0;font-size:15px;line-height:1.5;font-weight:bold;color:#71717A;">${escape(requestStatusPresentation(previous).label)}</p></td><td width="12%" align="center" valign="middle" style="padding:0 0 16px;font-size:22px;color:#9CA3AF;">&#8594;</td>` : ''}
        <td ${previous ? 'width="44%"' : ''} align="center" valign="middle" style="padding:0 8px 16px;word-break:break-word;"><p style="margin:0;font-size:12px;line-height:1.5;color:#71717A;">สถานะใหม่</p><p style="margin:5px 0 0;font-size:15px;line-height:1.5;font-weight:bold;color:${color};">${escape(presentation.label)}</p></td></tr>
      </table>
    </td></tr>`
        : ''
    }
    ${requestId ? `<tr><td style="padding:0 16px 12px;word-break:break-word;"><p style="margin:0;font-size:12px;line-height:1.5;color:#71717A;">เลขคำขอ</p><p style="margin:4px 0 0;font-size:14px;line-height:1.5;font-weight:bold;">${escape(requestId)}</p></td></tr>` : ''}
    ${device ? `<tr><td style="padding:0 16px 16px;word-break:break-word;"><p style="margin:0;font-size:12px;line-height:1.5;color:#71717A;">ชื่ออุปกรณ์</p><p style="margin:4px 0 0;font-size:14px;line-height:1.5;">${escape(device)}</p></td></tr>` : ''}
    ${href ? `<tr><td style="padding:0 16px 24px;"><table role="presentation" width="100%" cellpadding="0" cellspacing="0"><tr><td align="center" bgcolor="#202124" style="border-radius:8px;mso-padding-alt:15px 20px;"><a href="${escape(href)}" style="display:block;padding:15px 20px;font-size:14px;line-height:1.5;font-weight:bold;color:#FFFFFF;text-decoration:none;">ดูรายการของฉัน <span style="color:#FFCC00;margin-left:8px;">&#8594;</span></a></td></tr></table></td></tr>` : ''}
    <!-- FOOTER -->
    <tr>
      <td align="center"
        style="padding:22px 16px;background:#FAFAFA;border-top:1px solid #E4E4E7;border-radius:0 0 12px 12px;">

        <div style="font-size:12px;font-weight:bold;color:#52525B;">
          IT Quality Management · STeP
        </div>

        <div style="font-size:11px;color:#71717A;margin-top:7px;">
          อีเมลแจ้งเตือนอัตโนมัติจาก IQI Asset
        </div>

        <div style="font-size:11px;color:#71717A;margin-top:5px;">
          หากข้อมูลไม่ถูกต้อง กรุณาติดต่อเจ้าหน้าที่ IT
        </div>

      </td>
    </tr>

  </table>
<!--[if mso]></td></tr></table><![endif]-->

</td>
</tr>
</table>

</body>
</html>`;
}
