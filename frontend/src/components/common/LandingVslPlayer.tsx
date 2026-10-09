import React, { useEffect, useRef, useState, useCallback } from 'react';
import Hls from 'hls.js';
import {
  Play,
  Pause,
  Volume2,
  VolumeX,
  Maximize,
  Minimize,
  Settings,
  Check,
  Wifi,
  Sparkles,
} from 'lucide-react';

interface LandingVslPlayerProps {
  className?: string;
}

const CDN_BASE = 'https://d39fyhcntf368y.cloudfront.net/public/vsl';
const HLS_URL = `${CDN_BASE}/master.m3u8`;
const POSTER_WEBP = `${CDN_BASE}/poster.webp`;
const POSTER_JPG = `${CDN_BASE}/poster.jpg`;

const FALLBACK_MP4S: Record<string, string> = {
  '1080p': `${CDN_BASE}/vsl_1080p.mp4`,
  '720p': `${CDN_BASE}/vsl_720p.mp4`,
  '480p': `${CDN_BASE}/vsl_480p.mp4`,
  '360p': `${CDN_BASE}/vsl_360p.mp4`,
};

type QualityOption = 'auto' | '1080p' | '720p' | '480p' | '360p';

export const LandingVslPlayer: React.FC<LandingVslPlayerProps> = ({ className = '' }) => {
  const containerRef = useRef<HTMLDivElement>(null);
  const videoRef = useRef<HTMLVideoElement>(null);
  const hlsRef = useRef<Hls | null>(null);
  const controlsTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const [isPlaying, setIsPlaying] = useState(false);
  const [isBuffering, setIsBuffering] = useState(false);
  const [currentTime, setCurrentTime] = useState(0);
  const [duration, setDuration] = useState(0);
  const [bufferedPercent, setBufferedPercent] = useState(0);
  const [volume, setVolume] = useState(1);
  const [isMuted, setIsMuted] = useState(false);
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [showControls, setShowControls] = useState(true);
  const [showQualityMenu, setShowQualityMenu] = useState(false);
  const [selectedQuality, setSelectedQuality] = useState<QualityOption>('auto');
  const [currentQualityLabel, setCurrentQualityLabel] = useState<string>('Auto');
  const [isSlowConnection, setIsSlowConnection] = useState(false);
  const [hasStarted, setHasStarted] = useState(false);

  // Detect network conditions on mount
  useEffect(() => {
    const nav = navigator as unknown as {
      connection?: {
        effectiveType?: string;
        saveData?: boolean;
        addEventListener?: (event: string, cb: () => void) => void;
      };
    };
    if (nav.connection) {
      const checkConnection = () => {
        const eff = nav.connection?.effectiveType || '';
        const isSlow = eff.includes('2g') || eff === '3g' || !!nav.connection?.saveData;
        setIsSlowConnection(isSlow);
      };
      checkConnection();
      nav.connection.addEventListener?.('change', checkConnection);
    }
  }, []);

  // Initialize HLS or fallback
  useEffect(() => {
    const video = videoRef.current;
    if (!video) return;

    if (Hls.isSupported()) {
      const hls = new Hls({
        capLevelToPlayerSize: true, // Auto cap rendition to video container size
        autoStartLoad: true,
        startLevel: isSlowConnection ? 0 : 1, // Start with 360p or 720p for instant 0.1s startup
        lowLatencyMode: false,
        backBufferLength: 30,
        maxBufferLength: 60,
      });

      hlsRef.current = hls;
      hls.loadSource(HLS_URL);
      hls.attachMedia(video);

      hls.on(Hls.Events.MANIFEST_PARSED, () => {
        // Ready
      });

      hls.on(Hls.Events.LEVEL_SWITCHED, (_event, data) => {
        const level = hls.levels[data.level];
        if (level && selectedQuality === 'auto') {
          setCurrentQualityLabel(`Auto (${level.height}p)`);
        }
      });

      hls.on(Hls.Events.ERROR, (_event, data) => {
        if (data.fatal) {
          switch (data.type) {
            case Hls.ErrorTypes.NETWORK_ERROR:
              console.warn('[VSL] Network error, recovering...');
              hls.startLoad();
              break;
            case Hls.ErrorTypes.MEDIA_ERROR:
              console.warn('[VSL] Media error, recovering...');
              hls.recoverMediaError();
              break;
            default:
              console.warn('[VSL] Unrecoverable HLS error, falling back to MP4');
              hls.destroy();
              hlsRef.current = null;
              video.src = FALLBACK_MP4S['720p'];
              break;
          }
        }
      });

      return () => {
        hls.destroy();
        hlsRef.current = null;
      };
    } else if (video.canPlayType('application/vnd.apple.mpegurl')) {
      // Native Apple Safari / iOS HLS support
      video.src = HLS_URL;
    } else {
      // Direct progressive MP4 fallback
      video.src = FALLBACK_MP4S[isSlowConnection ? '480p' : '720p'];
    }
  }, [isSlowConnection, selectedQuality]);

  // Handle Quality Selection
  const handleQualityChange = useCallback((quality: QualityOption) => {
    setSelectedQuality(quality);
    setShowQualityMenu(false);

    const hls = hlsRef.current;
    if (hls && hls.levels && hls.levels.length > 0) {
      if (quality === 'auto') {
        hls.currentLevel = -1; // Auto
        setCurrentQualityLabel('Auto');
      } else {
        const targetHeight = parseInt(quality);
        const index = hls.levels.findIndex((lvl) => lvl.height === targetHeight);
        if (index !== -1) {
          hls.currentLevel = index;
          setCurrentQualityLabel(quality);
        }
      }
    } else {
      // Fallback MP4 mode
      const video = videoRef.current;
      if (video) {
        const curTime = video.currentTime;
        const wasPlaying = !video.paused;
        const targetSrc = quality === 'auto' ? FALLBACK_MP4S['720p'] : FALLBACK_MP4S[quality];
        video.src = targetSrc;
        video.currentTime = curTime;
        if (wasPlaying) {
          video.play().catch(() => {});
        }
        setCurrentQualityLabel(quality === 'auto' ? 'Auto (720p)' : quality);
      }
    }
  }, []);

  // Playback control
  const togglePlay = useCallback(() => {
    const video = videoRef.current;
    if (!video) return;

    if (video.paused) {
      video.play().catch((err) => {
        console.warn('Play error:', err);
      });
      setIsPlaying(true);
      setHasStarted(true);
    } else {
      video.pause();
      setIsPlaying(false);
    }
  }, []);

  // Time & progress
  const handleTimeUpdate = () => {
    const video = videoRef.current;
    if (!video) return;
    setCurrentTime(video.currentTime);
    setDuration(video.duration || 0);

    // Calculate buffer
    if (video.buffered.length > 0 && video.duration > 0) {
      for (let i = video.buffered.length - 1; i >= 0; i--) {
        if (video.buffered.start(i) <= video.currentTime) {
          const end = video.buffered.end(i);
          setBufferedPercent(Math.min(100, (end / video.duration) * 100));
          break;
        }
      }
    }
  };

  const handleSeek = (e: React.MouseEvent<HTMLDivElement>) => {
    const video = videoRef.current;
    if (!video || !duration) return;
    const rect = e.currentTarget.getBoundingClientRect();
    const pos = Math.max(0, Math.min(1, (e.clientX - rect.left) / rect.width));
    video.currentTime = pos * duration;
    setCurrentTime(video.currentTime);
  };

  const toggleMute = () => {
    const video = videoRef.current;
    if (!video) return;
    video.muted = !video.muted;
    setIsMuted(video.muted);
  };

  const handleVolumeChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const video = videoRef.current;
    if (!video) return;
    const val = parseFloat(e.target.value);
    video.volume = val;
    setVolume(val);
    video.muted = val === 0;
    setIsMuted(val === 0);
  };

  const toggleFullscreen = () => {
    const container = containerRef.current;
    if (!container) return;

    if (!document.fullscreenElement) {
      container.requestFullscreen().catch(() => {});
      setIsFullscreen(true);
    } else {
      document.exitFullscreen().catch(() => {});
      setIsFullscreen(false);
    }
  };

  // Activity timer for controls
  const handleMouseMove = () => {
    setShowControls(true);
    if (controlsTimeoutRef.current) {
      clearTimeout(controlsTimeoutRef.current);
    }
    if (isPlaying) {
      controlsTimeoutRef.current = setTimeout(() => {
        if (!showQualityMenu) {
          setShowControls(false);
        }
      }, 2500);
    }
  };

  const formatTime = (secs: number) => {
    if (isNaN(secs) || secs < 0) return '0:00';
    const m = Math.floor(secs / 60);
    const s = Math.floor(secs % 60);
    return `${m}:${s < 10 ? '0' : ''}${s}`;
  };

  const progressPercent = duration > 0 ? (currentTime / duration) * 100 : 0;

  return (
    <div
      ref={containerRef}
      onMouseMove={handleMouseMove}
      onMouseLeave={() => isPlaying && !showQualityMenu && setShowControls(false)}
      className={`relative overflow-hidden rounded-3xl shadow-2xl border-2 border-white/20 aspect-[9/16] sm:aspect-[4/5] bg-gradient-to-b from-primary-950/90 to-black select-none group ${className}`}
    >
      {/* Video Element */}
      <video
        ref={videoRef}
        className="w-full h-full object-cover cursor-pointer"
        playsInline
        preload="metadata"
        poster={POSTER_WEBP}
        onClick={togglePlay}
        onDoubleClick={toggleFullscreen}
        onPlay={() => setIsPlaying(true)}
        onPause={() => setIsPlaying(false)}
        onWaiting={() => setIsBuffering(true)}
        onPlaying={() => setIsBuffering(false)}
        onCanPlay={() => setIsBuffering(false)}
        onTimeUpdate={handleTimeUpdate}
        onLoadedMetadata={() => {
          if (videoRef.current) setDuration(videoRef.current.duration || 0);
        }}
      >
        <source src={HLS_URL} type="application/x-mpegURL" />
        <source src={FALLBACK_MP4S['720p']} type="video/mp4" />
        Il tuo browser non supporta il formato video.
      </video>

      {/* Buffering Spinner */}
      {isBuffering && (
        <div className="absolute inset-0 flex items-center justify-center bg-black/30 pointer-events-none z-20 backdrop-blur-xs">
          <div className="w-12 h-12 rounded-full border-3 border-rose-300/30 border-t-rose-300 animate-spin" />
        </div>
      )}

      {/* Big Play Button Overlay on Initial / Paused state */}
      {!isPlaying && (
        <div
          onClick={togglePlay}
          className="absolute inset-0 flex flex-col items-center justify-center bg-black/40 hover:bg-black/30 transition-colors cursor-pointer z-20"
        >
          <div className="relative group/btn transform hover:scale-110 active:scale-95 transition-transform duration-300">
            <div className="absolute -inset-3 bg-gradient-to-r from-rose-400/40 via-amber-300/40 to-rose-400/40 rounded-full blur-lg animate-pulse" />
            <div className="relative w-20 h-20 sm:w-24 sm:h-24 rounded-full bg-gradient-to-tr from-[#38101A] via-primary-900 to-rose-900 border-2 border-rose-200/60 shadow-2xl flex items-center justify-center text-white backdrop-blur-md">
              <Play className="w-9 h-9 sm:w-11 sm:h-11 translate-x-1 fill-white text-white drop-shadow-md" />
            </div>
          </div>
          
          {!hasStarted && (
            <div className="mt-5 px-4 py-1.5 rounded-full bg-black/60 border border-white/20 backdrop-blur-md text-xs sm:text-sm font-medium text-rose-100 flex items-center gap-2 shadow-lg animate-fade-in">
              <Sparkles className="w-3.5 h-3.5 text-amber-300" />
              <span>Guarda la presentazione di Chiara</span>
            </div>
          )}
        </div>
      )}

      {/* Connection Indicator Badge (if slow connection) */}
      {isSlowConnection && (
        <div className="absolute top-4 left-4 z-30 px-2.5 py-1 rounded-full bg-black/60 border border-amber-300/40 backdrop-blur-md text-[11px] font-semibold text-amber-200 flex items-center gap-1.5">
          <Wifi className="w-3 h-3 text-amber-300" />
          <span>Qualità ottimizzata</span>
        </div>
      )}

      {/* Bottom Control Bar */}
      <div
        className={`absolute inset-x-0 bottom-0 z-30 pt-16 pb-4 px-4 bg-gradient-to-t from-black/95 via-black/60 to-transparent transition-opacity duration-300 ${
          showControls || !isPlaying ? 'opacity-100 pointer-events-auto' : 'opacity-0 pointer-events-none'
        }`}
      >
        {/* Interactive Progress Bar */}
        <div
          onClick={handleSeek}
          className="relative w-full h-2 bg-white/20 hover:h-3 rounded-full cursor-pointer mb-3.5 group/progress transition-all duration-150"
        >
          {/* Buffered track */}
          <div
            className="absolute left-0 top-0 bottom-0 bg-white/30 rounded-full pointer-events-none"
            style={{ width: `${bufferedPercent}%` }}
          />
          {/* Played track */}
          <div
            className="absolute left-0 top-0 bottom-0 bg-gradient-to-r from-rose-300 via-amber-200 to-rose-400 rounded-full pointer-events-none shadow-sm"
            style={{ width: `${progressPercent}%` }}
          />
          {/* Scrub Thumb */}
          <div
            className="absolute top-1/2 -translate-y-1/2 w-3.5 h-3.5 bg-white rounded-full shadow-md scale-0 group-hover/progress:scale-100 transition-transform pointer-events-none"
            style={{ left: `calc(${progressPercent}% - 7px)` }}
          />
        </div>

        {/* Buttons Row */}
        <div className="flex items-center justify-between text-white text-xs">
          {/* Left: Play/Pause, Volume, Time */}
          <div className="flex items-center gap-3">
            <button
              onClick={togglePlay}
              className="p-1.5 hover:text-rose-300 transition-colors cursor-pointer"
              aria-label={isPlaying ? 'Pausa' : 'Riproduci'}
            >
              {isPlaying ? <Pause className="w-4 h-4 fill-current" /> : <Play className="w-4 h-4 fill-current" />}
            </button>

            {/* Volume */}
            <div className="flex items-center gap-1.5 group/vol">
              <button
                onClick={toggleMute}
                className="p-1 hover:text-rose-300 transition-colors cursor-pointer"
                aria-label={isMuted ? 'Riattiva audio' : 'Disattiva audio'}
              >
                {isMuted || volume === 0 ? <VolumeX className="w-4 h-4" /> : <Volume2 className="w-4 h-4" />}
              </button>
              <input
                type="range"
                min="0"
                max="1"
                step="0.05"
                value={isMuted ? 0 : volume}
                onChange={handleVolumeChange}
                className="w-14 h-1 accent-rose-300 bg-white/20 rounded-lg appearance-none cursor-pointer hidden sm:block opacity-75 hover:opacity-100"
              />
            </div>

            {/* Time */}
            <span className="text-[11px] text-gray-300 font-mono tracking-tight">
              {formatTime(currentTime)} / {formatTime(duration)}
            </span>
          </div>

          {/* Right: Quality Menu, Fullscreen */}
          <div className="flex items-center gap-2 relative">
            {/* Quality Button */}
            <div className="relative">
              <button
                onClick={() => setShowQualityMenu(!showQualityMenu)}
                className="px-2.5 py-1 rounded-lg bg-white/10 hover:bg-white/20 border border-white/15 text-[11px] font-medium flex items-center gap-1 transition-colors cursor-pointer"
                title="Impostazioni qualità"
              >
                <Settings className="w-3.5 h-3.5 text-rose-300" />
                <span>{currentQualityLabel}</span>
              </button>

              {/* Quality Dropdown Popover */}
              {showQualityMenu && (
                <div className="absolute bottom-full right-0 mb-2 w-36 py-1.5 bg-neutral-900/95 backdrop-blur-md border border-white/20 rounded-xl shadow-2xl text-xs z-50 animate-fade-in">
                  <div className="px-3 py-1 text-[10px] uppercase font-bold text-gray-400 border-b border-white/10">
                    Risoluzione
                  </div>
                  {(['auto', '1080p', '720p', '480p', '360p'] as QualityOption[]).map((q) => (
                    <button
                      key={q}
                      onClick={() => handleQualityChange(q)}
                      className={`w-full px-3 py-1.5 text-left flex items-center justify-between hover:bg-white/10 transition-colors cursor-pointer ${
                        selectedQuality === q ? 'text-rose-300 font-semibold' : 'text-gray-200'
                      }`}
                    >
                      <span>
                        {q === 'auto'
                          ? 'Auto (Adattivo)'
                          : q === '1080p'
                          ? '1080p (Full HD)'
                          : q === '720p'
                          ? '720p (HD)'
                          : q === '480p'
                          ? '480p (Media)'
                          : '360p (Leggera)'}
                      </span>
                      {selectedQuality === q && <Check className="w-3.5 h-3.5 text-rose-300" />}
                    </button>
                  ))}
                </div>
              )}
            </div>

            {/* Fullscreen */}
            <button
              onClick={toggleFullscreen}
              className="p-1.5 hover:text-rose-300 transition-colors cursor-pointer"
              aria-label={isFullscreen ? 'Esci da schermo intero' : 'Schermo intero'}
            >
              {isFullscreen ? <Minimize className="w-4 h-4" /> : <Maximize className="w-4 h-4" />}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
