'use client';
import { DatePickerInput, TimePicker } from '@mantine/dates';
import { CalendarDays, Clock } from 'lucide-react';
import { SimpleGrid } from '@mantine/core';

export function RequestPickupFields({
  today,
  pickupDate,
  setPickupDate,
  pickupTime,
  setPickupTime,
  pickupIncomplete,
  disabled,
}: {
  today: string;
  pickupDate: string;
  setPickupDate: (value: string) => void;
  pickupTime: string;
  setPickupTime: (value: string) => void;
  pickupIncomplete: boolean;
  disabled: boolean;
}) {
  return (
    <SimpleGrid cols={{ base: 1, sm: 2 }}>
      <DatePickerInput
        label="วันที่มารับ"
        placeholder="เลือกวันที่มารับ"
        locale="th"
        valueFormat="DD MMMM YYYY"
        firstDayOfWeek={0}
        defaultDate={pickupDate || today}
        minDate={today}
        highlightToday
        getDayProps={(date) => ({ autoFocus: date === (pickupDate || today) })}
        value={pickupDate || null}
        onChange={(value) => setPickupDate(value || '')}
        clearable
        disabled={disabled}
        leftSection={<CalendarDays size={16} aria-hidden="true" />}
        popoverProps={{ withinPortal: true, zIndex: 400, radius: 'lg', shadow: 'md' }}
        previousLabel="เดือนก่อนหน้า"
        nextLabel="เดือนถัดไป"
      />
      <TimePicker
        label="เวลามารับ"
        description="เวลาไทย (24 ชั่วโมง)"
        inputWrapperOrder={['label', 'input', 'description', 'error']}
        value={pickupTime}
        onChange={setPickupTime}
        format="24h"
        withDropdown
        hoursStep={1}
        minutesStep={1}
        hoursInputLabel="ชั่วโมงมารับ"
        minutesInputLabel="นาทีมารับ"
        clearable
        clearButtonProps={{ 'aria-label': 'ล้างเวลามารับ' }}
        error={pickupIncomplete ? 'กรุณาเลือกวันและเวลามารับให้ครบ' : undefined}
        disabled={disabled}
        leftSection={<Clock size={16} aria-hidden="true" />}
        popoverProps={{ withinPortal: true, zIndex: 400, radius: 'lg', shadow: 'md' }}
      />
    </SimpleGrid>
  );
}
