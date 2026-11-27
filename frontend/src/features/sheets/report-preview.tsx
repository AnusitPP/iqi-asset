'use client';
import { useEffect, useRef, useState, type ReactNode } from 'react';
import { flushSync } from 'react-dom';
import { useQuery } from '@tanstack/react-query';
import {
  Alert,
  Box,
  Button,
  Checkbox,
  Group,
  NativeSelect,
  Stack,
  Text,
  TextInput,
} from '@mantine/core';
import { useAuthSession } from '@/features/auth/auth-provider';
import { systemService } from '@/services/system.service';
import { LoadingIndicator } from '@/components/ui/feedback';
import { ErrorPopup } from '@/components/core/error-popup';
import styles from './report-preview.module.css';

const initialPageSize = 12;
const fields = [
  { source: 'เลขครุภัณฑ์', label: 'เลขครุภัณฑ์', kind: 'asset', width: 22 },
  { source: 'ชื่ออุปกรณ์', label: 'รายการ', kind: 'name', width: 42 },
  { source: 'ราคาทุน', label: 'ราคาทุน', kind: 'cost', width: 14 },
  { source: 'สภาพ', label: 'สภาพ', kind: 'condition', width: 10 },
  { source: 'ที่ตั้ง', label: 'ที่ตั้งปัจจุบัน', kind: 'location', width: 12 },
];
const extraFields = [
  { source: 'S/N', label: 'S/N', kind: 'serial', width: 14 },
  { source: 'วันที่อัปเดตล่าสุด', label: 'วันที่อัปเดตล่าสุด', kind: 'date', width: 16 },
  { source: 'รูป (ลิงก์)', label: 'รูป (ลิงก์)', kind: 'links', width: 20 },
  { source: 'ชื่อผู้ถือครอง', label: 'ชื่อผู้ถือครอง', kind: 'holder', width: 16 },
];
type ReportRow = { values: string[]; number: number };
const statusOrder = ['ดี', 'ชำรุด', 'หาไม่เจอ', 'ยังไม่ตรวจ', 'ย้ายที่ตั้ง', 'พบนอกทะเบียน'];
const money = new Intl.NumberFormat('th-TH', { maximumFractionDigits: 2 });
const totalMoney = new Intl.NumberFormat('th-TH', {
  minimumFractionDigits: 2,
  maximumFractionDigits: 2,
});
function costValue(value?: string) {
  const number = Number(value?.replaceAll(',', ''));
  return value?.trim() && Number.isFinite(number) ? number : null;
}
function toggle<T>(values: T[], value: T) {
  return values.includes(value) ? values.filter((item) => item !== value) : [...values, value];
}

export function ReportPreview() {
  const { api } = useAuthSession();
  const [page, setPage] = useState(1);
  const [condition, setCondition] = useState('ทั้งหมด');
  const [costFilter, setCostFilter] = useState('ทั้งหมด');
  const [grouped, setGrouped] = useState(false);
  const [compact, setCompact] = useState(false);
  const [showNumbers, setShowNumbers] = useState(false);
  const [hiddenDetails, setHiddenDetails] = useState<string[]>([]);
  const [hiddenSummary, setHiddenSummary] = useState<string[]>([]);
  const [customizing, setCustomizing] = useState(false);
  const [title, setTitle] = useState('รายงานครุภัณฑ์ ปี 70');
  const [omittedPages, setOmittedPages] = useState<number[]>([]);
  const [omittedRows, setOmittedRows] = useState<number[]>([]);
  const [selectedFields, setSelectedFields] = useState(fields.map((field) => field.source));
  const [generating, setGenerating] = useState(false);
  const [pdfError, setPdfError] = useState('');
  const [capturePage, setCapturePage] = useState<ReactNode>(null);
  const capture = useRef<HTMLDivElement>(null);
  const measure = useRef<HTMLDivElement>(null);
  const [pagination, setPagination] = useState<{ key: string; rows: string[][]; ends: number[] }>();
  const report = useQuery({
    queryKey: ['asset-report-preview'],
    queryFn: ({ signal }) => systemService.fetchAssetReport(api, signal),
  });
  const layoutKey = JSON.stringify([
    condition,
    costFilter,
    grouped,
    compact,
    showNumbers,
    hiddenDetails,
    hiddenSummary,
    customizing,
    selectedFields,
    title,
  ]);
  const reportRows = report.data?.rows;
  useEffect(() => {
    const paper = measure.current?.querySelector('article');
    const body = paper?.querySelector<HTMLTableSectionElement>('[data-report-body]');
    if (!paper || !body || !reportRows) return;

    // Use the same rendered columns and Thai fonts as the PDF when measuring row heights.
    const paginate = () => {
      const style = getComputedStyle(paper);
      const pageHeight = parseFloat(style.minHeight);
      if (!(pageHeight > 0) || !body.rows[0]?.getBoundingClientRect().height) return;
      const heading = paper.querySelector('h2');
      const summary = paper.querySelector('[data-report-summary]');
      const caption = paper.querySelector('[data-report-caption]');
      const groupHeaderHeight = caption
        ? caption.getBoundingClientRect().height +
          (parseFloat(getComputedStyle(caption).marginBottom) || 0) +
          (body.parentElement?.querySelector('thead')?.getBoundingClientRect().height ?? 0)
        : 0;
      const titleHeight = heading
        ? heading.getBoundingClientRect().height +
          parseFloat(getComputedStyle(heading).marginBottom)
        : 0;
      const firstPageSpace =
        pageHeight -
        (body.getBoundingClientRect().top - paper.getBoundingClientRect().top) -
        parseFloat(style.paddingBottom) -
        2; // Leave room for the collapsed table border and fractional pixels.
      const ends: number[] = [];
      let space = firstPageSpace;
      let used = 0;
      let group: string | undefined;
      for (const [index, row] of Array.from(body.rows).entries()) {
        const height = row.getBoundingClientRect().height;
        if (used > 0 && (group !== row.dataset.group || used + height > space)) {
          ends.push(index);
          space =
            firstPageSpace +
            titleHeight +
            (summary ? summary.getBoundingClientRect().height + 24 : 0) +
            (row.dataset.group && group === row.dataset.group ? groupHeaderHeight : 0);
          used = 0;
        }
        group = row.dataset.group;
        used += height;
      }
      ends.push(body.rows.length);
      setPagination((previous) =>
        previous?.key === layoutKey &&
        previous.rows === reportRows &&
        previous.ends.length === ends.length &&
        previous.ends.every((end, index) => end === ends[index])
          ? previous
          : { key: layoutKey, rows: reportRows, ends },
      );
    };
    paginate();
    const observer = new ResizeObserver(paginate);
    observer.observe(body);
    if (paper.firstElementChild) observer.observe(paper.firstElementChild);
    return () => observer.disconnect();
  }, [layoutKey, reportRows, report.error]);
  if (report.isPending) return <LoadingIndicator />;
  if (report.error) return <ErrorPopup error={report.error} onRefresh={() => report.refetch()} />;
  const [headers = [], ...data] = report.data.rows;
  const records = data
    .map((values, index) => ({ values, number: index + 1 }))
    .filter((row) => row.values.some((value) => value.trim()));
  const conditionIndex = headers.indexOf('สภาพ');
  const costIndex = headers.indexOf('ราคาทุน');
  const rowStatus = (row: ReportRow) => row.values[conditionIndex]?.trim() || 'ไม่ระบุสภาพ';
  const choices = [
    'ทั้งหมด',
    ...new Set(records.map((row) => row.values[conditionIndex] || '').filter(Boolean)),
  ];
  const filtered = records.filter(
    (row) =>
      (condition === 'ทั้งหมด' || row.values[conditionIndex] === condition) &&
      ((costFilter !== 'มีราคาทุน' && costFilter !== 'ไม่มีราคาทุน') ||
        (costValue(row.values[costIndex]) !== null) === (costFilter === 'มีราคาทุน')),
  );
  const statuses = [...new Set([...statusOrder, ...filtered.map(rowStatus)])];
  const activeStatuses = statuses.filter((status) =>
    filtered.some((row) => rowStatus(row) === status),
  );
  const costDirection =
    costFilter === 'มีราคาทุนก่อน' ? -1 : costFilter === 'ไม่มีราคาทุนก่อน' ? 1 : 0;
  if (grouped || costDirection) {
    filtered.sort((a, b) => {
      const byStatus = grouped
        ? statuses.indexOf(rowStatus(a)) - statuses.indexOf(rowStatus(b))
        : 0;
      return (
        byStatus ||
        costDirection *
          (Number(costValue(a.values[costIndex]) !== null) -
            Number(costValue(b.values[costIndex]) !== null))
      );
    });
  }
  const availableColumns = [...fields, ...extraFields]
    .map((field) => ({ ...field, index: headers.indexOf(field.source) }))
    .filter((field) => field.index >= 0);
  const detailColumns = availableColumns.filter((field) =>
    customizing
      ? selectedFields.includes(field.source)
      : fields.some((defaultField) => defaultField.source === field.source) &&
        filtered.some((row) => Boolean(row.values[field.index]?.trim())),
  );
  const columns = detailColumns.filter(({ source }) => !compact || !hiddenDetails.includes(source));
  const summaryColumns = [
    { key: 'count', label: 'จำนวนรายการ' },
    { key: 'total', label: 'มูลค่าตามทะเบียน (บาท)' },
    ...statuses.map((status) => ({ key: `status:${status}`, label: status })),
  ];
  const visibleSummary = summaryColumns.filter(
    ({ key }) => !compact || !hiddenSummary.includes(key),
  );
  const fallbackEnds: number[] = [];
  let start = 0;
  filtered.forEach((row, index) => {
    const next = filtered[index + 1];
    if (
      !next ||
      index + 1 - start === initialPageSize ||
      (grouped && rowStatus(row) !== rowStatus(next))
    ) {
      start = index + 1;
      fallbackEnds.push(start);
    }
  });
  const ends =
    pagination?.key === layoutKey && pagination.rows === reportRows
      ? pagination.ends
      : fallbackEnds;
  const pages = ends.length || 1;
  const currentPage = Math.min(page, pages);
  const pageRows = (number: number) => filtered.slice(ends[number - 2] ?? 0, ends[number - 1]);
  const includedRows = (number: number) =>
    omittedPages.includes(number)
      ? []
      : pageRows(number).filter((row) => !omittedRows.includes(row.number));
  const visible = pageRows(currentPage);
  const selectedPages = Array.from({ length: pages }, (_, index) => index + 1).filter(
    (number) => includedRows(number).length > 0,
  );
  const selectedRows = customizing ? selectedPages.flatMap(includedRows) : filtered;
  const previewRows = customizing ? includedRows(currentPage) : visible;
  const previousSelectedPage = selectedPages[selectedPages.indexOf(currentPage) - 1];
  const previousPreviewRows = customizing
    ? previousSelectedPage === undefined
      ? []
      : includedRows(previousSelectedPage)
    : currentPage > 1
      ? pageRows(currentPage - 1)
      : [];
  function showTableHeading(rows: ReportRow[], previous: ReportRow[]) {
    return !grouped || !rows[0] || !previous[0] || rowStatus(rows[0]) !== rowStatus(previous[0]);
  }
  function resetSelection() {
    setPage(1);
    setOmittedPages([]);
    setOmittedRows([]);
  }

  async function downloadPdf() {
    setPdfError('');
    setGenerating(true);
    try {
      const [{ toCanvas, getFontEmbedCSS }, { jsPDF }] = await Promise.all([
        import('html-to-image'),
        import('jspdf'),
      ]);
      await document.fonts.ready;
      const pdf = new jsPDF({ unit: 'mm', format: 'a4', compress: true });
      let fontEmbedCSS: string | undefined;
      let previousRows: ReportRow[] = [];
      for (const [index, number] of selectedPages.entries()) {
        const rows = includedRows(number);
        flushSync(() =>
          setCapturePage(
            paper(rows, index === 0, selectedRows, showTableHeading(rows, previousRows)),
          ),
        );
        previousRows = rows;
        const node = capture.current?.firstElementChild;
        if (!(node instanceof HTMLElement)) throw new Error('Preview is unavailable');
        // The format filter in html-to-image can drop the second font face (bold).
        fontEmbedCSS ??= await getFontEmbedCSS(node);
        const canvas = await toCanvas(node, { pixelRatio: 2, fontEmbedCSS });
        const scale = Math.min(210 / canvas.width, 297 / canvas.height);
        if (index > 0) pdf.addPage();
        pdf.addImage(
          canvas,
          'PNG',
          (210 - canvas.width * scale) / 2,
          0,
          canvas.width * scale,
          canvas.height * scale,
        );
        canvas.width = 0;
        canvas.height = 0;
      }
      pdf.save('รายงานครุภัณฑ์ ปี 70.pdf');
    } catch {
      setPdfError('สร้าง PDF ไม่สำเร็จ กรุณาลองใหม่');
    } finally {
      setCapturePage(null);
      setGenerating(false);
    }
  }
  return (
    <Box mt="lg">
      <Group justify="space-between" mb="md" align="end">
        <Box>
          <Text fw={600}>พรีวิวตารางรายงาน</Text>
          <Text size="sm" c="dimmed">
            {filtered.length} รายการ
          </Text>
        </Box>
        {conditionIndex >= 0 && (
          <NativeSelect
            label="กรองตามสภาพ"
            data={choices}
            value={condition}
            onChange={(event) => {
              setCondition(event.currentTarget.value);
              resetSelection();
            }}
          />
        )}
        {costIndex >= 0 && (
          <NativeSelect
            label="กรองตามราคาทุน"
            data={['ทั้งหมด', 'มีราคาทุน', 'ไม่มีราคาทุน', 'มีราคาทุนก่อน', 'ไม่มีราคาทุนก่อน']}
            value={costFilter}
            onChange={(event) => {
              setCostFilter(event.currentTarget.value);
              resetSelection();
            }}
          />
        )}
        {conditionIndex >= 0 && (
          <Checkbox
            label="เรียงและแยกตารางตามสภาพการใช้งาน"
            checked={grouped}
            onChange={(event) => {
              setGrouped(event.currentTarget.checked);
              resetSelection();
            }}
          />
        )}
        <Checkbox
          label="ตารางขนาดเล็ก"
          checked={compact}
          disabled={generating}
          onChange={(event) => {
            setCompact(event.currentTarget.checked);
            setPage(1);
            setOmittedPages([]);
          }}
        />
        <Checkbox
          label="แสดงเลขลำดับ (ที่)"
          checked={showNumbers}
          disabled={generating}
          onChange={(event) => {
            setShowNumbers(event.currentTarget.checked);
            setPage(1);
            setOmittedPages([]);
          }}
        />
        <Group gap="xs">
          <Button
            variant="default"
            size="xs"
            disabled={currentPage === 1}
            onClick={() => setPage(currentPage - 1)}
          >
            หน้าก่อนหน้า
          </Button>
          <Text size="sm">
            หน้า {currentPage} / {pages}
          </Text>
          <Button
            variant="default"
            size="xs"
            disabled={currentPage === pages}
            onClick={() => setPage(currentPage + 1)}
          >
            หน้าถัดไป
          </Button>
        </Group>
      </Group>
      {compact && (
        <Stack mb="md" gap="sm">
          <fieldset disabled={generating}>
            <legend>ซ่อนคอลัมน์ในตารางรายการขนาดเล็ก</legend>
            <Group gap="sm">
              {detailColumns.map(({ source, label }) => (
                <Checkbox
                  key={source}
                  label={label}
                  checked={hiddenDetails.includes(source)}
                  disabled={columns.length === 1 && !hiddenDetails.includes(source)}
                  onChange={() => {
                    setHiddenDetails((previous) => toggle(previous, source));
                    setOmittedPages([]);
                    setPage(1);
                  }}
                />
              ))}
            </Group>
          </fieldset>
          {grouped && (
            <fieldset disabled={generating}>
              <legend>ซ่อนคอลัมน์ในตารางสรุปขนาดเล็ก</legend>
              <Group gap="sm">
                {summaryColumns.map(({ key, label }) => (
                  <Checkbox
                    key={key}
                    label={label}
                    checked={hiddenSummary.includes(key)}
                    disabled={visibleSummary.length === 1 && !hiddenSummary.includes(key)}
                    onChange={() => {
                      setHiddenSummary((previous) => toggle(previous, key));
                      setOmittedPages([]);
                      setPage(1);
                    }}
                  />
                ))}
              </Group>
            </fieldset>
          )}
        </Stack>
      )}
      <Group mb="md">
        <Button
          variant="default"
          disabled={generating}
          onClick={() => setCustomizing(!customizing)}
        >
          {customizing ? 'ปิดตัวเลือก PDF' : 'เลือกข้อมูลสำหรับ PDF'}
        </Button>
        {customizing && (
          <Button
            onClick={() => void downloadPdf()}
            disabled={!columns.length || !selectedPages.length}
            loading={generating}
          >
            ดาวน์โหลด PDF
          </Button>
        )}
      </Group>
      {pdfError && (
        <Alert mb="md" color="red" role="alert">
          {pdfError}
        </Alert>
      )}
      {customizing && (
        <Stack mb="md" gap="sm">
          <TextInput
            label="ชื่อรายงาน"
            description="แสดงบนหน้าแรกที่เลือก เว้นว่างได้"
            value={title}
            maxLength={200}
            disabled={generating}
            onChange={(event) => setTitle(event.currentTarget.value)}
          />
          <fieldset disabled={generating}>
            <legend>คอลัมน์ใน PDF</legend>
            <Group gap="sm">
              {availableColumns.map(({ source, label }) => (
                <Checkbox
                  key={source}
                  label={label}
                  checked={selectedFields.includes(source)}
                  onChange={() => setSelectedFields((previous) => toggle(previous, source))}
                />
              ))}
            </Group>
          </fieldset>
          <fieldset disabled={generating}>
            <legend>หน้าใน PDF</legend>
            <Group gap="sm">
              {Array.from({ length: pages }, (_, index) => index + 1).map((number) => (
                <Checkbox
                  key={number}
                  label={`รวมหน้า ${number}`}
                  checked={!omittedPages.includes(number)}
                  onChange={() => setOmittedPages((previous) => toggle(previous, number))}
                />
              ))}
            </Group>
          </fieldset>
          <fieldset disabled={generating || omittedPages.includes(currentPage)}>
            <legend>รายการในหน้า {currentPage}</legend>
            <Group gap="sm">
              {visible.map((row) => (
                <Checkbox
                  key={row.number}
                  label={row.values[headers.indexOf('เลขครุภัณฑ์')] || `รายการ ${row.number}`}
                  checked={!omittedRows.includes(row.number)}
                  onChange={() => setOmittedRows((previous) => toggle(previous, row.number))}
                />
              ))}
            </Group>
          </fieldset>
          <Text size="sm" role="status">
            เลือกแล้ว {selectedPages.length} หน้า
          </Text>
        </Stack>
      )}
      <div className={styles.viewport}>
        {paper(
          previewRows,
          currentPage === (customizing ? selectedPages[0] : 1),
          selectedRows,
          showTableHeading(previewRows, previousPreviewRows),
        )}
      </div>
      <div className={styles.capture} aria-hidden="true" ref={capture}>
        {capturePage}
      </div>
      <div className={styles.capture} aria-hidden="true" ref={measure}>
        {filtered.length > 0 && columns.length > 0 && paper(filtered, true, filtered)}
      </div>
    </Box>
  );

  function paper(rows: ReportRow[], firstPage: boolean, summary: ReportRow[], showHeading = true) {
    const status = grouped && rows[0] ? rowStatus(rows[0]) : '';
    const caption = status
      ? `${activeStatuses.indexOf(status) + 1}. รายการ${status}`
      : 'ตารางรายการครุภัณฑ์';
    const numbers = new Map<number, number>();
    if (showNumbers) {
      const groupCounts = new Map<string, number>();
      for (const row of summary) {
        const group = grouped ? rowStatus(row) : '';
        const next = (groupCounts.get(group) ?? 0) + 1;
        groupCounts.set(group, next);
        numbers.set(row.number, next);
      }
    }
    const numberedColumnWidth = 7;
    const totalWidth = columns.reduce((sum, column) => sum + column.width, 0);
    return (
      <article
        className={compact ? `${styles.paper} ${styles.compact}` : styles.paper}
        aria-label={title.trim() || 'รายงานครุภัณฑ์'}
      >
        {firstPage && title.trim() && <h2>{title.trim()}</h2>}
        {grouped && firstPage && (
          <table
            className={`${styles.table} ${styles.summary}`}
            aria-label="สรุปรายการครุภัณฑ์"
            data-report-summary
          >
            <thead>
              <tr>
                {visibleSummary.map(({ key, label }) => (
                  <th key={key} scope="col">
                    {label}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              <tr>
                {visibleSummary.map(({ key, label }) => (
                  <td key={key}>
                    {key === 'total'
                      ? totalMoney.format(
                          summary.reduce(
                            (total, row) => total + (costValue(row.values[costIndex]) ?? 0),
                            0,
                          ),
                        )
                      : money.format(
                          key === 'count'
                            ? summary.length
                            : summary.filter((row) => rowStatus(row) === label).length,
                        )}
                  </td>
                ))}
              </tr>
            </tbody>
          </table>
        )}
        {showHeading && (
          <p className={styles.caption} data-report-caption>
            {caption}
          </p>
        )}
        <table className={styles.table} aria-label={caption}>
          <colgroup>
            {showNumbers && <col style={{ width: `${numberedColumnWidth}%` }} />}
            {columns.map((column) => (
              <col
                key={column.source}
                style={{
                  width: `${showNumbers ? (column.width / totalWidth) * (100 - numberedColumnWidth) : column.width}%`,
                }}
              />
            ))}
          </colgroup>
          {showHeading && (
            <thead>
              <tr>
                {showNumbers && (
                  <th scope="col" className={styles.order}>
                    ที่
                  </th>
                )}
                {columns.map((column) => (
                  <th scope="col" key={column.source}>
                    {column.label}
                  </th>
                ))}
              </tr>
            </thead>
          )}
          <tbody data-report-body>
            {rows.map((row) => (
              <tr key={row.number} data-group={grouped ? rowStatus(row) : undefined}>
                {showNumbers && <td className={styles.order}>{numbers.get(row.number)}</td>}
                {columns.map((column) => {
                  const value = row.values[column.index] || '';
                  const serial = row.values[headers.indexOf('S/N')] || '';
                  const numericCost = Number(value.replaceAll(',', ''));
                  return (
                    <td
                      key={column.source}
                      className={column.kind === 'cost' ? styles.amount : undefined}
                    >
                      {column.kind === 'cost' && value.trim() && Number.isFinite(numericCost)
                        ? numericCost.toLocaleString('th-TH', { maximumFractionDigits: 2 })
                        : value}
                      {!customizing &&
                        column.kind === 'name' &&
                        serial &&
                        !value.toLowerCase().includes(serial.toLowerCase()) && (
                          <span className={styles.serial}>S/N: {serial}</span>
                        )}
                    </td>
                  );
                })}
              </tr>
            ))}
            {!rows.length && (
              <tr>
                <td
                  colSpan={Math.max(1, columns.length + Number(showNumbers))}
                  className={styles.empty}
                >
                  ไม่มีรายการ
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </article>
    );
  }
}
