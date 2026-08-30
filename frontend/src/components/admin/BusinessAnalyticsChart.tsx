import React, { useState, useMemo } from 'react';
import { 
  TrendingUp, 
  Users, 
  Euro, 
  CheckCircle2, 
  ShoppingBag, 
  Calendar,
  Sparkles,
  ChevronLeft,
  ChevronRight,
  BarChart3
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
type ViewMode = '7d' | '30d' | 'month' | 'annual';

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

const formatMonthName = (yearMonth: string) => {
  const [year, month] = yearMonth.split('-');
  const date = new Date(parseInt(year, 10), parseInt(month, 10) - 1, 1);
  return date.toLocaleDateString('it-IT', { month: 'long', year: 'numeric' });
};

export const BusinessAnalyticsChart: React.FC<BusinessAnalyticsChartProps> = ({ data }) => {
  const [selectedMetric, setSelectedMetric] = useState<MetricType>('active_users');
  const [viewMode, setViewMode] = useState<ViewMode>('7d');
  const [hoveredDay, setHoveredDay] = useState<{ label: string; date?: string; active_users: number; revenue: number; orders_count: number; lessons_completed: number } | null>(null);

  // Extract all available months from data
  const availableMonths = useMemo(() => {
    if (!data || data.length === 0) return [];
    const monthsSet = new Set<string>();
    for (const d of data) {
      if (d.date) {
        monthsSet.add(d.date.slice(0, 7)); // 'YYYY-MM'
      }
    }
    return Array.from(monthsSet).sort();
  }, [data]);

  // Current selected month for monthly navigation (default to latest month)
  const [selectedMonth, setSelectedMonth] = useState<string>(() => {
    if (availableMonths.length > 0) {
      return availableMonths[availableMonths.length - 1];
    }
    const today = new Date();
    return `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, '0')}`;
  });

  // Current selected year for annual view
  const currentYear = useMemo(() => {
    return selectedMonth ? selectedMonth.slice(0, 4) : String(new Date().getFullYear());
  }, [selectedMonth]);

  // Handle previous & next month navigation
  const currentMonthIndex = availableMonths.indexOf(selectedMonth);
  const hasPrevMonth = currentMonthIndex > 0;
  const hasNextMonth = currentMonthIndex < availableMonths.length - 1;

  const handlePrevMonth = () => {
    if (hasPrevMonth) {
      setSelectedMonth(availableMonths[currentMonthIndex - 1]);
    }
  };

  const handleNextMonth = () => {
    if (hasNextMonth) {
      setSelectedMonth(availableMonths[currentMonthIndex + 1]);
    }
  };

  // Build chart items depending on viewMode
  const chartItems: Array<{
    key: string;
    date?: string;
    topLabel?: string;
    bottomLabel: string;
    isDimLabel?: boolean;
    tooltipTitle: string;
    active_users: number;
    revenue: number;
    orders_count: number;
    lessons_completed: number;
  }> = useMemo(() => {
    if (!data || data.length === 0) return [];

    if (viewMode === '7d') {
      return data.slice(-7).map(d => ({
        key: d.date,
        date: d.date,
        topLabel: (new Date(`${d.date}T12:00:00Z`)).toLocaleDateString('it-IT', { weekday: 'short' }),
        bottomLabel: (new Date(`${d.date}T12:00:00Z`)).toLocaleDateString('it-IT', { day: 'numeric' }),
        isDimLabel: false,
        tooltipTitle: (new Date(`${d.date}T12:00:00Z`)).toLocaleDateString('it-IT', { weekday: 'long', day: 'numeric', month: 'short' }),
        active_users: d.active_users || 0,
        revenue: d.revenue || 0,
        orders_count: d.orders_count || 0,
        lessons_completed: d.lessons_completed || 0,
      }));
    }

    if (viewMode === '30d') {
      return data.slice(-30).map((d, idx, arr) => {
        const dateObj = new Date(`${d.date}T12:00:00Z`);
        const showLabel = idx % 3 === 0 || idx === arr.length - 1;
        return {
          key: d.date,
          date: d.date,
          topLabel: '',
          bottomLabel: showLabel ? dateObj.toLocaleDateString('it-IT', { day: 'numeric', month: 'numeric' }) : '•',
          isDimLabel: !showLabel,
          tooltipTitle: dateObj.toLocaleDateString('it-IT', { weekday: 'long', day: 'numeric', month: 'long' }),
          active_users: d.active_users || 0,
          revenue: d.revenue || 0,
          orders_count: d.orders_count || 0,
          lessons_completed: d.lessons_completed || 0,
        };
      });
    }

    if (viewMode === 'month') {
      // Filter days for the selected month
      const monthData = data.filter(d => d.date && d.date.startsWith(selectedMonth));
      return monthData.map((d, idx, arr) => {
        const dateObj = new Date(`${d.date}T12:00:00Z`);
        const dayNum = dateObj.toLocaleDateString('it-IT', { day: 'numeric' });
        const dayOfWeek = dateObj.toLocaleDateString('it-IT', { weekday: 'short' });
        // Clean label distribution so 31 days don't cram
        const showLabel = idx % 2 === 0 || idx === arr.length - 1;

        return {
          key: d.date,
          date: d.date,
          topLabel: showLabel ? dayOfWeek : '',
          bottomLabel: showLabel ? dayNum : '•',
          isDimLabel: !showLabel,
          tooltipTitle: dateObj.toLocaleDateString('it-IT', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' }),
          active_users: d.active_users || 0,
          revenue: d.revenue || 0,
          orders_count: d.orders_count || 0,
          lessons_completed: d.lessons_completed || 0,
        };
      });
    }

    if (viewMode === 'annual') {
      // Group all 12 months for currentYear
      const monthsMap: Record<string, { active_users: number; revenue: number; orders_count: number; lessons_completed: number }> = {};
      for (let m = 1; m <= 12; m++) {
        const ym = `${currentYear}-${String(m).padStart(2, '0')}`;
        monthsMap[ym] = { active_users: 0, revenue: 0, orders_count: 0, lessons_completed: 0 };
      }

      for (const d of data) {
        if (d.date && d.date.startsWith(currentYear)) {
          const ym = d.date.slice(0, 7);
          if (monthsMap[ym]) {
            monthsMap[ym].revenue += d.revenue || 0;
            monthsMap[ym].orders_count += d.orders_count || 0;
            monthsMap[ym].active_users = Math.max(monthsMap[ym].active_users, d.active_users || 0);
            monthsMap[ym].lessons_completed += d.lessons_completed || 0;
          }
        }
      }

      return Object.entries(monthsMap).map(([ym, stats]) => {
        const monthNum = parseInt(ym.slice(5, 7), 10);
        const dateObj = new Date(parseInt(currentYear, 10), monthNum - 1, 1);
        const shortName = dateObj.toLocaleDateString('it-IT', { month: 'short' });
        const fullName = dateObj.toLocaleDateString('it-IT', { month: 'long', year: 'numeric' });

        return {
          key: ym,
          date: ym,
          topLabel: '',
          bottomLabel: shortName,
          isDimLabel: false,
          tooltipTitle: fullName,
          active_users: stats.active_users,
          revenue: stats.revenue,
          orders_count: stats.orders_count,
          lessons_completed: stats.lessons_completed,
        };
      });
    }

    return [];
  }, [data, viewMode, selectedMonth, currentYear]);

  const config = METRICS_CONFIG[selectedMetric];

  // Compute KPI metrics for current active chart items
  const stats = useMemo(() => {
    if (chartItems.length === 0) {
      return { total: 0, max: 0, maxLabel: '', average: 0, activeDaysCount: 0 };
    }

    let sum = 0;
    let maxVal = 0;
    let maxLabel = '';
    let activeDays = 0;

    for (const d of chartItems) {
      const val = (d[selectedMetric] as number) || 0;
      sum += val;
      if (val > 0) activeDays++;
      if (val > maxVal) {
        maxVal = val;
        maxLabel = d.tooltipTitle || '';
      }
    }

    const avg = sum / chartItems.length;
    return {
      total: sum,
      max: maxVal,
      maxLabel,
      average: avg,
      activeDaysCount: activeDays,
    };
  }, [chartItems, selectedMetric]);

  const chartMax = Math.max(stats.max, selectedMetric === 'revenue' ? 50 : 5);

  // Period label for KPI cards
  const periodLabel = useMemo(() => {
    if (viewMode === '7d') return '7 Giorni';
    if (viewMode === '30d') return '30 Giorni';
    if (viewMode === 'month') return formatMonthName(selectedMonth);
    if (viewMode === 'annual') return `Anno ${currentYear}`;
    return 'Periodo';
  }, [viewMode, selectedMonth, currentYear]);

  return (
    <section className="rounded-3xl border border-gray-200 bg-white p-4 sm:p-6 lg:p-7 shadow-sm">
      {/* 1. Header & Navigation Controls */}
      <div className="flex flex-col gap-4 xl:flex-row xl:items-center xl:justify-between border-b border-gray-100 pb-5">
        <div>
          <div className="flex items-center gap-2">
            <span className="flex h-7 w-7 items-center justify-center rounded-lg bg-primary-100 text-primary-700">
              <TrendingUp className="h-4 w-4" />
            </span>
            <h2 className="text-xl font-bold text-gray-900">Analisi Performance & Business</h2>
          </div>
          <p className="mt-1 text-sm text-gray-500">
            Monitora l'andamento di frequenza, incassi Stripe, lezioni seguite e nuovi ordini nei mesi.
          </p>
        </div>

        {/* View mode switcher & Month navigator */}
        <div className="flex flex-wrap items-center gap-2">
          
          {/* Preset Buttons */}
          <div className="flex items-center gap-1 rounded-xl bg-gray-100 p-1">
            <button
              type="button"
              onClick={() => setViewMode('7d')}
              className={`rounded-lg px-3 py-1.5 text-xs font-semibold transition-all ${
                viewMode === '7d'
                  ? 'bg-white text-gray-900 shadow-sm'
                  : 'text-gray-600 hover:text-gray-900'
              }`}
            >
              7 Giorni
            </button>
            <button
              type="button"
              onClick={() => setViewMode('30d')}
              className={`rounded-lg px-3 py-1.5 text-xs font-semibold transition-all ${
                viewMode === '30d'
                  ? 'bg-white text-gray-900 shadow-sm'
                  : 'text-gray-600 hover:text-gray-900'
              }`}
            >
              30 Giorni
            </button>
            <button
              type="button"
              onClick={() => setViewMode('month')}
              className={`flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-xs font-semibold transition-all ${
                viewMode === 'month'
                  ? 'bg-white text-gray-900 shadow-sm'
                  : 'text-gray-600 hover:text-gray-900'
              }`}
            >
              <Calendar className="h-3.5 w-3.5" />
              Mese per Mese
            </button>
            <button
              type="button"
              onClick={() => setViewMode('annual')}
              className={`flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-xs font-semibold transition-all ${
                viewMode === 'annual'
                  ? 'bg-white text-gray-900 shadow-sm'
                  : 'text-gray-600 hover:text-gray-900'
              }`}
            >
              <BarChart3 className="h-3.5 w-3.5" />
              Anno {currentYear}
            </button>
          </div>

          {/* Month Stepper Selector (Visible in 'month' mode) */}
          {viewMode === 'month' && (
            <div className="flex items-center gap-1.5 rounded-xl border border-gray-200 bg-white p-1 shadow-sm">
              <button
                type="button"
                onClick={handlePrevMonth}
                disabled={!hasPrevMonth}
                className="rounded-lg p-1.5 text-gray-600 hover:bg-gray-100 hover:text-gray-900 disabled:opacity-30 disabled:cursor-not-allowed transition"
                title="Mese precedente"
              >
                <ChevronLeft className="h-4 w-4" />
              </button>

              <select
                value={selectedMonth}
                onChange={(e) => setSelectedMonth(e.target.value)}
                className="bg-transparent text-xs font-bold text-gray-900 py-1 px-2 cursor-pointer focus:outline-none capitalize"
              >
                {availableMonths.map((m) => (
                  <option key={m} value={m}>
                    {formatMonthName(m)}
                  </option>
                ))}
              </select>

              <button
                type="button"
                onClick={handleNextMonth}
                disabled={!hasNextMonth}
                className="rounded-lg p-1.5 text-gray-600 hover:bg-gray-100 hover:text-gray-900 disabled:opacity-30 disabled:cursor-not-allowed transition"
                title="Mese successivo"
              >
                <ChevronRight className="h-4 w-4" />
              </button>
            </div>
          )}
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
              className={`flex items-center justify-center gap-2 rounded-xl border px-3 py-2 text-xs sm:text-sm font-semibold transition-all shadow-sm ${
                isSelected
                  ? `${item.borderActive} shadow-md scale-[1.02]`
                  : 'border-gray-200 bg-white text-gray-700 hover:bg-gray-50'
              }`}
            >
              <Icon className="h-4 w-4 shrink-0" />
              <span className="truncate">{item.label}</span>
            </button>
          );
        })}
      </div>

      {/* 3. Executive Summary KPI Cards */}
      <div className="mt-5 grid grid-cols-2 gap-3 sm:grid-cols-4">
        <div className="rounded-2xl border border-gray-100 bg-gradient-to-br from-gray-50 to-white p-4 shadow-sm">
          <p className="text-xs font-medium text-gray-500 truncate">Totale {periodLabel}</p>
          <p className={`mt-1 text-lg sm:text-2xl font-bold ${config.textAccent}`}>
            {config.formatValue(stats.total)}
          </p>
          <span className="mt-0.5 block text-[10px] text-gray-400">{config.unit} complessivi</span>
        </div>

        <div className="rounded-2xl border border-gray-100 bg-gradient-to-br from-gray-50 to-white p-4 shadow-sm">
          <p className="text-xs font-medium text-gray-500">Picco del Periodo</p>
          <p className="mt-1 text-lg sm:text-2xl font-bold text-gray-900">
            {config.formatValue(stats.max)}
          </p>
          <span className="mt-0.5 block text-[10px] text-gray-400 truncate">
            {stats.maxLabel || 'N/D'}
          </span>
        </div>

        <div className="rounded-2xl border border-gray-100 bg-gradient-to-br from-gray-50 to-white p-4 shadow-sm">
          <p className="text-xs font-medium text-gray-500">
            {viewMode === 'annual' ? 'Media al Mese' : 'Media al Giorno'}
          </p>
          <p className="mt-1 text-lg sm:text-2xl font-bold text-gray-900">
            {selectedMetric === 'revenue'
              ? formatCurrency(stats.average)
              : stats.average.toFixed(1)}
          </p>
          <span className="mt-0.5 block text-[10px] text-gray-400">
            media su {chartItems.length} {viewMode === 'annual' ? 'mesi' : 'giorni'}
          </span>
        </div>

        <div className="rounded-2xl border border-gray-100 bg-gradient-to-br from-gray-50 to-white p-4 shadow-sm">
          <p className="text-xs font-medium text-gray-500">
            {viewMode === 'annual' ? 'Mesi con Vendite' : 'Giorni con Attività'}
          </p>
          <p className="mt-1 text-lg sm:text-2xl font-bold text-emerald-600">
            {stats.activeDaysCount} / {chartItems.length}
          </p>
          <span className="mt-0.5 block text-[10px] text-gray-400">
            {Math.round((stats.activeDaysCount / (chartItems.length || 1)) * 100)}% di continuità
          </span>
        </div>
      </div>

      {/* 4. Interactive Vibrant Bar Chart Container */}
      <div className="relative mt-6 overflow-x-auto rounded-2xl border border-gray-100 bg-gradient-to-b from-gray-50/70 via-white to-gray-50/40 p-4 sm:p-5">
        {/* Floating Interactive Tooltip */}
        {hoveredDay && (
          <div className="absolute top-2 left-1/2 -translate-x-1/2 rounded-xl border border-gray-200 bg-white/95 px-4 py-2.5 shadow-xl backdrop-blur-md transition-all z-30 pointer-events-none min-w-[220px]">
            <div className="flex items-center justify-between gap-2 border-b border-gray-100 pb-1.5">
              <span className="text-xs font-bold text-gray-900 capitalize">
                {hoveredDay.label}
              </span>
              <span className={`rounded-full px-2 py-0.5 text-[9px] font-bold ${config.bgBadge}`}>
                {config.label}
              </span>
            </div>
            <div className="mt-1.5 grid grid-cols-2 gap-x-3 gap-y-0.5 text-xs">
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

        {/* The Bars Grid */}
        <div
          className={`grid h-52 items-end gap-1 sm:gap-2 ${
            chartItems.length > 20 ? 'min-w-[550px]' : 'w-full'
          }`}
          style={{ gridTemplateColumns: `repeat(${chartItems.length}, minmax(0, 1fr))` }}
        >
          {chartItems.map((item) => {
            const rawVal = (item[selectedMetric] as number) || 0;
            const heightPercent = Math.max((rawVal / chartMax) * 100, rawVal > 0 ? 10 : 3);
            const isHighlighted = rawVal === stats.max && rawVal > 0;
            const isHovered = hoveredDay?.label === item.tooltipTitle;

            return (
              <div
                key={item.key}
                onMouseEnter={() =>
                  setHoveredDay({
                    label: item.tooltipTitle,
                    date: item.date,
                    active_users: item.active_users,
                    revenue: item.revenue,
                    orders_count: item.orders_count,
                    lessons_completed: item.lessons_completed,
                  })
                }
                onMouseLeave={() => setHoveredDay(null)}
                className="group relative flex h-full min-w-0 flex-col justify-end text-center cursor-pointer"
              >
                {/* Top value indicator (on 7d, annual, or hover) */}
                {(viewMode === '7d' || viewMode === 'annual' || isHovered) && (
                  <span
                    className={`mb-1 truncate text-[10px] sm:text-xs font-bold transition-all ${
                      isHighlighted
                        ? `${config.textAccent} scale-110`
                        : isHovered
                        ? 'text-gray-900 font-extrabold'
                        : 'text-gray-600'
                    }`}
                  >
                    {rawVal > 0
                      ? selectedMetric === 'revenue'
                        ? `${Math.round(rawVal)}€`
                        : rawVal
                      : ''}
                  </span>
                )}

                {/* Animated Gradient Bar */}
                <div
                  className={`relative w-full rounded-t-lg bg-gradient-to-t ${
                    isHovered ? config.barHoverGradient : config.barGradient
                  } transition-all duration-300 ${
                    rawVal === 0 ? 'opacity-20 bg-gray-300' : 'shadow-md group-hover:shadow-lg'
                  } ${isHovered ? 'scale-x-110 ring-2 ring-white ring-offset-2' : ''}`}
                  style={{ height: `${heightPercent}%` }}
                >
                  {isHighlighted && (
                    <span className="absolute -top-1.5 left-1/2 -translate-x-1/2 flex h-2 w-2">
                      <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-amber-400 opacity-75"></span>
                      <span className="relative inline-flex rounded-full h-2 w-2 bg-amber-500"></span>
                    </span>
                  )}
                </div>

                {/* Bottom Date / Month Label */}
                <div className="mt-2 text-center h-8 flex flex-col justify-start">
                  {item.topLabel && (
                    <span className="block text-[9px] font-medium text-gray-500 capitalize leading-tight">
                      {item.topLabel}
                    </span>
                  )}
                  <span
                    className={`block text-[10px] font-bold leading-tight capitalize ${
                      item.isDimLabel ? 'text-transparent' : 'text-gray-700'
                    }`}
                  >
                    {item.bottomLabel}
                  </span>
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* 5. Smart Business Footnote */}
      <div className="mt-4 flex flex-col sm:flex-row sm:items-center justify-between gap-2 rounded-2xl bg-gray-50 px-4 py-3 text-xs text-gray-600">
        <div className="flex items-center gap-2">
          <Sparkles className="h-4 w-4 text-amber-500 shrink-0" />
          <span>
            {stats.max > 0 ? (
              <>
                Picco di <strong>{config.formatValue(stats.max)}</strong> ({stats.maxLabel}).
                Continuità nel periodo all'<strong>{Math.round((stats.activeDaysCount / (chartItems.length || 1)) * 100)}%</strong>.
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
