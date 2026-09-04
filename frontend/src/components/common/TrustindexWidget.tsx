import React, { useEffect, useRef } from 'react';

interface TrustindexWidgetProps {
  scriptSrc?: string;
  className?: string;
}

export const TrustindexWidget: React.FC<TrustindexWidgetProps> = ({
  scriptSrc = 'https://cdn.trustindex.io/loader.js?6d4fbfe80b0925814246238f8e4',
  className = '',
}) => {
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const currentContainer = containerRef.current;
    if (!currentContainer) return;

    // Check if script is already present in this container
    const existingScript = currentContainer.querySelector(`script[src="${scriptSrc}"]`);
    if (existingScript) return;

    let scriptAdded = false;
    const observer = new IntersectionObserver((entries) => {
      if (entries[0].isIntersecting && !scriptAdded) {
        scriptAdded = true;
        const script = document.createElement('script');
        script.src = scriptSrc;
        script.defer = true;
        script.async = true;
        currentContainer.appendChild(script);
        observer.disconnect();
      }
    }, { rootMargin: '200px' });

    observer.observe(currentContainer);

    return () => {
      observer.disconnect();
      if (currentContainer && currentContainer.contains(currentContainer.querySelector(`script[src="${scriptSrc}"]`))) {
        const s = currentContainer.querySelector(`script[src="${scriptSrc}"]`);
        if (s) currentContainer.removeChild(s);
      }
    };
  }, [scriptSrc]);

  return (
    <div ref={containerRef} className={`trustindex-widget-container w-full overflow-hidden ${className}`}>
      {/* The Trustindex widget loader will inject the reviews here */}
    </div>
  );
};

export default TrustindexWidget;
