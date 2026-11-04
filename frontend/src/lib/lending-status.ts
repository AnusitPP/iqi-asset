export function lendingStatusColor(status: string) {
  return (
    (
      {
        รอดำเนินการ: 'yellow',
        กำลังดำเนินการ: 'blue',
        เสร็จสิ้น: 'green',
        ไม่อนุมัติ: 'red',
        ยกเลิก: 'gray',
        กำลังยืม: 'grape',
        รอรับคืน: 'orange',
        รับคืนแล้ว: 'teal',
        คืนแล้ว: 'teal',
      } as Record<string, string>
    )[status] ?? 'gray'
  );
}
