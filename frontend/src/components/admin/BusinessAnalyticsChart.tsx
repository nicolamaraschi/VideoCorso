import React, { useState, useMemo } from 'react';
import { 
  TrendingUp, 
  Users, 
  Euro, 
  CheckCircle2, 
  ShoppingBag, 
  Calendar,
  Sparkles
} from 'lucide-react';
import { formatCurrency } from '../../utils/formatters';

interface DailyStat {
  date: string;
  active_users: number;
  revenue?: number;
  orders_count?: number;
  lessons_completed?: number;
}

interface BusinessAnalyticsChartProps {
  data: DailyStat[];
}

type MetricType = 'active_users' | 'revenue' | 'lessons_completed' | 'orders_count';
type TimeframeType = 7 | 14 | 30;

const METRICS_CONFIG: Record<
  MetricType,
  {
    label: string;
    shortLabel: string;
    icon: React.ComponentType<{ className?: string }>;
    colorName: string;
    barGradient: string;
    barHoverGradient: string;
    bgBadge: string;
    borderActive: string;
    textAccent: string;
    formatValue: (val: number) => string;
    unit: string;
  }
> = {
  active_users: {
    label: 'Corsiste Attive',
    shortLabel: 'Studenti',
    icon: Users,
    colorName: 'rose',
    barGradient: 'from-rose-500 via-pink-500 to-purple-600',
    barHoverGradient: 'from-rose-400 via-pink-400 to-purple-500',
    bgBadge: 'bg-rose-50 text-rose-700 border-rose-200',
    borderActive: 'border-rose-500 bg-rose-500 text-white shadow-rose-200',
    textAccent: 'text-rose-600',
    formatValue: (v) => `${v}`,
    unit: 'corsiste',
  },
  revenue: {
    label: 'Incassi & Fatturato',
    shortLabel: 'Fatturato',
    icon: Euro,
    colorName: 'emerald',
    barGradient: 'from-emerald-500 via-teal-500 to-cyan-600',
    barHoverGradient: 'from-emerald-400 via-teal-400 to-cyan-500',
    bgBadge: 'bg-emerald-50 text-emerald-700 border-emerald-200',
    borderActive: 'border-emerald-500 bg-emerald-500 text-white shadow-emerald-200',
    textAccent: 'text-emerald-600',
    formatValue: (v) => formatCurrency(v),
    unit: '€',
  },
  lessons_completed: {
    label: 'Lezioni Completate',
    shortLabel: 'Didattica',
    icon: CheckCircle2,
    colorName: 'amber',
    barGradient: 'from-amber-500 via-orange-500 to-rose-600',
    barHoverGradient: 'from-amber-400 via-orange-400 to-rose-500',
    bgBadge: 'bg-amber-50 text-amber-700 border-amber-200',
    borderActive: 'border-amber-500 bg-amber-500 text-white shadow-amber-200',
    textAccent: 'text-amber-600',
    formatValue: (v) => `${v}`,
    unit: 'lezioni',
  },
  orders_count: {
    label: 'Nuove Iscrizioni',
    shortLabel: 'Ordini',
    icon: ShoppingBag,
    colorName: 'indigo',
    barGradient: 'from-indigo-500 via-blue-500 to-violet-600',
    barHoverGradient: 'from-indigo-400 via-blue-400 to-violet-500',
    bgBadge: 'bg-indigo-50 text-indigo-700 border-indigo-200',
    borderActive: 'border-indigo-500 bg-indigo-500 text-white shadow-indigo-200',
    textAccent: 'text-indigo-600',
    formatValue: (v) => `${v}`,
    unit: 'ordini',
  },
};

export const BusinessAnalyticsChart: React.FC<BusinessAnalyticsChartProps> = ({ data }) => {
  const [selectedMetric, setSelectedMetric] = useState<MetricType>('active_users');
  const [timeframe, setTimeframe] = useState<TimeframeType>(7);
  const [hoveredDay, setHoveredDay] = useState<DailyStat | null>(null);

  // Filter timeframe from latest entries
  const filteredData = useMemo(() => {
    if (!data || data.length === 0) return [];
    return data.slice(-timeframe);
  }, [data, timeframe]);

  const config = METRICS_CONFIG[selectedMetric];

  // Compute KPI metrics for selected window
  const stats = useMemo(() => {
    if (filteredData.length === 0) {
      return { total: 0, max: 0, maxDate: '', average: 0, activeDaysCount: 0 };
    }

    let sum = 0;
    let maxVal = 0;
    let maxDay = '';
    let activeDays = 0;

    for (const d of filteredData) {
      const val = (d[selectedMetric] as number) || 0;
      sum += val;
      if (val > 0) activeDays++;
      if (val > maxVal) {
        maxVal = val;
        maxDay = d.date;
      }
    }

    const avg = sum / filteredData.length;
    return {
      total: sum,
      max: maxVal,
      maxDate: maxDay,
      average: avg,
      activeDaysCount: activeDays,
    };
  }, [filteredData, selectedMetric]);

  const chartMax = Math.max(stats.max, selectedMetric === 'revenue' ? 100 : 5);

  return (
    <section className="rounded-2xl border border-gray-200 bg-white p-6 shadow-sm">
      {/* 1. Header & Controls */}
      <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between border-b border-gray-100 pb-5">
        <div>
          <div className="flex items-center gap-2">
            <span className="flex h-7 w-7 items-center justify-center rounded-lg bg-primary-100 text-primary-700">
              <TrendingUp className="h-4 w-4" />
            </span>
            <h2 className="text-xl font-bold text-gray-900">Analisi Performance & Business</h2>
          </div>
          <p className="mt-1 text-sm text-gray-500">
            Monitora l'andamento di frequenza, incassi Stripe, lezioni seguite e nuove iscrizioni.
          </p>
        </div>

        {/* Timeframe selector tabs */}
        <div className="flex items-center gap-1.5 self-start rounded-xl bg-gray-100 p-1 lg:self-auto">
          {([7, 14, 30] as TimeframeType[]).map((days) => (
            <button
              key={days}
              type="button"
              onClick={() => setTimeframe(days)}
              className={`flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-xs font-semibold transition-all ${
                timeframe === days
                  ? 'bg-white text-gray-900 shadow-sm'
                  : 'text-gray-600 hover:text-gray-900'
              }`}
            >
              <Calendar className="h-3 w-3" />
              {days} Giorni
            </button>
          ))}
        </div>
      </div>

      {/* 2. Metric Selector Pills */}
      <div className="mt-5 grid grid-cols-2 gap-2 sm:grid-cols-4">
        {(Object.keys(METRICS_CONFIG) as MetricType[]).map((key) => {
          const item = METRICS_CONFIG[key];
          const Icon = item.icon;
          const isSelected = selectedMetric === key;

          return (
            <button
              key={key}
              type="button"
              onClick={() => setSelectedMetric(key)}
              className={`flex items-center justify-center gap-2 rounded-xl border px-3.5 py-2.5 text-xs sm:text-sm font-semibold transition-all shadow-sm ${
                isSelected
                  ? `${item.borderActive} shadow-md scale-[1.02]`
                  : 'border-gray-200 bg-white text-gray-700 hover:bg-gray-50'
              }`}
            >
              <Icon className="h-4 w-4" />
              <span>{item.label}</span>
            </button>
          );
        })}
      </div>

      {/* 3. Executive Summary KPI Cards */}
      <div className="mt-5 grid grid-cols-2 gap-3 sm:grid-cols-4">
        <div className="rounded-xl border border-gray-100 bg-gradient-to-br from-gray-50 to-white p-3.5 shadow-sm">
          <p className="text-xs font-medium text-gray-500">Totale {timeframe}gg</p>
          <p className={`mt-1 text-lg sm:text-xl font-bold ${config.textAccent}`}>
            {config.formatValue(stats.total)}
          </p>
          <span className="mt-0.5 block text-[10px] text-gray-400">{config.unit} complessivi</span>
        </div>

        <div className="rounded-xl border border-gray-100 bg-gradient-to-br from-gray-50 to-white p-3.5 shadow-sm">
          <p className="text-xs font-medium text-gray-500">Picco Giornaliero</p>
          <p className="mt-1 text-lg sm:text-xl font-bold text-gray-900">
            {config.formatValue(stats.max)}
          </p>
          <span className="mt-0.5 block text-[10px] text-gray-400">
            {stats.maxDate
              ? new Date(`${stats.maxDate}T12:00:00Z`).toLocaleDateString('it-IT', { weekday: 'short', day: 'numeric', month: 'short' })
              : 'N/D'}
          </span>
        </div>

        <div className="rounded-xl border border-gray-100 bg-gradient-to-br from-gray-50 to-white p-3.5 shadow-sm">
          <p className="text-xs font-medium text-gray-500">Media al Giorno</p>
          <p className="mt-1 text-lg sm:text-xl font-bold text-gray-900">
            {selectedMetric === 'revenue'
              ? formatCurrency(stats.average)
              : stats.average.toFixed(1)}
          </p>
          <span className="mt-0.5 block text-[10px] text-gray-400">media su {timeframe} giorni</span>
        </div>

        <div className="rounded-xl border border-gray-100 bg-gradient-to-br from-gray-50 to-white p-3.5 shadow-sm">
          <p className="text-xs font-medium text-gray-500">Giorni con Attività</p>
          <p className="mt-1 text-lg sm:text-xl font-bold text-emerald-600">
            {stats.activeDaysCount} / {timeframe}
          </p>
          <span className="mt-0.5 block text-[10px] text-gray-400">
            {Math.round((stats.activeDaysCount / timeframe) * 100)}% di continuità
          </span>
        </div>
      </div>

      {/* 4. Interactive Vibrant Bar Chart */}
      <div className="relative mt-6 rounded-2xl border border-gray-100 bg-gradient-to-b from-gray-50/70 via-white to-gray-50/40 p-5">
        {/* Subtle Benchmark line */}
        <div
          className="absolute left-6 right-6 border-b border-dashed border-gray-300 pointer-events-none transition-all duration-300"
          style={{
            bottom: `${Math.min(Math.max((stats.average / chartMax) * 100, 10), 90)}%`,
          }}
        >
          <span className="absolute -top-4 right-0 rounded bg-gray-200/80 px-1.5 py-0.5 text-[9px] font-medium text-gray-600">
            Media: {config.formatValue(Math.round(stats.average))}
          </span>
        </div>

        {/* The Bars Container */}
        <div
          className="grid h-52 items-end gap-1 sm:gap-2.5"
          style={{ gridTemplateColumns: `repeat(${filteredData.length}, minmax(0, 1fr))` }}
        >
          {filteredData.map((day) => {
            const rawVal = (day[selectedMetric] as number) || 0;
            const heightPercent = Math.max((rawVal / chartMax) * 100, rawVal > 0 ? 8 : 2.5);
            const isHighlighted = rawVal === stats.max && rawVal > 0;
            const isHovered = hoveredDay?.date === day.date;
            const dateObj = new Date(`${day.date}T12:00:00Z`);
            const dayOfWeek = dateObj.toLocaleDateString('it-IT', { weekday: timeframe > 14 ? 'narrow' : 'short' });
            const dayNum = dateObj.toLocaleDateString('it-IT', { day: 'numeric' });

            return (
              <div
                key={day.date}
                onMouseEnter={() => setHoveredDay(day)}
                onMouseLeave={() => setHoveredDay(null)}
                className="group relative flex h-full min-w-0 flex-col justify-end text-center cursor-pointer"
              >
                {/* Top value indicator */}
                <span
                  className={`mb-1.5 truncate text-[10px] sm:text-xs font-bold transition-all ${
                    isHighlighted
                      ? `${config.textAccent} scale-110`
                      : isHovered
                      ? 'text-gray-900 font-extrabold'
                      : 'text-gray-600'
                  }`}
                >
                  {rawVal > 0
                    ? selectedMetric === 'revenue'
                      ? `€${Math.round(rawVal)}`
                      : rawVal
                    : ''}
                </span>

                {/* Animated Gradient Bar */}
                <div
                  className={`relative w-full rounded-t-lg bg-gradient-to-t ${
                    isHovered ? config.barHoverGradient : config.barGradient
                  } transition-all duration-300 ${
                    rawVal === 0 ? 'opacity-25 bg-gray-300' : 'shadow-md group-hover:shadow-lg'
                  } ${isHovered ? 'scale-x-105 ring-2 ring-white ring-offset-2' : ''}`}
                  style={{ height: `${heightPercent}%` }}
                >
                  {isHighlighted && (
                    <span className="absolute -top-2 left-1/2 -translate-x-1/2 flex h-2 w-2">
                      <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-amber-400 opacity-75"></span>
                      <span className="relative inline-flex rounded-full h-2 w-2 bg-amber-500"></span>
                    </span>
                  )}
                </div>

                {/* Bottom Date Label */}
                <div className="mt-2 text-center">
                  <span className="block text-[9px] sm:text-[11px] font-medium text-gray-500 capitalize leading-tight">
                    {dayOfWeek}
                  </span>
                  <span className="block text-[10px] sm:text-xs font-bold text-gray-700 leading-tight">
                    {dayNum}
                  </span>
                </div>
              </div>
            );
          })}
        </div>

        {/* 5. Floating Interactive Tooltip */}
        {hoveredDay && (
          <div className="absolute top-3 left-1/2 -translate-x-1/2 rounded-xl border border-gray-200 bg-white/95 px-4 py-2.5 shadow-xl backdrop-blur-md transition-all z-20 pointer-events-none min-w-[220px]">
            <div className="flex items-center justify-between gap-2 border-b border-gray-100 pb-1.5">
              <span className="text-xs font-bold text-gray-900 capitalize">
                {new Date(`${hoveredDay.date}T12:00:00Z`).toLocaleDateString('it-IT', {
                  weekday: 'long',
                  day: 'numeric',
                  month: 'long',
                })}
              </span>
              <span className={`rounded-full px-2 py-0.5 text-[10px] font-bold ${config.bgBadge}`}>
                {config.label}
              </span>
            </div>
            <div className="mt-2 grid grid-cols-2 gap-x-4 gap-y-1 text-xs">
              <div className="flex items-center justify-between">
                <span className="text-gray-500">Corsiste:</span>
                <span className="font-bold text-gray-900">{hoveredDay.active_users || 0}</span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-gray-500">Fatturato:</span>
                <span className="font-bold text-emerald-600">{formatCurrency(hoveredDay.revenue || 0)}</span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-gray-500">Lezioni:</span>
                <span className="font-bold text-amber-600">{hoveredDay.lessons_completed || 0}</span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-gray-500">Ordini:</span>
                <span className="font-bold text-indigo-600">{hoveredDay.orders_count || 0}</span>
              </div>
            </div>
          </div>
        )}
      </div>

      {/* 6. Smart Business Footnote */}
      <div className="mt-4 flex flex-col sm:flex-row sm:items-center justify-between gap-2 rounded-xl bg-gray-50 px-4 py-3 text-xs text-gray-600">
        <div className="flex items-center gap-2">
          <Sparkles className="h-4 w-4 text-amber-500 shrink-0" />
          <span>
            {stats.max > 0 ? (
              <>
                Picco di <strong>{config.formatValue(stats.max)}</strong> registrato il{' '}
                <strong>
                  {new Date(`${stats.maxDate}T12:00:00Z`).toLocaleDateString('it-IT', {
                    weekday: 'long',
                    day: 'numeric',
                    month: 'long',
                  })}
                </strong>
                . Continuità settimanale all'<strong>{Math.round((stats.activeDaysCount / timeframe) * 100)}%</strong>.
              </>
            ) : (
              'Nessun dato registrato nel periodo selezionato.'
            )}
          </span>
        </div>
        <span className="text-[11px] font-medium text-gray-400 shrink-0">
          Aggiornamento in tempo reale
        </span>
      </div>
    </section>
  );
};
