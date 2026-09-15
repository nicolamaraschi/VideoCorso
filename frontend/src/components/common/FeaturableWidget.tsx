import React, { useEffect, useRef } from 'react';

interface FeaturableWidgetProps {
  widgetId?: string;
  className?: string;
}

export const FeaturableWidget: React.FC<FeaturableWidgetProps> = ({
  widgetId = 'ad093005-2b9f-4776-9a52-2fce81c19bf9',
  className = '',
}) => {
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const scriptSrc = 'https://cdn.featurable.com/widget/v2/embed.js';
    
    // Check if script already exists
    let script = document.querySelector(`script[src="${scriptSrc}"]`) as HTMLScriptElement | null;

    const initScript = () => {
      // Re-trigger embed if global function exists
      const win = window as unknown as { featurable_embed?: () => void };
      if (typeof win.featurable_embed === 'function') {
        try {
          win.featurable_embed();
        } catch (err) {
          console.error('Featurable embed init error:', err);
        }
      }
    };

    if (!script) {
      script = document.createElement('script');
      script.src = scriptSrc;
      script.defer = true;
      script.async = true;
      script.setAttribute('charset', 'UTF-8');
      script.onload = initScript;
      document.body.appendChild(script);
    } else {
      initScript();
    }
  }, [widgetId]);

  return (
    <div ref={containerRef} className={`featurable-widget-wrapper w-full overflow-hidden ${className}`}>
      <div
        id={`featurable-${widgetId}`}
        data-featurable-async
        className="w-full min-h-[160px]"
      />
    </div>
  );
};

export default FeaturableWidget;
