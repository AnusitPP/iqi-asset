import { inspectionAge, todayBangkok } from '../../../../shared/core/extensions/dates.js';

export function escapeMailHtml(value) {
  return String(value ?? '').replace(
    /[&<>"']/g,
    (character) =>
      ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[character],
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

export function mailDate(value) {
  const date = inspectionAge(value)?.date;
  if (date) return date;
  if (/^\d{4}-\d{2}-\d{2}T/.test(String(value)) && Number.isFinite(Date.parse(value)))
    return todayBangkok(new Date(value));
  return value || '—';
}

export function renderMailTemplate({
  title,
  intro,
  label,
  sections,
  summary,
  reportDate,
  notice,
  actionPath,
  actionLabel = 'ตรวจสอบรายการในระบบ',
  env = process.env,
}) {
  const escape = escapeMailHtml;
  const systemUrl = applicationLink(env, actionPath || '/');
  const imageUrl = applicationLink(env, '/icon.png');
  const displayDate = (value) => {
    const normalized = mailDate(value);
    const match = String(normalized).match(/^(\d{2})\/(\d{2})\/(\d{4})$/);
    if (!match) return normalized;
    const months = [
      'ม.ค.',
      'ก.พ.',
      'มี.ค.',
      'เม.ย.',
      'พ.ค.',
      'มิ.ย.',
      'ก.ค.',
      'ส.ค.',
      'ก.ย.',
      'ต.ค.',
      'พ.ย.',
      'ธ.ค.',
    ];
    return `${Number(match[1])} ${months[Number(match[2]) - 1]} ${match[3]}`;
  };
  const groups = sections
    .filter((section) => section.items.length)
    .map((section) => ({
      title:
        section.tone === 'warning'
          ? 'รายการรออนุมัติ'
          : section.title.replace(/ · \d+ รายการ$/, ''),
      items: section.items.map((entry) => {
        const fields = Object.fromEntries(entry.fields);
        const known = [
          'ผู้ยืม',
          'ทีม',
          'เลขคำขอ',
          'เลขคำขอคืน',
          'เลขครุภัณฑ์',
          'Serial Number',
          'วันที่ต้องการยืม',
          'กำหนดวันส่งคืน',
          'เหตุผลหรือวัตถุประสงค์',
        ];
        return {
          requestId: fields['เลขคำขอคืน'] || fields['เลขคำขอ'] || '—',
          assetName: entry.title || 'รายการครุภัณฑ์',
          assetCode: fields['เลขครุภัณฑ์'] || '—',
          serialNumber: fields['Serial Number'] || '—',
          borrowerName: fields['ผู้ยืม'] || fields['ผู้คืน'] || '—',
          teamName: fields['ทีม'] || '—',
          borrowDate: displayDate(fields['วันที่ต้องการยืม']),
          dueDate: displayDate(fields['กำหนดวันส่งคืน']),
          purpose: fields['เหตุผลหรือวัตถุประสงค์'],
          statusLabel: entry.badge || '—',
          isOverdue: entry.overdueDays > 0,
          overdueDays: entry.overdueDays || 0,
          extra: entry.fields.filter(([key]) => !known.includes(key)),
        };
      }),
    }));
  const count = (tone) => summary?.find((entry) => entry.tone === tone)?.count || 0;
  const data = {
    logoUrl: imageUrl?.startsWith('https:') ? imageUrl : null,
    systemUrl,
    reportDate: reportDate || intro,
    title: summary ? 'สรุปรายการยืม–คืนประจำวัน' : title,
    label: summary ? 'DAILY REPORT' : label,
    actionLabel,
    pendingApprovalCount: count('warning'),
    pendingReturnCount: count('success'),
    overdueCount: count('danger'),
    isEmpty: !groups.length,
  };
  const renderItem = (item) => `<!-- ITEM CARD -->
    <tr>
      <td style="padding:0 24px 16px;">

        <table width="100%" cellpadding="0" cellspacing="0" role="presentation"
          style="table-layout:fixed;border:1px solid #E4E4E7;border-radius:8px;">

          <!-- ITEM HEADER -->
          <tr>
            <td style="padding:16px;word-break:break-word;background:#F8F9FA;border-bottom:1px solid #E4E4E7;border-radius:8px 8px 0 0;">

              <table width="100%" cellpadding="0" cellspacing="0" role="presentation" style="table-layout:fixed;">
                <tr>

                  <td valign="middle"
                    style="font-size:11px;color:#71717A;">
                    ASSET NO. ${escape(item.assetCode)}
                  </td>

                  ${
                    item.isOverdue
                      ? `
                  <td align="right" valign="middle">
                    <span style="display:inline-block;background:#FEE4E2;color:#B42318;padding:5px 8px;border-radius:4px;font-size:11px;font-weight:bold;">
                      เกินกำหนด ${escape(item.overdueDays)} วัน
                    </span>
                  </td>
                  `
                      : ``
                  }

                </tr>
              </table>

              <div style="font-size:16px;font-weight:bold;line-height:1.5;margin-top:10px;">
                ${escape(item.assetName)}
              </div>

              <div style="font-size:12px;color:#71717A;margin-top:6px;">
                สถานะ: ${escape(item.statusLabel)}
              </div>

            </td>
          </tr>

          <!-- ITEM DETAILS -->
          <tr>
            <td style="padding:16px;">

              <table width="100%" cellpadding="0" cellspacing="0" role="presentation" style="table-layout:fixed;">

                <!-- Borrower & Team -->
                <tr>
                  <td width="65%" valign="top" style="padding:0 12px 16px 0;">

                    <div style="font-size:12px;color:#71717A;margin-bottom:5px;">
                      ผู้ยืม
                    </div>

                    <div style="font-size:14px;font-weight:bold;line-height:1.5;">
                      ${escape(item.borrowerName)}
                      ${item.nickname ? `(${escape(item.nickname)})` : ``}
                    </div>

                  </td>

                  <td width="35%" valign="top" style="padding-bottom:16px;">

                    <div style="font-size:12px;color:#71717A;margin-bottom:5px;">
                      ทีม
                    </div>

                    <div style="font-size:14px;font-weight:bold;">
                      ${escape(item.teamName)}
                    </div>

                  </td>
                </tr>

                <!-- Borrow & Return dates -->
                <tr>
                  <td valign="top" style="padding:0 12px 16px 0;">

                    <div style="font-size:12px;color:#71717A;margin-bottom:5px;">
                      วันที่ยืม
                    </div>

                    <div style="font-size:14px;">
                      ${escape(item.borrowDate)}
                    </div>

                  </td>

                  <td valign="top" style="padding-bottom:16px;">

                    <div style="font-size:12px;color:#71717A;margin-bottom:5px;">
                      กำหนดส่งคืน
                    </div>

                    <div style="font-size:14px;font-weight:bold;color:${item.isOverdue ? `#B42318` : `#18181B`};">
                      ${escape(item.dueDate)}
                    </div>

                  </td>
                </tr>

                <!-- Purpose -->
                ${
                  item.purpose
                    ? `
                <tr>
                  <td colspan="2" style="padding-bottom:16px;">

                    <div style="font-size:12px;color:#71717A;margin-bottom:5px;">
                      วัตถุประสงค์
                    </div>

                    <div style="font-size:14px;line-height:1.6;overflow-wrap:anywhere;">
                      ${escape(item.purpose)}
                    </div>

                  </td>
                </tr>
                `
                    : ``
                }

${item.extra.length ? `<tr><td colspan="2" style="padding-bottom:16px;">${item.extra.map(([key, value]) => `<p style="margin:0 0 5px;font-size:12px;line-height:1.6;color:#71717A;">${escape(key)}: ${escape(/วันที่|กำหนด/.test(key) ? displayDate(value) : value || '—')}</p>`).join('')}</td></tr>` : ''}
                <!-- Serial Number -->
                <tr>
                  <td colspan="2" style="border-top:1px solid #EEEEEE;padding-top:12px;">

                    <table width="100%" cellpadding="0" cellspacing="0" role="presentation" style="table-layout:fixed;">
                      <tr>
                        <td style="font-size:12px;color:#71717A;">
                          Serial Number
                        </td>

                        <td align="right" style="font-size:12px;">
                          ${escape(item.serialNumber)}
                        </td>
                      </tr>
                    </table>

                  </td>
                </tr>

                <!-- Request ID -->
                <tr>
                  <td colspan="2" style="padding-top:12px;">

                    <div style="font-size:11px;color:#71717A;">
                      เลขคำขอ
                    </div>

                    <div style="font-size:11px;color:#71717A;margin-top:5px;word-break:break-all;">
                      ${escape(item.requestId)}
                    </div>

                  </td>
                </tr>

              </table>

            </td>
          </tr>

        </table>

      </td>
    </tr>`;
  const renderGroup = (group) => `<tr>
      <td style="padding:0 24px 12px;">

        <table width="100%" cellpadding="0" cellspacing="0" role="presentation" style="table-layout:fixed;">
          <tr>
            <td style="font-size:15px;font-weight:bold;">
              ${escape(group.title)}
            </td>

            <td align="right" style="font-size:12px;color:#71717A;">
              ${escape(group.items.length)} รายการ
            </td>
          </tr>
        </table>

      </td>
    </tr>${group.items.map(renderItem).join('')}`;
  return `<!DOCTYPE html>
<html lang="th">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>IQI Asset - Daily Report</title>
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
                data.logoUrl
                  ? `<img src="${escape(data.logoUrl)}"
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
                ${escape(data.label)}
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

    <!-- TITLE -->
    <tr>
      <td style="padding:24px 24px 20px;">
        <div style="font-size:22px;font-weight:bold;line-height:1.5;">
          ${escape(data.title)}
        </div>

        <div style="font-size:13px;color:#71717A;margin-top:6px;">
          ${escape(data.reportDate)}
        </div>

        ${
          data.overdueCount
            ? `
        <div style="font-size:14px;color:#52525B;margin-top:12px;">
          มีอุปกรณ์เกินกำหนดส่งคืน ${escape(data.overdueCount)} รายการ
        </div>
        `
            : ``
        }
      </td>
    </tr>

    ${
      summary
        ? `<!-- SUMMARY -->
    <tr>
      <td style="padding:0 24px 28px;">

        <table width="100%" cellpadding="0" cellspacing="0" role="presentation"
          style="table-layout:fixed;border:1px solid #E4E4E7;border-radius:8px;">

          <tr>
            <!-- Pending approval -->
            <td width="33%" align="center" style="padding:16px 6px;border-right:1px solid #E4E4E7;">

              <div style="font-size:12px;color:#71717A;">
                รออนุมัติ
              </div>

              <div style="font-size:28px;font-weight:bold;margin-top:8px;color:${data.pendingApprovalCount ? `#B45309` : `#18181B`};">
                ${escape(data.pendingApprovalCount)}
              </div>

            </td>

            <!-- Pending return -->
            <td width="33%" align="center" style="padding:16px 6px;border-right:1px solid #E4E4E7;">

              <div style="font-size:12px;color:#71717A;">
                รอรับคืน
              </div>

              <div style="font-size:28px;font-weight:bold;margin-top:8px;color:${data.pendingReturnCount ? `#2563EB` : `#18181B`};">
                ${escape(data.pendingReturnCount)}
              </div>

            </td>

            <!-- Overdue -->
            <td width="34%" align="center" style="padding:16px 6px;">

              <div style="font-size:12px;color:${data.overdueCount ? `#B42318` : `#71717A`};">
                เกินกำหนด
              </div>

              <div style="font-size:28px;font-weight:bold;margin-top:8px;color:${data.overdueCount ? `#B42318` : `#18181B`};">
                ${escape(data.overdueCount)}
              </div>

            </td>
          </tr>
        </table>

      </td>
    </tr>

    `
        : ''
    }
    ${groups.map(renderGroup).join('')}

    <!-- EMPTY STATE -->
    ${
      data.isEmpty
        ? `
    <tr>
      <td align="center" style="padding:12px 24px 32px;">

        <div style="font-size:30px;color:#27824A;">
          &#10003;
        </div>

        <div style="font-size:16px;font-weight:bold;margin-top:10px;">
          ไม่มีรายการที่ต้องดำเนินการ
        </div>

        <div style="font-size:13px;color:#71717A;margin-top:8px;">
          ไม่มีรายการรอดำเนินการในรอบนี้
        </div>

      </td>
    </tr>
    `
        : ``
    }

${
  data.systemUrl
    ? `    <!-- CTA BUTTON -->
    <tr>
      <td style="padding:12px 24px 16px;">

        <table width="100%" cellpadding="0" cellspacing="0" role="presentation" style="table-layout:fixed;">
          <tr>
            <td align="center"
              style="background:#202124;border-radius:8px;mso-padding-alt:15px 20px;">

              <a href="${escape(data.systemUrl)}"
                style="display:block;padding:15px 20px;font-size:14px;font-weight:bold;color:#FFFFFF;text-decoration:none;">

                ${escape(data.actionLabel)}
                <span style="color:#FFCC00;margin-left:8px;">
                  &#8594;
                </span>

              </a>

            </td>
          </tr>
        </table>

      </td>
    </tr>

`
    : ''
}
    <!-- NOTE -->
    ${
      !data.isEmpty
        ? `
    <tr>
      <td align="center" style="padding:0 24px 24px;font-size:11px;line-height:1.8;color:#71717A;">
        ${escape(summary ? 'กรุณาตรวจสอบสถานะล่าสุดในระบบ เนื่องจากรายการอาจอยู่ในมากกว่าหนึ่งกลุ่ม' : notice || 'กรุณาตรวจสอบสถานะล่าสุดในระบบ')}
      </td>
    </tr>
    `
        : ''
    }

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

export function loanMailItem(row, { now = new Date(), nickname = '' } = {}) {
  return {
    title: row[9] || row[7],
    badge: row[14],
    overdueDays: inspectionAge(row[12], now)?.days || 0,
    fields: [
      ['ผู้ยืม', `${row[3] || '—'}${nickname ? ` (${nickname})` : ''}`],
      ['ทีม', row[4]],
      ['เลขคำขอ', row[0]],
      ['เลขครุภัณฑ์', row[7]],
      ['Serial Number', row[8]],
      ['วันที่ต้องการยืม', mailDate(row[11])],
      ['กำหนดวันส่งคืน', mailDate(row[12])],
      ...(row[10] ? [['เหตุผลหรือวัตถุประสงค์', row[10]]] : []),
    ],
  };
}
