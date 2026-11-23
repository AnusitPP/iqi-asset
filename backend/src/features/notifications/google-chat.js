import { escapeMailHtml } from '../mail/templates.js';
import { applicationOrigin } from '../../core/config/app-url.js';
import { readyToBorrowData } from '../../../../shared/features/catalog/parser.js';
import { LENDING_REQUEST_TYPE } from '../../../../shared/features/lending/status.js';

function requestCard(kind, row, purpose, href, photo) {
  const returning = kind === 'คืน';
  const escape = (value) => escapeMailHtml(value || '-').replace(/\r?\n/g, '<br>');
  const field = (label, value) => `• <b>${label}:</b> ${escape(value)}`;
  const person = [
    {
      textParagraph: {
        text: `${returning ? 'ผู้คืน' : 'ผู้ยืม'}: <b>${escape(row[returning ? 4 : 3])}</b><br>ทีม / หน่วยงาน: <b>${escape(row[returning ? 5 : 4])}</b>`,
      },
    },
  ];
  return {
    cardId: row[0],
    card: {
      header: {
        title: `🔔 มีคำขอ${kind}ใหม่`,
        subtitle: returning ? LENDING_REQUEST_TYPE.RETURN : LENDING_REQUEST_TYPE.LOAN,
        imageUrl: new URL('/assets/images/laptop-webhook-icon.png', href).href,
        imageType: 'SQUARE',
        imageAltText: 'ไอคอนโน้ตบุ๊กแจ้งเตือน',
      },
      sectionDividerStyle: 'SOLID_DIVIDER',
      sections: [
        {
          header: returning ? '👤 ข้อมูลผู้คืน' : '👤 ข้อมูลผู้ยืม',
          widgets: photo
            ? [
                {
                  columns: {
                    columnItems: [
                      { horizontalSizeStyle: 'FILL_AVAILABLE_SPACE', widgets: person },
                      {
                        horizontalSizeStyle: 'FILL_MINIMUM_SPACE',
                        widgets: [{ image: { imageUrl: photo, altText: 'รูปอุปกรณ์' } }],
                      },
                    ],
                  },
                },
              ]
            : person,
        },
        {
          header: '📋 รายละเอียดคำขอ',
          widgets: [
            {
              textParagraph: {
                text: [
                  field('เลขคำขอ', row[0]),
                  field('อุปกรณ์', row[returning ? 10 : 9] || row[returning ? 7 : 6]),
                  field('เลขครุภัณฑ์', row[returning ? 8 : 7]),
                  field('S/N', row[returning ? 9 : 8]),
                  field(returning ? 'วันที่คืน' : 'วันที่ยืม', row[11]),
                  ...(!returning ? [field('กำหนดคืน', row[12])] : []),
                  field('เหตุผล / วัตถุประสงค์', purpose),
                  field('หมายเหตุ', row[returning ? 12 : 13]),
                ].join('<br>'),
              },
            },
          ],
        },
        {
          widgets: [
            {
              buttonList: {
                buttons: [
                  {
                    text: 'เปิดเว็บไซต์เพื่อดูรายละเอียดและดำเนินการ',
                    type: 'OUTLINED',
                    icon: { materialIcon: { name: 'open_in_new' } },
                    altText: 'เปิดเว็บไซต์ IQI Asset',
                    onClick: { openLink: { url: href } },
                  },
                ],
              },
            },
            {
              textParagraph: {
                text: '<font color="#6b7280">ⓘ ใช้สำหรับตรวจสอบข้อมูลคำขอ ติดตามสถานะ หรือดำเนินการต่อในระบบ IQI Asset</font>',
              },
            },
          ],
        },
      ],
    },
  };
}

export async function sendRequestNotification(
  ledger,
  kind,
  result,
  {
    env = process.env,
    fetcher = fetch,
    photoStore,
    report = () => process.stderr.write('Google Chat notification failed\n'),
  } = {},
) {
  const webhook = env.GOOGLE_CHAT_WEBHOOK_URL?.trim();
  if (!webhook || result.unchanged) return 'skipped';
  try {
    const url = new URL(webhook);
    if (
      url.origin !== 'https://chat.googleapis.com' ||
      !/^\/v1\/spaces\/[^/]+\/messages$/.test(url.pathname) ||
      url.username ||
      url.password ||
      !url.searchParams.get('key') ||
      !url.searchParams.get('token')
    )
      throw new Error('Invalid Google Chat webhook');
    const returning = kind === 'คืน';
    const state = await ledger.readLedger();
    const rows = (returning ? state.returns : state.loans).filter((row) => row[0] === result.id);
    if (rows.length !== 1) throw new Error('Saved request not found');
    const row = rows[0];
    const original = returning
      ? state.loans.find((loan) => loan[0] === row[1] && loan[1] === row[2])
      : row;
    const purpose = original?.[10] || '-';
    const href = new URL(
      '/approval-requests',
      env.GOOGLE_CHAT_APP_URL
        ? applicationOrigin(env, 'GOOGLE_CHAT_APP_URL')
        : applicationOrigin(env, env.FRONTEND_URL ? 'FRONTEND_URL' : 'APP_URL'),
    ).href;
    let photo;
    if ((photoStore || env.PUBLIC_PHOTO_PREVIEW === 'true') && ledger.adapter?.readReadyToBorrow) {
      try {
        const catalog = readyToBorrowData(await ledger.adapter.readReadyToBorrow()).records;
        const asset = catalog.find(
          (entry) =>
            entry.asset === row[returning ? 8 : 7] &&
            entry.serial === (row[returning ? 9 : 8] || ''),
        );
        const firstPhoto = asset?.photo
          ?.split(/\r?\n/)
          .map((url) => url.trim())
          .find((url) => /^https:\/\/drive\.google\.com\/file\/d\/[\w-]+\/view$/.test(url));
        const id = firstPhoto?.match(
          /^https:\/\/drive\.google\.com\/file\/d\/([\w-]+)\/view$/,
        )?.[1];
        if (id && (!photoStore || (await photoStore.isPublic(id))))
          photo = new URL(`/api/chat-photos/${id}`, href).href;
      } catch {
        // Optional photo lookup must not prevent the request notification.
      }
    }
    const response = await fetcher(url.href, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json; charset=UTF-8' },
      body: JSON.stringify({ cardsV2: [requestCard(kind, row, purpose, href, photo)] }),
      signal: AbortSignal.timeout(5000),
      redirect: 'error',
    });
    if (!response.ok) throw new Error('Google Chat rejected notification');
    return 'sent';
  } catch {
    // Never log the webhook URL or transport errors containing its credentials.
    report();
    return 'failed';
  }
}
