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
    shortLabel: 'Corsiste',
    icon: Users,
    colorName: 'burgundy',
    barGradient: 'from-[#381B21] via-[#56212B] to-[#7D3241]',
    barHoverGradient: 'from-[#56212B] via-[#7D3241] to-[#9C3F52]',
    bgBadge: 'bg-primary-50 text-primary-900 border-primary-200',
    borderActive: 'border-primary-900 bg-primary-900 text-white shadow-primary-950/20',
    textAccent: 'text-primary-950',
    formatValue: (v) => `${v}`,
    unit: 'corsiste',
  },
  revenue: {
    label: 'Incassi & Fatturato',
    shortLabel: 'Fatturato',
    icon: Euro,
    colorName: 'emerald',
    barGradient: 'from-[#14422A] via-[#1B5E3C] to-[#2D7D52]',
    barHoverGradient: 'from-[#1B5E3C] via-[#2D7D52] to-[#3E9E6B]',
    bgBadge: 'bg-emerald-50 text-emerald-900 border-emerald-200',
    borderActive: 'border-emerald-800 bg-emerald-800 text-white shadow-emerald-900/20',
    textAccent: 'text-emerald-800',
    formatValue: (v) => formatCurrency(v),
    unit: '€',
  },
  lessons_completed: {
    label: 'Lezioni Completate',
    shortLabel: 'Didattica',
    icon: CheckCircle2,
    colorName: 'gold',
    barGradient: 'from-[#7A591E] via-[#A87E2C] to-[#CBA24B]',
    barHoverGradient: 'from-[#A87E2C] via-[#CBA24B] to-[#DFC075]',
    bgBadge: 'bg-amber-50 text-amber-900 border-amber-200',
    borderActive: 'border-amber-700 bg-amber-700 text-white shadow-amber-800/20',
    textAccent: 'text-amber-900',
    formatValue: (v) => `${v}`,
    unit: 'lezioni',
  },
  orders_count: {
    label: 'Nuove Iscrizioni',
    shortLabel: 'Ordini',
    icon: ShoppingBag,
    colorName: 'plum',
    barGradient: 'from-[#3A141E] via-[#5C2332] to-[#803548]',
    barHoverGradient: 'from-[#5C2332] via-[#803548] to-[#9F465D]',
    bgBadge: 'bg-primary-50 text-primary-900 border-primary-200',
    borderActive: 'border-primary-950 bg-primary-950 text-white shadow-primary-950/20',
    textAccent: 'text-primary-950',
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
    const sorted = Array.from(monthsSet).sort();
    return sorted;
  }, [data]);

  // Selected single month when in 'month' viewMode (defaults to the latest month with data or current)
  const [selectedMonthIndex, setSelectedMonthIndex] = useState<number>(() => {
    return Math.max(0, availableMonths.length - 1);
  });

  // Selected year when in 'annual' viewMode
  const [selectedYear, setSelectedYear] = useState<number>(() => new Date().getFullYear());

  const config = METRICS_CONFIG[selectedMetric];

  // =========================================================================
  // DATA FILTERING & AGGREGATION BASED ON VIEW MODE
  // =========================================================================

  const { chartItems, stats, periodLabel } = useMemo(() => {
    if (!data || data.length === 0) {
      return {
        chartItems: [],
        stats: { total: 0, average: 0, max: 0, maxLabel: '', activeDaysCount: 0 },
        periodLabel: 'Periodo',
      };
    }

    // Sort data chronologically
    const sortedData = [...data].sort((a, b) => a.date.localeCompare(b.date));

    // 1. LAST 7 DAYS
    if (viewMode === '7d') {
      const items = sortedData.slice(-7).map((d) => {
        const dateObj = new Date(d.date + 'T00:00:00');
        const dayName = dateObj.toLocaleDateString('it-IT', { weekday: 'short' });
        const dayNum = dateObj.toLocaleDateString('it-IT', { day: 'numeric' });
        return {
          key: d.date,
          date: d.date,
          topLabel: dayName,
          bottomLabel: dayNum,
          isDimLabel: false,
          tooltipTitle: dateObj.toLocaleDateString('it-IT', { weekday: 'long', day: 'numeric', month: 'long' }),
          active_users: d.active_users || 0,
          revenue: d.revenue || 0,
          orders_count: d.orders_count || 0,
          lessons_completed: d.lessons_completed || 0,
        };
      });

      const values = items.map((i) => i[selectedMetric] as number);
      const total = values.reduce((acc, v) => acc + v, 0);
      const max = Math.max(...values, 0);
      const maxItem = items.find((i) => (i[selectedMetric] as number) === max);
      const activeDaysCount = values.filter((v) => v > 0).length;

      return {
        chartItems: items,
        stats: {
          total,
          average: items.length > 0 ? total / items.length : 0,
          max,
          maxLabel: maxItem ? maxItem.tooltipTitle : '',
          activeDaysCount,
        },
        periodLabel: '7 Giorni',
      };
    }

    // 2. LAST 30 DAYS
    if (viewMode === '30d') {
      const items = sortedData.slice(-30).map((d, index) => {
        const dateObj = new Date(d.date + 'T00:00:00');
        const dayNum = dateObj.toLocaleDateString('it-IT', { day: 'numeric' });
        const isDim = index % 3 !== 0 && index !== 29;
        return {
          key: d.date,
          date: d.date,
          topLabel: '',
          bottomLabel: dayNum,
          isDimLabel: isDim,
          tooltipTitle: dateObj.toLocaleDateString('it-IT', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' }),
          active_users: d.active_users || 0,
          revenue: d.revenue || 0,
          orders_count: d.orders_count || 0,
          lessons_completed: d.lessons_completed || 0,
        };
      });

      const values = items.map((i) => i[selectedMetric] as number);
      const total = values.reduce((acc, v) => acc + v, 0);
      const max = Math.max(...values, 0);
      const maxItem = items.find((i) => (i[selectedMetric] as number) === max);
      const activeDaysCount = values.filter((v) => v > 0).length;

      return {
        chartItems: items,
        stats: {
          total,
          average: items.length > 0 ? total / items.length : 0,
          max,
          maxLabel: maxItem ? maxItem.tooltipTitle : '',
          activeDaysCount,
        },
        periodLabel: '30 Giorni',
      };
    }

    // 3. SINGLE MONTH SELECTION
    if (viewMode === 'month') {
      const currentMonthKey = availableMonths[selectedMonthIndex] || sortedData[sortedData.length - 1].date.slice(0, 7);
      const monthData = sortedData.filter((d) => d.date.startsWith(currentMonthKey));

      const items = monthData.map((d, index) => {
        const dateObj = new Date(d.date + 'T00:00:00');
        const dayNum = dateObj.toLocaleDateString('it-IT', { day: 'numeric' });
        const dayShort = dateObj.toLocaleDateString('it-IT', { weekday: 'narrow' });
        const isDim = index % 2 !== 0 && index !== monthData.length - 1;
        return {
          key: d.date,
          date: d.date,
          topLabel: dayShort,
          bottomLabel: dayNum,
          isDimLabel: isDim,
          tooltipTitle: dateObj.toLocaleDateString('it-IT', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' }),
          active_users: d.active_users || 0,
          revenue: d.revenue || 0,
          orders_count: d.orders_count || 0,
          lessons_completed: d.lessons_completed || 0,
        };
      });

      const values = items.map((i) => i[selectedMetric] as number);
      const total = values.reduce((acc, v) => acc + v, 0);
      const max = Math.max(...values, 0);
      const maxItem = items.find((i) => (i[selectedMetric] as number) === max);
      const activeDaysCount = values.filter((v) => v > 0).length;

      return {
        chartItems: items,
        stats: {
          total,
          average: items.length > 0 ? total / items.length : 0,
          max,
          maxLabel: maxItem ? maxItem.tooltipTitle : '',
          activeDaysCount,
        },
        periodLabel: formatMonthName(currentMonthKey),
      };
    }

    // 4. ANNUAL (12 MONTHS AGGREGATE)
    if (viewMode === 'annual') {
      const monthsMap: Record<string, { active_users: number; revenue: number; orders_count: number; lessons_completed: number; daysCount: number }> = {};

      for (let m = 1; m <= 12; m++) {
        const monthStr = m < 10 ? `0${m}` : `${m}`;
        monthsMap[`${selectedYear}-${monthStr}`] = {
          active_users: 0,
          revenue: 0,
          orders_count: 0,
          lessons_completed: 0,
          daysCount: 0,
        };
      }

      for (const d of sortedData) {
        if (d.date.startsWith(`${selectedYear}-`)) {
          const mKey = d.date.slice(0, 7);
          if (monthsMap[mKey]) {
            monthsMap[mKey].active_users += d.active_users || 0;
            monthsMap[mKey].revenue += d.revenue || 0;
            monthsMap[mKey].orders_count += d.orders_count || 0;
            monthsMap[mKey].lessons_completed += d.lessons_completed || 0;
            if ((d[selectedMetric] || 0) > 0) {
              monthsMap[mKey].daysCount += 1;
            }
          }
        }
      }

      const items = Object.entries(monthsMap).map(([mKey, val]) => {
        const [y, m] = mKey.split('-');
        const dateObj = new Date(parseInt(y, 10), parseInt(m, 10) - 1, 1);
        const monthShort = dateObj.toLocaleDateString('it-IT', { month: 'short' });
        return {
          key: mKey,
          date: mKey,
          topLabel: '',
          bottomLabel: monthShort,
          isDimLabel: false,
          tooltipTitle: dateObj.toLocaleDateString('it-IT', { month: 'long', year: 'numeric' }),
          active_users: val.active_users,
          revenue: val.revenue,
          orders_count: val.orders_count,
          lessons_completed: val.lessons_completed,
        };
      });

      const values = items.map((i) => i[selectedMetric] as number);
      const total = values.reduce((acc, v) => acc + v, 0);
      const max = Math.max(...values, 0);
      const maxItem = items.find((i) => (i[selectedMetric] as number) === max);
      const activeMonthsCount = values.filter((v) => v > 0).length;

      return {
        chartItems: items,
        stats: {
          total,
          average: items.length > 0 ? total / 12 : 0,
          max,
          maxLabel: maxItem ? maxItem.tooltipTitle : '',
          activeDaysCount: activeMonthsCount,
        },
        periodLabel: `Anno ${selectedYear}`,
      };
    }

    return {
      chartItems: [],
      stats: { total: 0, average: 0, max: 0, maxLabel: '', activeDaysCount: 0 },
      periodLabel: 'Periodo',
    };
  }, [data, viewMode, selectedMetric, selectedMonthIndex, availableMonths, selectedYear]);

  const chartMax = useMemo(() => {
    return Math.max(...chartItems.map((i) => (i[selectedMetric] as number) || 0), 1);
  }, [chartItems, selectedMetric]);

  return (
    <section className="overflow-hidden rounded-3xl border border-primary-100 bg-white p-5 sm:p-7 shadow-xs">
      
      {/* 1. Header: Title, Subtitle & View Mode Controls */}
      <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-4 border-b border-primary-100 pb-5">
        <div>
          <div className="flex items-center gap-2">
            <div className="flex h-8 w-8 items-center justify-center rounded-xl bg-primary-50 border border-primary-200/80 text-primary-800">
              <TrendingUp className="h-4 w-4" />
            </div>
            <h3
              className="text-lg sm:text-xl font-bold text-primary-950"
              style={{ fontFamily: 'Abhaya Libre, serif' }}
            >
              Analisi Performance & Business
            </h3>
          </div>
          <p className="mt-1 text-xs sm:text-sm text-gray-600">
            Monitora l'andamento di frequenza, incassi Stripe, lezioni seguite e nuovi ordini nei mesi.
          </p>
        </div>

        {/* View Mode Switcher Pill */}
        <div className="flex flex-wrap items-center gap-1.5 rounded-2xl bg-primary-50/60 p-1.5 border border-primary-100/80">
          <button
            type="button"
            onClick={() => setViewMode('7d')}
            className={`px-3 py-1.5 rounded-xl text-xs font-semibold transition-all ${
              viewMode === '7d'
                ? 'bg-primary-900 text-white shadow-xs'
                : 'text-gray-700 hover:text-primary-950 hover:bg-white/80'
            }`}
          >
            7 Giorni
          </button>

          <button
            type="button"
            onClick={() => setViewMode('30d')}
            className={`px-3 py-1.5 rounded-xl text-xs font-semibold transition-all ${
              viewMode === '30d'
                ? 'bg-primary-900 text-white shadow-xs'
                : 'text-gray-700 hover:text-primary-950 hover:bg-white/80'
            }`}
          >
            30 Giorni
          </button>

          <button
            type="button"
            onClick={() => setViewMode('month')}
            className={`inline-flex items-center gap-1 px-3 py-1.5 rounded-xl text-xs font-semibold transition-all ${
              viewMode === 'month'
                ? 'bg-primary-900 text-white shadow-xs'
                : 'text-gray-700 hover:text-primary-950 hover:bg-white/80'
            }`}
          >
            <Calendar className="w-3.5 h-3.5" />
            <span>Mese per Mese</span>
          </button>

          <button
            type="button"
            onClick={() => setViewMode('annual')}
            className={`inline-flex items-center gap-1 px-3 py-1.5 rounded-xl text-xs font-semibold transition-all ${
              viewMode === 'annual'
                ? 'bg-primary-900 text-white shadow-xs'
                : 'text-gray-700 hover:text-primary-950 hover:bg-white/80'
            }`}
          >
            <BarChart3 className="w-3.5 h-3.5" />
            <span>Anno {selectedYear}</span>
          </button>
        </div>
      </div>

      {/* 1.1 Month / Year Navigator Bar */}
      {viewMode === 'month' && availableMonths.length > 0 && (
        <div className="mt-4 flex items-center justify-between rounded-2xl bg-primary-50/50 border border-primary-100/80 px-4 py-2.5">
          <button
            type="button"
            disabled={selectedMonthIndex <= 0}
            onClick={() => setSelectedMonthIndex((prev) => Math.max(0, prev - 1))}
            className="inline-flex items-center gap-1 text-xs font-semibold text-primary-900 hover:text-primary-950 disabled:opacity-30 disabled:cursor-not-allowed transition"
          >
            <ChevronLeft className="w-4 h-4" />
            <span>Mese Precedente</span>
          </button>

          <div className="flex items-center gap-2">
            <Calendar className="w-4 h-4 text-primary-700" />
            <span
              className="text-sm font-bold text-primary-950 capitalize"
              style={{ fontFamily: 'Abhaya Libre, serif' }}
            >
              {formatMonthName(availableMonths[selectedMonthIndex] || '')}
            </span>
          </div>

          <button
            type="button"
            disabled={selectedMonthIndex >= availableMonths.length - 1}
            onClick={() => setSelectedMonthIndex((prev) => Math.min(availableMonths.length - 1, prev + 1))}
            className="inline-flex items-center gap-1 text-xs font-semibold text-primary-900 hover:text-primary-950 disabled:opacity-30 disabled:cursor-not-allowed transition"
          >
            <span>Mese Successivo</span>
            <ChevronRight className="w-4 h-4" />
          </button>
        </div>
      )}

      {viewMode === 'annual' && (
        <div className="mt-4 flex items-center justify-between rounded-2xl bg-primary-50/50 border border-primary-100/80 px-4 py-2.5">
          <button
            type="button"
            onClick={() => setSelectedYear((y) => y - 1)}
            className="inline-flex items-center gap-1 text-xs font-semibold text-primary-900 hover:text-primary-950 transition"
          >
            <ChevronLeft className="w-4 h-4" />
            <span>Anno {selectedYear - 1}</span>
          </button>

          <span
            className="text-sm font-bold text-primary-950"
            style={{ fontFamily: 'Abhaya Libre, serif' }}
          >
            Report Annuale {selectedYear}
          </span>

          <button
            type="button"
            onClick={() => setSelectedYear((y) => y + 1)}
            className="inline-flex items-center gap-1 text-xs font-semibold text-primary-900 hover:text-primary-950 transition"
          >
            <span>Anno {selectedYear + 1}</span>
            <ChevronRight className="w-4 h-4" />
          </button>
        </div>
      )}

      {/* 2. Metric Tabs Grid */}
      <div className="mt-5 grid grid-cols-2 lg:grid-cols-4 gap-2.5 sm:gap-3">
        {(Object.keys(METRICS_CONFIG) as MetricType[]).map((metricKey) => {
          const itemConfig = METRICS_CONFIG[metricKey];
          const isSelected = selectedMetric === metricKey;
          const Icon = itemConfig.icon;

          return (
            <button
              key={metricKey}
              type="button"
              onClick={() => setSelectedMetric(metricKey)}
              className={`flex items-center justify-between gap-3 p-3 sm:p-3.5 rounded-2xl border transition-all text-left ${
                isSelected
                  ? itemConfig.borderActive
                  : 'bg-white border-primary-100 hover:bg-primary-50/50 hover:border-primary-200 text-gray-700'
              }`}
            >
              <div className="flex items-center gap-2.5 min-w-0">
                <div
                  className={`flex h-8 w-8 items-center justify-center rounded-xl flex-shrink-0 ${
                    isSelected ? 'bg-white/20 text-white' : 'bg-primary-50 text-primary-800'
                  }`}
                >
                  <Icon className="h-4 w-4" />
                </div>
                <div className="min-w-0">
                  <span className="text-xs sm:text-sm font-bold block truncate">
                    {itemConfig.label}
                  </span>
                </div>
              </div>
            </button>
          );
        })}
      </div>

      {/* 3. Executive Summary KPI Cards */}
      <div className="mt-5 grid grid-cols-2 gap-3 sm:grid-cols-4">
        <div className="rounded-2xl border border-primary-100 bg-[#FAF7F8] p-4 shadow-xs">
          <p className="text-xs font-semibold text-primary-800/80 truncate">Totale {periodLabel}</p>
          <p className={`mt-1 text-lg sm:text-2xl font-bold ${config.textAccent}`}>
            {config.formatValue(stats.total)}
          </p>
          <span className="mt-0.5 block text-[10px] text-gray-500 font-medium">{config.unit} complessivi</span>
        </div>

        <div className="rounded-2xl border border-primary-100 bg-[#FAF7F8] p-4 shadow-xs">
          <p className="text-xs font-semibold text-primary-800/80">Picco del Periodo</p>
          <p className="mt-1 text-lg sm:text-2xl font-bold text-primary-950">
            {config.formatValue(stats.max)}
          </p>
          <span className="mt-0.5 block text-[10px] text-gray-500 font-medium truncate">
            {stats.maxLabel || 'N/D'}
          </span>
        </div>

        <div className="rounded-2xl border border-primary-100 bg-[#FAF7F8] p-4 shadow-xs">
          <p className="text-xs font-semibold text-primary-800/80">
            {viewMode === 'annual' ? 'Media al Mese' : 'Media al Giorno'}
          </p>
          <p className="mt-1 text-lg sm:text-2xl font-bold text-primary-950">
            {selectedMetric === 'revenue'
              ? formatCurrency(stats.average)
              : stats.average.toFixed(1)}
          </p>
          <span className="mt-0.5 block text-[10px] text-gray-500 font-medium">
            media su {chartItems.length} {viewMode === 'annual' ? 'mesi' : 'giorni'}
          </span>
        </div>

        <div className="rounded-2xl border border-primary-100 bg-[#FAF7F8] p-4 shadow-xs">
          <p className="text-xs font-semibold text-primary-800/80">
            {viewMode === 'annual' ? 'Mesi con Vendite' : 'Giorni con Attività'}
          </p>
          <p className="mt-1 text-lg sm:text-2xl font-bold text-emerald-800">
            {stats.activeDaysCount} / {chartItems.length}
          </p>
          <span className="mt-0.5 block text-[10px] text-gray-500 font-medium">
            {Math.round((stats.activeDaysCount / (chartItems.length || 1)) * 100)}% di continuità
          </span>
        </div>
      </div>

      {/* 4. Luxury Harmonious Bar Chart Container */}
      <div className="relative mt-6 overflow-x-auto rounded-2xl border border-primary-100 bg-[#FAF7F8] p-4 sm:p-5">
        {/* Floating Interactive Tooltip */}
        {hoveredDay && (
          <div className="absolute top-2 left-1/2 -translate-x-1/2 rounded-2xl border border-primary-200 bg-white px-4 py-2.5 shadow-xl backdrop-blur-md transition-all z-30 pointer-events-none min-w-[220px]">
            <div className="flex items-center justify-between gap-2 border-b border-primary-100 pb-1.5">
              <span className="text-xs font-bold text-primary-950 capitalize">
                {hoveredDay.label}
              </span>
              <span className={`rounded-full px-2 py-0.5 text-[9px] font-bold ${config.bgBadge}`}>
                {config.label}
              </span>
            </div>
            <div className="mt-1.5 grid grid-cols-2 gap-x-3 gap-y-0.5 text-xs">
              <div className="flex items-center justify-between">
                <span className="text-gray-500">Corsiste:</span>
                <span className="font-bold text-primary-950">{hoveredDay.active_users || 0}</span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-gray-500">Fatturato:</span>
                <span className="font-bold text-emerald-800">{formatCurrency(hoveredDay.revenue || 0)}</span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-gray-500">Lezioni:</span>
                <span className="font-bold text-amber-800">{hoveredDay.lessons_completed || 0}</span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-gray-500">Ordini:</span>
                <span className="font-bold text-primary-900">{hoveredDay.orders_count || 0}</span>
              </div>
            </div>
          </div>
        )}

        {/* The Bars Grid */}
        <div
          className={`grid h-52 items-end gap-1.5 sm:gap-2 ${
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
                        ? `${config.textAccent} scale-105`
                        : isHovered
                        ? 'text-primary-950 font-extrabold'
                        : 'text-gray-500'
                    }`}
                  >
                    {rawVal > 0
                      ? selectedMetric === 'revenue'
                        ? `${Math.round(rawVal)}€`
                        : rawVal
                      : ''}
                  </span>
                )}

                {/* Animated Luxury Gradient Bar */}
                <div
                  className={`relative w-full rounded-t-xl bg-gradient-to-t ${
                    isHovered ? config.barHoverGradient : config.barGradient
                  } transition-all duration-300 ${
                    rawVal === 0 ? 'opacity-20 bg-primary-200' : 'shadow-xs group-hover:shadow-md'
                  } ${isHovered ? 'scale-x-105 ring-2 ring-primary-300' : ''}`}
                  style={{ height: `${heightPercent}%` }}
                >
                  {isHighlighted && (
                    <span className="absolute -top-1.5 left-1/2 -translate-x-1/2 flex h-2 w-2">
                      <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-amber-300 opacity-75"></span>
                      <span className="relative inline-flex rounded-full h-2 w-2 bg-amber-400"></span>
                    </span>
                  )}
                </div>

                {/* Bottom Date / Month Label */}
                <div className="mt-2 text-center h-8 flex flex-col justify-start">
                  {item.topLabel && (
                    <span className="block text-[9px] font-semibold text-primary-900/70 capitalize leading-tight">
                      {item.topLabel}
                    </span>
                  )}
                  <span
                    className={`block text-[10px] font-bold leading-tight capitalize ${
                      item.isDimLabel ? 'text-transparent' : 'text-primary-950'
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
      <div className="mt-4 flex flex-col sm:flex-row sm:items-center justify-between gap-2 rounded-2xl bg-[#FAF7F8] border border-primary-100 px-4 py-3 text-xs text-gray-600">
        <div className="flex items-center gap-2">
          <Sparkles className="h-4 w-4 text-primary-700 shrink-0" />
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
        <span className="text-[11px] font-semibold text-primary-800/70 shrink-0">
          Aggiornamento in tempo reale
        </span>
      </div>
    </section>
  );
};
