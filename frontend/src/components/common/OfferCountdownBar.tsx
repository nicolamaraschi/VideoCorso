import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Sparkles, ArrowRight, X } from 'lucide-react';
import { offerBarService, type OfferBarConfig, DEFAULT_OFFER_BAR_CONFIG } from '../../services/offerBarService';

interface OfferCountdownBarProps {
  previewConfig?: OfferBarConfig;
  onCtaClick?: () => void;
  storageKey?: string;
}

export const OfferCountdownBar: React.FC<OfferCountdownBarProps> = ({
  previewConfig,
  onCtaClick,
  storageKey = 'chiara_morocutti_launch_offer_end',
}) => {
  const [config, setConfig] = useState<OfferBarConfig>(
    previewConfig || offerBarService.getLocalConfig()
  );
  const [isDismissed, setIsDismissed] = useState(false);
  const [timeLeft, setTimeLeft] = useState<{ hours: number; minutes: number; seconds: number }>({
    hours: 5,
    minutes: 42,
    seconds: 18,
  });

  // If previewConfig changes in admin editor, update live
  useEffect(() => {
    if (previewConfig) {
      setConfig(previewConfig);
    }
  }, [previewConfig]);

  // Load and subscribe to config changes if not in preview mode
  useEffect(() => {
    if (previewConfig) return;

    // Check if dismissed in this session
    const dismissed = sessionStorage.getItem('cm_offer_bar_dismissed');
    if (dismissed === 'true') {
      setIsDismissed(true);
    }

    // Subscribe to live config updates
    const unsubscribe = offerBarService.onConfigChange((newConfig) => {
      setConfig(newConfig);
    });

    // Fetch remote config from catalog
    void offerBarService.fetchRemoteConfig().then((remoteConfig) => {
      setConfig(remoteConfig);
    });

    return () => unsubscribe();
  }, [previewConfig]);

  // Persistent realistic countdown calculation
  useEffect(() => {
    const hoursSetting = config.timerHours || DEFAULT_OFFER_BAR_CONFIG.timerHours;
    let endTime: number;
    const storedEndTime = localStorage.getItem(storageKey);

    if (storedEndTime) {
      endTime = parseInt(storedEndTime, 10);
      if (isNaN(endTime) || endTime <= Date.now()) {
        endTime = Date.now() + hoursSetting * 3600 * 1000 + 42 * 60 * 1000;
        localStorage.setItem(storageKey, endTime.toString());
      }
    } else {
      endTime = Date.now() + hoursSetting * 3600 * 1000 + 42 * 60 * 1000 + 18 * 1000;
      localStorage.setItem(storageKey, endTime.toString());
    }

    const updateTimer = () => {
      const remainingMs = endTime - Date.now();
      if (remainingMs <= 0) {
        const newEndTime = Date.now() + hoursSetting * 3600 * 1000;
        localStorage.setItem(storageKey, newEndTime.toString());
        setTimeLeft({ hours: hoursSetting, minutes: 0, seconds: 0 });
      } else {
        const totalSec = Math.floor(remainingMs / 1000);
        const hours = Math.floor(totalSec / 3600);
        const minutes = Math.floor((totalSec % 3600) / 60);
        const seconds = totalSec % 60;
        setTimeLeft({ hours, minutes, seconds });
      }
    };

    updateTimer();
    const interval = setInterval(updateTimer, 1000);
    return () => clearInterval(interval);
  }, [storageKey, config.timerHours]);

  const handleClose = () => {
    if (previewConfig) return; // Don't dismiss in preview
    setIsDismissed(true);
    sessionStorage.setItem('cm_offer_bar_dismissed', 'true');
  };

  const handleCta = (e: React.MouseEvent) => {
    if (onCtaClick) {
      e.preventDefault();
      onCtaClick();
      return;
    }

    if (previewConfig) {
      e.preventDefault();
      return;
    }

    if (config.ctaAction === 'checkout') {
      // Direct to checkout
      return;
    }

    if (config.ctaAction === 'custom_url') {
      if (config.ctaCustomUrl) {
        window.open(config.ctaCustomUrl, '_blank', 'noopener,noreferrer');
      }
      e.preventDefault();
      return;
    }

    // Default: scroll to pricing section #corso
    const isHome = window.location.pathname === '/';
    if (isHome) {
      e.preventDefault();
      const element = document.getElementById('corso') || document.getElementById('catalogo');
      if (element) {
        const yOffset = -110;
        const y = element.getBoundingClientRect().top + window.pageYOffset + yOffset;
        window.scrollTo({ top: y, behavior: 'smooth' });
      }
    } else {
      window.location.href = '/#corso';
    }
  };

  const formatDigit = (num: number) => String(num).padStart(2, '0');

  // If not enabled and not in preview mode, don't render!
  if (!previewConfig && (!config.enabled || isDismissed)) {
    return null;
  }

  const getCtaHref = () => {
    if (config.ctaAction === 'checkout') return '/checkout?courseId=mai-fatto-microblading-inizio';
    if (config.ctaAction === 'custom_url') return config.ctaCustomUrl || '#';
    return '/#corso';
  };

  return (
    <AnimatePresence>
      <motion.aside
        aria-label="Promozione Offerta Lancio"
        initial={{ height: 0, opacity: 0 }}
        animate={{ height: 'auto', opacity: 1 }}
        exit={{ height: 0, opacity: 0 }}
        transition={{ duration: 0.3, ease: 'easeOut' }}
        className="relative z-50 w-full bg-[#18090d] border-b border-[#E5C378]/30 text-white shadow-xl overflow-hidden select-none"
      >
        {/* Glow effetto luxury dorato centrale */}
        <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_center,_var(--tw-gradient-stops))] from-[#E5C378]/10 via-transparent to-transparent pointer-events-none" />

        <div className="max-w-7xl mx-auto px-3 sm:px-6 py-2.5 sm:py-3 flex items-center justify-between gap-3 text-xs sm:text-sm">
          
          {/* Sinistra: Badge + Headline + Scarsità */}
          <div className="flex items-center gap-2 sm:gap-3 flex-wrap">
            {config.badgeText && (
              <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full bg-gradient-to-r from-[#E5C378]/20 to-[#E4B5BD]/20 border border-[#E5C378]/50 text-[#E5C378] font-bold text-[10px] sm:text-xs tracking-wider uppercase shadow-[0_0_10px_rgba(229,195,120,0.2)]">
                <Sparkles className="w-3 h-3 text-[#E5C378] animate-pulse" />
                <span>{config.badgeText}</span>
              </span>
            )}

            <p className="font-medium text-gray-200 text-xs sm:text-sm hidden md:inline">
              {config.headline}
            </p>

            {/* Scarsità posti rimasti */}
            {config.showScarcity && config.scarcityText && (
              <span className="hidden lg:inline-flex items-center gap-1.5 text-[#E4B5BD] text-xs font-semibold bg-[#2a1017] px-2 py-0.5 rounded-md border border-[#E4B5BD]/30">
                <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-ping" />
                {config.scarcityText}
              </span>
            )}
          </div>

          {/* Destra: Countdown Timer + Bottone CTA + Close */}
          <div className="flex items-center gap-2.5 sm:gap-4 shrink-0 ml-auto">
            
            {/* Box Conto alla Rovescia */}
            {config.showTimer && (
              <div className="flex items-center gap-1 sm:gap-1.5 font-mono font-bold text-xs sm:text-sm text-[#E5C378]">
                <span className="text-gray-400 text-[10px] sm:text-xs font-sans mr-0.5 hidden xs:inline uppercase tracking-wider">
                  Scade tra:
                </span>

                {/* Ore */}
                <div className="flex flex-col items-center">
                  <span className="bg-[#2a1217] border border-[#E5C378]/30 px-1.5 sm:px-2 py-0.5 rounded text-white shadow-inner min-w-[24px] sm:min-w-[28px] text-center">
                    {formatDigit(timeLeft.hours)}
                  </span>
                  <span className="text-[8px] text-gray-400 font-sans uppercase">h</span>
                </div>
                <span className="text-[#E5C378] -mt-2">:</span>

                {/* Minuti */}
                <div className="flex flex-col items-center">
                  <span className="bg-[#2a1217] border border-[#E5C378]/30 px-1.5 sm:px-2 py-0.5 rounded text-white shadow-inner min-w-[24px] sm:min-w-[28px] text-center">
                    {formatDigit(timeLeft.minutes)}
                  </span>
                  <span className="text-[8px] text-gray-400 font-sans uppercase">m</span>
                </div>
                <span className="text-[#E5C378] -mt-2">:</span>

                {/* Secondi */}
                <div className="flex flex-col items-center">
                  <span className="bg-[#2a1217] border border-[#E5C378]/30 px-1.5 sm:px-2 py-0.5 rounded text-[#E5C378] shadow-inner min-w-[24px] sm:min-w-[28px] text-center animate-pulse">
                    {formatDigit(timeLeft.seconds)}
                  </span>
                  <span className="text-[8px] text-gray-400 font-sans uppercase">s</span>
                </div>
              </div>
            )}

            {/* CTA Button Commerciale Dorato */}
            {config.ctaText && (
              <a
                href={getCtaHref()}
                onClick={handleCta}
                className="group inline-flex items-center gap-1.5 bg-gradient-to-r from-[#E5C378] via-[#edd293] to-[#E5C378] hover:from-[#f0d89c] hover:to-[#dfbb6a] text-[#1a0a0e] font-extrabold px-3 sm:px-4 py-1.5 rounded-full text-xs sm:text-sm tracking-tight shadow-[0_0_15px_rgba(229,195,120,0.3)] hover:shadow-[0_0_20px_rgba(229,195,120,0.6)] hover:scale-105 active:scale-95 transition-all duration-200 cursor-pointer"
              >
                <span>{config.ctaText}</span>
                <ArrowRight className="w-3.5 h-3.5 text-[#1a0a0e] group-hover:translate-x-0.5 transition-transform" />
              </a>
            )}

            {/* Tasto Chiudi X (nascosto solo in preview) */}
            {!previewConfig && (
              <button
                onClick={handleClose}
                className="text-gray-400 hover:text-white p-1 rounded-full hover:bg-white/10 transition-colors cursor-pointer"
                title="Chiudi banner"
                aria-label="Chiudi banner"
              >
                <X className="w-3.5 h-3.5 sm:w-4 sm:h-4" />
              </button>
            )}

          </div>

        </div>
      </motion.aside>
    </AnimatePresence>
  );
};

export default OfferCountdownBar;
