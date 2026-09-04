import { onCLS, onINP, onLCP, onFCP, onTTFB, type Metric } from 'web-vitals';

export function reportWebVitals(onPerfEntry?: (metric: Metric) => void) {
  const handler = onPerfEntry || ((metric: Metric) => {
    if (import.meta.env.DEV || window.location.search.includes('debug_perf')) {
      const color = metric.rating === 'good' ? 'color: #10b981; font-weight: bold;' : metric.rating === 'needs-improvement' ? 'color: #f59e0b; font-weight: bold;' : 'color: #ef4444; font-weight: bold;';
      console.log(
        `%c⚡ [Web Vital] ${metric.name}: ${Math.round(metric.value)}ms (${metric.rating.toUpperCase()})`,
        color,
        metric
      );
    }
  });

  onCLS(handler);
  onINP(handler);
  onLCP(handler);
  onFCP(handler);
  onTTFB(handler);
}
