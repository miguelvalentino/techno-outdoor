// src/components/GuideCalendar.jsx
import { useState, useMemo } from 'react';

const DAY_NAMES_ID = ['Minggu', 'Senin', 'Selasa', 'Rabu', 'Kamis', 'Jumat', 'Sabtu'];
const CALENDAR_HEADERS = [
  { short: 'Sen', full: 'Senin' },
  { short: 'Sel', full: 'Selasa' },
  { short: 'Rab', full: 'Rabu' },
  { short: 'Kam', full: 'Kamis' },
  { short: 'Jum', full: 'Jumat' },
  { short: 'Sab', full: 'Sabtu' },
  { short: 'Min', full: 'Minggu' }
];

const MONTH_NAMES_ID = [
  'Januari', 'Februari', 'Maret', 'April', 'Mei', 'Juni',
  'Juli', 'Agustus', 'September', 'Oktober', 'November', 'Desember'
];

const toYMD = (year, monthIndex, day) => {
  const m = String(monthIndex + 1).padStart(2, '0');
  const d = String(day).padStart(2, '0');
  return `${year}-${m}-${d}`;
};

const formatReadableRange = (startStr, endStr) => {
  if (!startStr) return '';
  const s = new Date(`${startStr}T00:00:00`);
  const e = endStr ? new Date(`${endStr}T00:00:00`) : s;
  const sDay = s.getDate();
  const sMonth = MONTH_NAMES_ID[s.getMonth()]?.slice(0, 3);
  const eDay = e.getDate();
  const eMonth = MONTH_NAMES_ID[e.getMonth()]?.slice(0, 3);
  const eYear = e.getFullYear();

  if (startStr === endStr) return `${sDay} ${sMonth} ${eYear}`;
  if (s.getMonth() === e.getMonth() && s.getFullYear() === e.getFullYear()) {
    return `${sDay}–${eDay} ${eMonth} ${eYear}`;
  }
  return `${sDay} ${sMonth} – ${eDay} ${eMonth} ${eYear}`;
};

export const GuideCalendar = ({
  schedules = [],
  workingDays = ['Senin', 'Selasa', 'Rabu', 'Kamis', 'Jumat', 'Sabtu', 'Minggu'],
  selectedStart = '',
  selectedEnd = '',
  onSelectRange,
  isAdmin = false,
  onDeleteSchedule
}) => {
  const initialDate = selectedStart ? new Date(`${selectedStart}T00:00:00`) : new Date();
  const [viewYear, setViewYear] = useState(initialDate.getFullYear());
  const [viewMonth, setViewMonth] = useState(initialDate.getMonth());
  const [selectingStep, setSelectingStep] = useState('start');
  const [hoveredBooking, setHoveredBooking] = useState(null);

  const todayYMD = useMemo(() => {
    const now = new Date();
    return toYMD(now.getFullYear(), now.getMonth(), now.getDate());
  }, []);

  // Buat daftar sel kalender (mulai dari hari Senin)
  const calendarDays = useMemo(() => {
    const firstDayOfMonth = new Date(viewYear, viewMonth, 1);
    const totalDaysInMonth = new Date(viewYear, viewMonth + 1, 0).getDate();

    // Konversi getDay() (0=Minggu .. 6=Sabtu) ke indeks Senin=0 .. Minggu=6
    const startOffset = (firstDayOfMonth.getDay() + 6) % 7;

    const cells = [];
    for (let i = 0; i < startOffset; i++) {
      cells.push(null);
    }

    for (let day = 1; day <= totalDaysInMonth; day++) {
      const ymd = toYMD(viewYear, viewMonth, day);
      const dateObj = new Date(viewYear, viewMonth, day);
      const dayNameId = DAY_NAMES_ID[dateObj.getDay()];
      const isWorkingDay = workingDays.includes(dayNameId);

      // Cek apakah tanggal ini masuk dalam salah satu jadwal booking aktif
      const matchedSchedule = schedules.find((sch) => {
        if (!sch.start_date) return false;
        const s = sch.start_date.slice(0, 10);
        const e = (sch.end_date || sch.start_date).slice(0, 10);
        return ymd >= s && ymd <= e;
      });

      const isSelected =
        selectedStart &&
        selectedEnd &&
        ymd >= selectedStart &&
        ymd <= selectedEnd;

      const isStart = selectedStart === ymd;
      const isEnd = selectedEnd === ymd;
      const isPast = !isAdmin && ymd < todayYMD;

      cells.push({
        day,
        ymd,
        dayNameId,
        isWorkingDay,
        matchedSchedule,
        isSelected,
        isStart,
        isEnd,
        isPast
      });
    }

    return cells;
  }, [viewYear, viewMonth, schedules, workingDays, selectedStart, selectedEnd, isAdmin, todayYMD]);

  // Filter jadwal yang tampil di bulan yang sedang dilihat
  const monthSchedules = useMemo(() => {
    const monthPrefix = `${viewYear}-${String(viewMonth + 1).padStart(2, '0')}`;
    return schedules.filter((sch) => {
      const s = (sch.start_date || '').slice(0, 7);
      const e = (sch.end_date || sch.start_date || '').slice(0, 7);
      return s <= monthPrefix && e >= monthPrefix;
    });
  }, [schedules, viewYear, viewMonth]);

  const handlePrevMonth = () => {
    if (viewMonth === 0) {
      setViewMonth(11);
      setViewYear(y => y - 1);
    } else {
      setViewMonth(m => m - 1);
    }
  };

  const handleNextMonth = () => {
    if (viewMonth === 11) {
      setViewMonth(0);
      setViewYear(y => y + 1);
    } else {
      setViewMonth(m => m + 1);
    }
  };

  const handleDayClick = (cell) => {
    if (!cell) return;
    if (cell.matchedSchedule) {
      setHoveredBooking(cell.matchedSchedule);
      return;
    }
    if (!onSelectRange || cell.isPast || !cell.isWorkingDay) return;

    if (selectingStep === 'start' || !selectedStart || cell.ymd < selectedStart) {
      onSelectRange(cell.ymd, cell.ymd);
      setSelectingStep('end');
    } else {
      onSelectRange(selectedStart, cell.ymd);
      setSelectingStep('start');
    }
  };

  return (
    <div className="bg-white border border-gray-200 rounded-2xl p-4 shadow-sm">
      {/* Header Bulan & Tahun */}
      <div className="flex items-center justify-between mb-3 pb-2.5 border-b border-gray-100">
        <div className="flex items-center gap-2">
          <div className="h-8 w-8 rounded-xl bg-brand-50 text-brand-700 flex items-center justify-center">
            <i className="fa-regular fa-calendar-days text-sm"></i>
          </div>
          <div>
            <h4 className="font-bold text-gray-900 text-sm">
              {MONTH_NAMES_ID[viewMonth]} {viewYear}
            </h4>
            <p className="text-[10px] text-gray-500">
              {onSelectRange ? 'Klik tanggal tersedia untuk memilih jadwal' : 'Kalender Ketersediaan & Booking Guide'}
            </p>
          </div>
        </div>

        <div className="flex items-center gap-1.5">
          <button
            type="button"
            onClick={handlePrevMonth}
            className="h-7 w-7 rounded-lg bg-gray-100 hover:bg-gray-200 text-gray-700 flex items-center justify-center transition"
          >
            <i className="fa-solid fa-chevron-left text-[10px]"></i>
          </button>
          <button
            type="button"
            onClick={handleNextMonth}
            className="h-7 w-7 rounded-lg bg-gray-100 hover:bg-gray-200 text-gray-700 flex items-center justify-center transition"
          >
            <i className="fa-solid fa-chevron-right text-[10px]"></i>
          </button>
        </div>
      </div>

      {/* Info Hari Kerja Guide */}
      <div className="mb-3 flex flex-wrap items-center gap-1 bg-gray-50 px-3 py-2 rounded-xl border border-gray-100">
        <span className="text-[10px] font-bold text-gray-500 uppercase mr-1">
          <i className="fa-solid fa-briefcase mr-1 text-brand-600"></i>Hari Kerja:
        </span>
        {CALENDAR_HEADERS.map((h) => {
          const active = workingDays.includes(h.full);
          return (
            <span
              key={h.full}
              className={`text-[10px] font-bold px-2 py-0.5 rounded-md ${
                active ? 'bg-brand-100 text-brand-800' : 'bg-gray-200/70 text-gray-400 line-through'
              }`}
            >
              {h.short}
            </span>
          );
        })}
      </div>

      {/* Header Nama Hari */}
      <div className="grid grid-cols-7 gap-1 text-center mb-1">
        {CALENDAR_HEADERS.map((h) => (
          <div key={h.short} className="text-[10px] font-bold uppercase text-gray-400 py-1">
            {h.short}
          </div>
        ))}
      </div>

      {/* Grid Tanggal */}
      <div className="grid grid-cols-7 gap-1">
        {calendarDays.map((cell, idx) => {
          if (!cell) {
            return <div key={`empty-${idx}`} className="h-9 rounded-lg" />;
          }

          const isBooked = Boolean(cell.matchedSchedule);
          const isOffDay = !cell.isWorkingDay;

          let cellClass = 'bg-white text-gray-700 border-gray-100 hover:border-brand-400 hover:bg-brand-50/50 cursor-pointer';
          if (isBooked) {
            cellClass = 'bg-red-50 text-red-700 border-red-200 font-bold cursor-pointer hover:bg-red-100';
          } else if (cell.isSelected) {
            cellClass = 'bg-brand-600 text-white border-brand-600 font-bold shadow-sm';
          } else if (isOffDay) {
            cellClass = 'bg-gray-100 text-gray-400 border-gray-100 cursor-not-allowed';
          } else if (cell.isPast) {
            cellClass = 'bg-gray-50/70 text-gray-300 border-gray-100 cursor-not-allowed';
          }

          return (
            <button
              type="button"
              key={cell.ymd}
              onClick={() => handleDayClick(cell)}
              onMouseEnter={() => cell.matchedSchedule && setHoveredBooking(cell.matchedSchedule)}
              title={
                isBooked
                  ? `Sudah Dibooking (${formatReadableRange(cell.matchedSchedule.start_date, cell.matchedSchedule.end_date)}): ${cell.matchedSchedule.destination || 'Pendakian'}`
                  : isOffDay
                    ? `Libur Rutin Guide (Bukan Hari Kerja)`
                    : `Tersedia (${cell.ymd})`
              }
              className={`h-9 rounded-xl border text-xs flex flex-col items-center justify-center relative transition ${cellClass}`}
            >
              <span>{cell.day}</span>
              {isBooked && (
                <span className="w-1.5 h-1.5 rounded-full bg-red-500 absolute bottom-1"></span>
              )}
            </button>
          );
        })}
      </div>

      {/* Legenda Warna Kalender */}
      <div className="mt-3 pt-2.5 border-t border-gray-100 flex flex-wrap items-center gap-3 text-[10px] font-semibold text-gray-500">
        <span className="flex items-center gap-1.5">
          <span className="w-3 h-3 rounded bg-white border border-gray-300 inline-block"></span> Tersedia
        </span>
        {onSelectRange && (
          <span className="flex items-center gap-1.5">
            <span className="w-3 h-3 rounded bg-brand-600 inline-block"></span> Pilihan Anda
          </span>
        )}
        <span className="flex items-center gap-1.5">
          <span className="w-3 h-3 rounded bg-red-100 border border-red-300 inline-block"></span> Sudah Dibooking
        </span>
        <span className="flex items-center gap-1.5">
          <span className="w-3 h-3 rounded bg-gray-200 inline-block"></span> Libur Rutin Guide
        </span>
      </div>

      {/* Daftar Keterangan Tanggal yang Sudah Dibooking */}
      {monthSchedules.length > 0 && (
        <div className="mt-3 pt-2.5 border-t border-dashed border-gray-200 space-y-1.5">
          <p className="text-[10px] font-bold text-gray-500 uppercase tracking-wider">
            <i className="fa-solid fa-calendar-xmark text-red-500 mr-1"></i>
            Jadwal Terbooking di Bulan {MONTH_NAMES_ID[viewMonth]}:
          </p>
          {monthSchedules.map((sch, idx) => (
            <div
              key={sch.id || idx}
              className={`flex items-center justify-between gap-2 text-xs px-3 py-2 rounded-xl border transition ${
                hoveredBooking === sch
                  ? 'bg-red-100/80 border-red-300 text-red-900'
                  : 'bg-red-50/70 border-red-100 text-red-800'
              }`}
            >
              <div className="min-w-0">
                <span className="font-bold block">
                  {formatReadableRange(sch.start_date?.slice(0, 10), (sch.end_date || sch.start_date)?.slice(0, 10))}
                </span>
                <span className="text-[11px] text-red-600 block truncate">
                  {sch.destination || 'Pendakian Gunung'}
                  {isAdmin && sch.customer_name ? ` • Oleh: ${sch.customer_name}` : ' • Sudah Dibooking'}
                  {sch.note ? ` (${sch.note})` : ''}
                </span>
              </div>
              {isAdmin && onDeleteSchedule && typeof sch.id === 'number' && (
                <button
                  type="button"
                  onClick={() => onDeleteSchedule(sch.id)}
                  className="text-red-500 hover:bg-red-200/60 p-1.5 rounded-lg transition flex-shrink-0"
                  title="Hapus jadwal ini"
                >
                  <i className="fa-solid fa-trash-can text-xs"></i>
                </button>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
};
