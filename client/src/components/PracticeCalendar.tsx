import React, { useMemo, useState } from 'react';
import { CalendarDays, ChevronLeft, ChevronRight } from 'lucide-react';
import { compareMonths, countPracticedInMonth, dateKeyFromTimezone, getMonthGrid, getMonthNavigationBounds, monthFromTimezone, practicedSet, toDateKey, YearMonth } from '../lib/calendar';

const WEEKDAYS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];

export const PracticeCalendar: React.FC<{ practiceDates: string[]; timezone?: string }> = ({ practiceDates, timezone }) => {
  const current = useMemo(() => monthFromTimezone(new Date(), timezone), [timezone]);
  const [displayMonth, setDisplayMonth] = useState<YearMonth>(current);
  const bounds = getMonthNavigationBounds(current, practiceDates);
  const month = new Date(displayMonth.year, displayMonth.month, 1);
  const title = new Intl.DateTimeFormat('en-US', { month: 'long', year: 'numeric' }).format(month);
  const { leadingBlanks, daysInMonth } = getMonthGrid(displayMonth.year, displayMonth.month);
  const practiced = practicedSet(practiceDates);
  const activeDays = countPracticedInMonth(practiceDates, displayMonth.year, displayMonth.month);
  const todayKey = dateKeyFromTimezone(new Date(), timezone);
  const todayMonth = monthFromTimezone(new Date(), timezone);
  const stepMonth = (delta: number) => setDisplayMonth((value) => {
    const next = new Date(value.year, value.month + delta, 1);
    return { year: next.getFullYear(), month: next.getMonth() };
  });

  return <section className="w-full min-w-0 rounded-2xl border border-slate-200/80 bg-white p-3.5 shadow-xs" aria-label="Practice calendar">
    <header className="flex min-w-0 flex-wrap items-center justify-between gap-x-2 gap-y-1">
      <div className="flex min-w-0 items-center gap-1.5"><CalendarDays className="h-3.5 w-3.5 shrink-0 text-emerald-600" /><h2 className="text-xs font-bold text-slate-900">Calendar</h2></div>
      <p className="min-w-0 text-right text-[10px] font-semibold leading-tight text-slate-500">{activeDays} active {activeDays === 1 ? 'day' : 'days'}</p>
    </header>
    <div className="mt-2 flex items-center justify-between text-xs font-bold text-slate-800">
      <button type="button" aria-label="Previous month" disabled={compareMonths(displayMonth, bounds.earliest) <= 0} onClick={() => stepMonth(-1)} className="rounded p-1 text-slate-500 hover:bg-slate-100 disabled:cursor-not-allowed disabled:opacity-30"><ChevronLeft className="h-3.5 w-3.5" /></button>
      <h3 aria-live="polite" className="text-center">{title}</h3>
      <button type="button" aria-label="Next month" disabled={compareMonths(displayMonth, todayMonth) >= 0} onClick={() => stepMonth(1)} className="rounded p-1 text-slate-500 hover:bg-slate-100 disabled:cursor-not-allowed disabled:opacity-30"><ChevronRight className="h-3.5 w-3.5" /></button>
    </div>
    <div role="grid" aria-label={title} className="mx-auto mt-2 grid max-w-sm grid-cols-[repeat(7,minmax(0,1fr))] gap-0.5 text-center">
      {WEEKDAYS.map((day) => <div role="columnheader" key={day} className="py-0.5 text-[9px] font-semibold text-slate-400 sm:text-[10px]">{day}</div>)}
      {Array.from({ length: leadingBlanks }, (_, index) => <div aria-hidden="true" key={`blank-${index}`} />)}
      {Array.from({ length: daysInMonth }, (_, index) => {
        const day = index + 1;
        const date = new Date(displayMonth.year, displayMonth.month, day);
        const key = toDateKey(date);
        const isPracticed = practiced.has(key);
        const isToday = key === todayKey;
        const isFuture = compareMonths(displayMonth, todayMonth) === 0 && day > Number(todayKey.slice(-2));
        const accessibleDate = new Intl.DateTimeFormat('en-GB', { day: 'numeric', month: 'long' }).format(date);
        return <div role="gridcell" aria-label={`${accessibleDate}${isPracticed ? ', practiced' : isToday ? ', today' : ''}`} key={key} className="min-w-0 p-0.5">
          <span className={`mx-auto flex aspect-square w-full max-w-9 items-center justify-center rounded-full text-[10px] font-medium sm:text-xs ${isPracticed ? 'bg-emerald-600 font-bold text-white' : isToday ? 'rounded-full border border-emerald-600 text-slate-700' : isFuture ? 'text-slate-300' : 'text-slate-600'}`}>{day}</span>
        </div>;
      })}
    </div>
    <p className="mt-2 flex items-center gap-1.5 text-[10px] text-slate-500"><span aria-hidden="true" className="h-2 w-2 rounded-full bg-emerald-600" />Practiced day</p>
  </section>;
};
