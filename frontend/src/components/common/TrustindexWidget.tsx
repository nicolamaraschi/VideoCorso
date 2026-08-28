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

    const script = document.createElement('script');
    script.src = scriptSrc;
    script.defer = true;
    script.async = true;
    currentContainer.appendChild(script);

    return () => {
      // Clean up script on unmount if appropriate
      if (currentContainer && currentContainer.contains(script)) {
        currentContainer.removeChild(script);
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
