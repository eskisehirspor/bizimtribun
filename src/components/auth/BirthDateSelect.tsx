"use client";

import { useState } from "react";
import { fieldClass } from "@/components/ui";

const MONTHS = [
  "Ocak",
  "Şubat",
  "Mart",
  "Nisan",
  "Mayıs",
  "Haziran",
  "Temmuz",
  "Ağustos",
  "Eylül",
  "Ekim",
  "Kasım",
  "Aralık",
];

function daysIn(year: number, month: number) {
  return new Date(Date.UTC(year || 2000, month || 1, 0)).getUTCDate();
}

const pad = (n: number) => String(n).padStart(2, "0");

/**
 * Birth date as three plain dropdowns (Gün / Ay / Yıl). The native date
 * input made people page back month by month, so we skip it. Reports
 * "YYYY-MM-DD" once all three are picked, "" until then.
 */
export default function BirthDateSelect({
  value,
  onChange,
  minAge = 13,
  maxAge = 100,
  describedBy,
}: {
  value: string;
  onChange: (v: string) => void;
  minAge?: number;
  maxAge?: number;
  describedBy?: string;
}) {
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(value);
  const [day, setDay] = useState(m ? Number(m[3]) : 0);
  const [month, setMonth] = useState(m ? Number(m[2]) : 0);
  const [year, setYear] = useState(m ? Number(m[1]) : 0);

  const thisYear = new Date().getFullYear();
  const years: number[] = [];
  for (let y = thisYear - minAge; y >= thisYear - maxAge; y--) years.push(y);
  const maxDay = daysIn(year, month);

  function update(d: number, mo: number, y: number) {
    const dd = d > daysIn(y, mo) ? 0 : d;
    setDay(dd);
    setMonth(mo);
    setYear(y);
    onChange(dd && mo && y ? `${y}-${pad(mo)}-${pad(dd)}` : "");
  }

  const select = `${fieldClass} min-h-12 text-lg sm:text-base cursor-pointer`;
  return (
    <div className="mt-1 grid grid-cols-[1fr_1.6fr_1.3fr] gap-2" role="group" aria-describedby={describedBy}>
      <select
        required
        aria-label="Gün"
        autoComplete="bday-day"
        className={select}
        value={day || ""}
        onChange={(e) => update(Number(e.target.value), month, year)}
      >
        <option value="">Gün</option>
        {Array.from({ length: maxDay }, (_, i) => i + 1).map((d) => (
          <option key={d} value={d}>
            {d}
          </option>
        ))}
      </select>
      <select
        required
        aria-label="Ay"
        autoComplete="bday-month"
        className={select}
        value={month || ""}
        onChange={(e) => update(day, Number(e.target.value), year)}
      >
        <option value="">Ay</option>
        {MONTHS.map((name, i) => (
          <option key={name} value={i + 1}>
            {name}
          </option>
        ))}
      </select>
      <select
        required
        aria-label="Yıl"
        autoComplete="bday-year"
        className={select}
        value={year || ""}
        onChange={(e) => update(day, month, Number(e.target.value))}
      >
        <option value="">Yıl</option>
        {years.map((y) => (
          <option key={y} value={y}>
            {y}
          </option>
        ))}
      </select>
    </div>
  );
}
