import React, { useCallback, useEffect, useRef, useState } from 'react';
import Hls from 'hls.js';
import { Play, Pause, Volume2, VolumeX, Maximize, Minimize, Settings, Check, Wifi, Sparkles, RefreshCw } from 'lucide-react';

interface LandingVslPlayerProps {
  className?: string;
}

type QualityOption = 'auto' | '1080p' | '720p' | '480p' | '360p' | '240p';
type PlaybackMode = 'hls-js' | 'native-hls' | 'mp4';
type NetworkInformationLike = {
  effectiveType?: string;
  saveData?: boolean;
  addEventListener?: (event: string, listener: () => void) => void;
  removeEventListener?: (event: string, listener: () => void) => void;
};
type NavigatorWithConnection = Navigator & { connection?: NetworkInformationLike };
type WebkitVideoElement = HTMLVideoElement & { webkitEnterFullscreen?: () => void; webkitSupportsFullscreen?: boolean };
type WebkitDocument = Document & { webkitFullscreenElement?: Element | null; webkitExitFullscreen?: () => Promise<void> | void };

const CDN_BASE = 'https://d39fyhcntf368y.cloudfront.net/public/vsl';
const HLS_URL = `${CDN_BASE}/master.m3u8`;
// JPEG is intentionally used for legacy Safari/iOS poster compatibility.
const POSTER_JPG = `${CDN_BASE}/poster.jpg`;
const FALLBACK_MP4S: Record<Exclude<QualityOption, 'auto'>, string> = {
  '1080p': `${CDN_BASE}/vsl_1080p.mp4`,
  '720p': `${CDN_BASE}/vsl_720p.mp4`,
  '480p': `${CDN_BASE}/vsl_480p.mp4`,
  '360p': `${CDN_BASE}/vsl_360p.mp4`,
  '240p': `${CDN_BASE}/vsl_240p.mp4`,
};
const qualityOptions: QualityOption[] = ['auto', '1080p', '720p', '480p', '360p', '240p'];

const isSlowNetwork = () => {
  if (typeof navigator === 'undefined') return false;
  const connection = (navigator as NavigatorWithConnection).connection;
  const effectiveType = connection?.effectiveType || '';
  return effectiveType.includes('2g') || effectiveType === '3g' || Boolean(connection?.saveData);
};

export const LandingVslPlayer: React.FC<LandingVslPlayerProps> = ({ className = '' }) => {
  const containerRef = useRef<HTMLDivElement>(null);
  const videoRef = useRef<HTMLVideoElement>(null);
  const hlsRef = useRef<Hls | null>(null);
  const controlsTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const selectedQualityRef = useRef<QualityOption>('auto');
  const playbackModeRef = useRef<PlaybackMode>('mp4');
  const hasTriedProgressiveFallbackRef = useRef(false);

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
  const [currentQualityLabel, setCurrentQualityLabel] = useState('Auto');
  const [isSlowConnection, setIsSlowConnection] = useState(isSlowNetwork);
  const [hasStarted, setHasStarted] = useState(false);
  const [playbackError, setPlaybackError] = useState<string | null>(null);

  const replaceVideoSource = useCallback((source: string, shouldResume?: boolean) => {
    const video = videoRef.current;
    if (!video) return;
    const resumeAt = video.currentTime;
    const wasPlaying = shouldResume ?? !video.paused;
    video.pause();
    const restorePlayback = () => {
      if (Number.isFinite(resumeAt) && resumeAt > 0) {
        const latestDuration = video.duration;
        video.currentTime = Number.isFinite(latestDuration) && latestDuration > 0
          ? Math.min(resumeAt, Math.max(0, latestDuration - 0.1))
          : resumeAt;
      }
      if (wasPlaying) {
        video.play().catch(() => setPlaybackError('Non è stato possibile riprendere il video. Premi Play per riprovare.'));
      }
    };
    video.addEventListener('loadedmetadata', restorePlayback, { once: true });
    video.src = source;
    video.load();
  }, []);

  // Network Information is not universal; the HLS adaptive bitrate algorithm remains the source of truth.
  useEffect(() => {
    const connection = (navigator as NavigatorWithConnection).connection;
    if (!connection) return;
    const updateConnection = () => setIsSlowConnection(isSlowNetwork());
    updateConnection();
    connection.addEventListener?.('change', updateConnection);
    return () => connection.removeEventListener?.('change', updateConnection);
  }, []);

  // Initialise once. Recreating Hls on quality changes resets playback and breaks manual quality selection.
  useEffect(() => {
    const video = videoRef.current;
    if (!video) return;

    if (Hls.isSupported()) {
      playbackModeRef.current = 'hls-js';
      const hls = new Hls({
        capLevelToPlayerSize: true,
        // Avoid consuming mobile data before the visitor explicitly presses Play.
        autoStartLoad: false,
        // Playlist order: 240p, 360p, 480p, 720p, 1080p.
        startLevel: isSlowNetwork() ? 0 : 1,
        lowLatencyMode: false,
        backBufferLength: 30,
        maxBufferLength: 60,
      });
      const applyQueuedQuality = () => {
        const quality = selectedQualityRef.current;
        if (quality === 'auto') return;
        const index = hls.levels.findIndex((level) => level.width === Number.parseInt(quality, 10));
        if (index !== -1) hls.currentLevel = index;
      };
      const fallBackToMp4 = () => {
        if (hlsRef.current !== hls) return;
        hls.destroy();
        hlsRef.current = null;
        playbackModeRef.current = 'mp4';
        hasTriedProgressiveFallbackRef.current = true;
        selectedQualityRef.current = '720p';
        setSelectedQuality('720p');
        setCurrentQualityLabel('720p');
        replaceVideoSource(FALLBACK_MP4S['720p'], true);
      };
      let hasRetriedMedia = false;

      hlsRef.current = hls;
      hls.loadSource(HLS_URL);
      hls.attachMedia(video);
      hls.on(Hls.Events.MANIFEST_PARSED, applyQueuedQuality);
      hls.on(Hls.Events.LEVEL_SWITCHED, (_event, data) => {
        const level = hls.levels[data.level];
        if (level && selectedQualityRef.current === 'auto') setCurrentQualityLabel(`Auto (${level.width}p)`);
      });
      hls.on(Hls.Events.ERROR, (_event, data) => {
        if (!data.fatal) return;
        if (data.type === Hls.ErrorTypes.NETWORK_ERROR) {
          // On a weak but usable connection, the lowest HLS rendition is safer
          // than replacing it with a much larger progressive MP4 download.
          hls.startLoad();
        } else if (data.type === Hls.ErrorTypes.MEDIA_ERROR && !hasRetriedMedia) {
          hasRetriedMedia = true;
          hls.recoverMediaError();
        } else {
          fallBackToMp4();
        }
      });
      return () => {
        if (hlsRef.current === hls) hlsRef.current = null;
        hls.destroy();
      };
    }

    if (video.canPlayType('application/vnd.apple.mpegurl')) {
      playbackModeRef.current = 'native-hls';
      video.src = HLS_URL;
    } else {
      playbackModeRef.current = 'mp4';
      hasTriedProgressiveFallbackRef.current = true;
      video.src = FALLBACK_MP4S[isSlowNetwork() ? '480p' : '720p'];
    }
    video.load();
  }, [replaceVideoSource]);

  useEffect(() => {
    const documentWithWebkit = document as WebkitDocument;
    const updateFullscreenState = () => setIsFullscreen(Boolean(document.fullscreenElement || documentWithWebkit.webkitFullscreenElement));
    document.addEventListener('fullscreenchange', updateFullscreenState);
    document.addEventListener('webkitfullscreenchange', updateFullscreenState);
    return () => {
      document.removeEventListener('fullscreenchange', updateFullscreenState);
      document.removeEventListener('webkitfullscreenchange', updateFullscreenState);
    };
  }, []);

  useEffect(() => () => {
    if (controlsTimeoutRef.current) clearTimeout(controlsTimeoutRef.current);
  }, []);

  const handleQualityChange = useCallback((quality: QualityOption) => {
    selectedQualityRef.current = quality;
    setSelectedQuality(quality);
    setShowQualityMenu(false);
    setPlaybackError(null);
    const hls = hlsRef.current;
    if (hls) {
      if (quality === 'auto') {
        hls.currentLevel = -1;
        setCurrentQualityLabel('Auto');
        return;
      }
      const index = hls.levels.findIndex((level) => level.width === Number.parseInt(quality, 10));
      if (index !== -1) hls.currentLevel = index;
      // If the manifest is still loading, MANIFEST_PARSED applies this queued selection.
      setCurrentQualityLabel(quality);
      return;
    }

    const video = videoRef.current;
    if (!video) return;
    if (quality === 'auto' && video.canPlayType('application/vnd.apple.mpegurl')) {
      playbackModeRef.current = 'native-hls';
      hasTriedProgressiveFallbackRef.current = false;
      setCurrentQualityLabel('Auto');
      replaceVideoSource(HLS_URL);
      return;
    }
    const progressiveQuality = quality === 'auto' ? '720p' : quality;
    playbackModeRef.current = 'mp4';
    setCurrentQualityLabel(quality === 'auto' ? 'Auto (720p)' : quality);
    replaceVideoSource(FALLBACK_MP4S[progressiveQuality]);
  }, [replaceVideoSource]);

  const togglePlay = useCallback(async () => {
    const video = videoRef.current;
    if (!video) return;
    if (!video.paused) {
      video.pause();
      return;
    }
    setPlaybackError(null);
    hlsRef.current?.startLoad(-1);
    try {
      await video.play();
      setHasStarted(true);
    } catch {
      setIsPlaying(false);
      setPlaybackError('Il browser ha bloccato la riproduzione. Premi Play per riprovare.');
    }
  }, []);

  const handleTimeUpdate = () => {
    const video = videoRef.current;
    if (!video) return;
    setCurrentTime(video.currentTime);
    setDuration(video.duration || 0);
    if (video.buffered.length > 0 && video.duration > 0) {
      for (let i = video.buffered.length - 1; i >= 0; i--) {
        if (video.buffered.start(i) <= video.currentTime) {
          setBufferedPercent(Math.min(100, (video.buffered.end(i) / video.duration) * 100));
          break;
        }
      }
    }
  };

  const progressPercent = duration > 0 ? currentTime / duration : 0;
  const seekToPercent = (percent: number) => {
    const video = videoRef.current;
    if (!video || !duration) return;
    video.currentTime = Math.max(0, Math.min(duration, percent * duration));
    setCurrentTime(video.currentTime);
  };
  const handleSeek = (event: React.MouseEvent<HTMLDivElement>) => {
    const rect = event.currentTarget.getBoundingClientRect();
    seekToPercent((event.clientX - rect.left) / rect.width);
  };
  const handleSeekKeyDown = (event: React.KeyboardEvent<HTMLDivElement>) => {
    if (!duration) return;
    const step = event.shiftKey ? 0.05 : 0.01;
    if (event.key === 'ArrowLeft' || event.key === 'ArrowDown') {
      event.preventDefault();
      seekToPercent(Math.max(0, progressPercent - step));
    } else if (event.key === 'ArrowRight' || event.key === 'ArrowUp') {
      event.preventDefault();
      seekToPercent(Math.min(1, progressPercent + step));
    } else if (event.key === 'Home') {
      event.preventDefault();
      seekToPercent(0);
    } else if (event.key === 'End') {
      event.preventDefault();
      seekToPercent(1);
    }
  };

  const toggleMute = () => {
    const video = videoRef.current;
    if (!video) return;
    video.muted = !video.muted;
    setIsMuted(video.muted);
  };
  const handleVolumeChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    const video = videoRef.current;
    if (!video) return;
    const value = Number.parseFloat(event.target.value);
    video.volume = value;
    video.muted = value === 0;
    setVolume(value);
    setIsMuted(video.muted);
  };

  const toggleFullscreen = () => {
    const container = containerRef.current;
    const video = videoRef.current as WebkitVideoElement | null;
    const documentWithWebkit = document as WebkitDocument;
    if (!container || !video) return;
    if (document.fullscreenElement || documentWithWebkit.webkitFullscreenElement) {
      const exitFullscreen = document.exitFullscreen?.bind(document) || documentWithWebkit.webkitExitFullscreen?.bind(documentWithWebkit);
      exitFullscreen?.();
    } else if (container.requestFullscreen) {
      container.requestFullscreen().catch(() => setPlaybackError('Schermo intero non disponibile su questo dispositivo.'));
    } else if (video.webkitSupportsFullscreen && video.webkitEnterFullscreen) {
      video.webkitEnterFullscreen();
    } else {
      setPlaybackError('Schermo intero non disponibile su questo dispositivo.');
    }
  };

  const handleMouseMove = () => {
    setShowControls(true);
    if (controlsTimeoutRef.current) clearTimeout(controlsTimeoutRef.current);
    if (isPlaying) {
      controlsTimeoutRef.current = setTimeout(() => {
        if (!showQualityMenu) setShowControls(false);
      }, 2500);
    }
  };

  const handleVideoError = () => {
    // Native HLS gets one automatic, broadly compatible progressive MP4 fallback.
    if (playbackModeRef.current === 'native-hls' && !hasTriedProgressiveFallbackRef.current) {
      hasTriedProgressiveFallbackRef.current = true;
      playbackModeRef.current = 'mp4';
      selectedQualityRef.current = '720p';
      setSelectedQuality('720p');
      setCurrentQualityLabel('720p');
      replaceVideoSource(FALLBACK_MP4S['720p'], true);
    } else {
      setPlaybackError('Impossibile caricare il video. Controlla la connessione e riprova.');
    }
  };

  const formatTime = (seconds: number) => {
    if (Number.isNaN(seconds) || seconds < 0) return '0:00';
    const minutes = Math.floor(seconds / 60);
    const remainder = Math.floor(seconds % 60);
    return `${minutes}:${remainder < 10 ? '0' : ''}${remainder}`;
  };

  return (
    <div ref={containerRef} onMouseMove={handleMouseMove} onMouseLeave={() => isPlaying && !showQualityMenu && setShowControls(false)} className={`relative overflow-hidden rounded-3xl shadow-2xl border-2 border-white/20 aspect-[9/16] sm:aspect-[4/5] bg-gradient-to-b from-primary-950/90 to-black select-none group ${className}`}>
      <video
        ref={videoRef}
        className="w-full h-full object-cover cursor-pointer"
        playsInline
        preload="none"
        poster={POSTER_JPG}
        aria-label="Presentazione del corso di Chiara Morocutti"
        onClick={togglePlay}
        onDoubleClick={toggleFullscreen}
        onPlay={() => setIsPlaying(true)}
        onPause={() => setIsPlaying(false)}
        onWaiting={() => setIsBuffering(true)}
        onPlaying={() => setIsBuffering(false)}
        onCanPlay={() => setIsBuffering(false)}
        onTimeUpdate={handleTimeUpdate}
        onLoadedMetadata={() => { if (videoRef.current) setDuration(videoRef.current.duration || 0); setPlaybackError(null); }}
        onError={handleVideoError}
      >Il tuo browser non supporta il formato video.</video>

      {isBuffering && <div className="absolute inset-0 flex items-center justify-center bg-black/30 pointer-events-none z-20 backdrop-blur-xs"><div className="w-12 h-12 rounded-full border-3 border-rose-300/30 border-t-rose-300 animate-spin" /></div>}

      {!isPlaying && !playbackError && (
        <button type="button" onClick={togglePlay} className="absolute inset-0 flex flex-col items-center justify-center bg-black/40 hover:bg-black/30 transition-colors cursor-pointer z-20" aria-label="Riproduci la presentazione di Chiara">
          <div className="relative group/btn transform hover:scale-110 active:scale-95 transition-transform duration-300"><div className="absolute -inset-3 bg-gradient-to-r from-rose-400/40 via-amber-300/40 to-rose-400/40 rounded-full blur-lg animate-pulse" /><div className="relative w-20 h-20 sm:w-24 sm:h-24 rounded-full bg-gradient-to-tr from-[#38101A] via-primary-900 to-rose-900 border-2 border-rose-200/60 shadow-2xl flex items-center justify-center text-white backdrop-blur-md"><Play className="w-9 h-9 sm:w-11 sm:h-11 translate-x-1 fill-white text-white drop-shadow-md" /></div></div>
          {!hasStarted && <div className="mt-5 px-4 py-1.5 rounded-full bg-black/60 border border-white/20 backdrop-blur-md text-xs sm:text-sm font-medium text-rose-100 flex items-center gap-2 shadow-lg animate-fade-in"><Sparkles className="w-3.5 h-3.5 text-amber-300" /><span>Guarda la presentazione di Chiara</span></div>}
        </button>
      )}

      {playbackError && <div className="absolute inset-0 z-40 flex flex-col items-center justify-center gap-4 bg-black/75 px-6 text-center text-white"><p className="max-w-xs text-sm leading-relaxed">{playbackError}</p><button type="button" onClick={togglePlay} className="inline-flex items-center gap-2 rounded-full bg-rose-700 px-4 py-2 text-sm font-semibold hover:bg-rose-600"><RefreshCw className="h-4 w-4" />Riprova</button></div>}

      {isSlowConnection && <div className="absolute top-4 left-4 z-30 px-2.5 py-1 rounded-full bg-black/60 border border-amber-300/40 backdrop-blur-md text-[11px] font-semibold text-amber-200 flex items-center gap-1.5"><Wifi className="w-3 h-3 text-amber-300" /><span>Qualità ottimizzata</span></div>}

      <div className={`absolute inset-x-0 bottom-0 z-30 pt-16 pb-4 px-4 bg-gradient-to-t from-black/95 via-black/60 to-transparent transition-opacity duration-300 ${showControls || !isPlaying ? 'opacity-100 pointer-events-auto' : 'opacity-0 pointer-events-none'}`}>
        <div role="slider" tabIndex={0} aria-label="Avanzamento del video" aria-valuemin={0} aria-valuemax={Math.round(duration)} aria-valuenow={Math.round(currentTime)} aria-valuetext={`${formatTime(currentTime)} di ${formatTime(duration)}`} onClick={handleSeek} onKeyDown={handleSeekKeyDown} className="relative w-full h-2 bg-white/20 hover:h-3 rounded-full cursor-pointer mb-3.5 group/progress transition-all duration-150 focus:outline-none focus:ring-2 focus:ring-rose-300">
          <div className="absolute left-0 top-0 bottom-0 bg-white/30 rounded-full pointer-events-none" style={{ width: `${bufferedPercent}%` }} />
          <div className="absolute left-0 top-0 bottom-0 bg-gradient-to-r from-rose-300 via-amber-200 to-rose-400 rounded-full pointer-events-none shadow-sm" style={{ width: `${progressPercent * 100}%` }} />
          <div className="absolute top-1/2 -translate-y-1/2 w-3.5 h-3.5 bg-white rounded-full shadow-md scale-0 group-hover/progress:scale-100 transition-transform pointer-events-none" style={{ left: `calc(${progressPercent * 100}% - 7px)` }} />
        </div>
        <div className="flex items-center justify-between text-white text-xs">
          <div className="flex items-center gap-3">
            <button type="button" onClick={togglePlay} className="p-1.5 hover:text-rose-300 transition-colors cursor-pointer" aria-label={isPlaying ? 'Pausa' : 'Riproduci'}>{isPlaying ? <Pause className="w-4 h-4 fill-current" /> : <Play className="w-4 h-4 fill-current" />}</button>
            <div className="flex items-center gap-1.5 group/vol"><button type="button" onClick={toggleMute} className="p-1 hover:text-rose-300 transition-colors cursor-pointer" aria-label={isMuted ? 'Riattiva audio' : 'Disattiva audio'}>{isMuted || volume === 0 ? <VolumeX className="w-4 h-4" /> : <Volume2 className="w-4 h-4" />}</button><input type="range" min="0" max="1" step="0.05" value={isMuted ? 0 : volume} onChange={handleVolumeChange} aria-label="Volume" className="w-14 h-1 accent-rose-300 bg-white/20 rounded-lg appearance-none cursor-pointer hidden sm:block opacity-75 hover:opacity-100" /></div>
            <span className="text-[11px] text-gray-300 font-mono tracking-tight">{formatTime(currentTime)} / {formatTime(duration)}</span>
          </div>
          <div className="flex items-center gap-2 relative">
            <div className="relative">
              <button type="button" onClick={() => setShowQualityMenu((show) => !show)} className="px-2.5 py-1 rounded-lg bg-white/10 hover:bg-white/20 border border-white/15 text-[11px] font-medium flex items-center gap-1 transition-colors cursor-pointer" title="Impostazioni qualità" aria-haspopup="menu" aria-expanded={showQualityMenu}><Settings className="w-3.5 h-3.5 text-rose-300" /><span>{currentQualityLabel}</span></button>
              {showQualityMenu && <div role="menu" className="absolute bottom-full right-0 mb-2 w-36 py-1.5 bg-neutral-900/95 backdrop-blur-md border border-white/20 rounded-xl shadow-2xl text-xs z-50 animate-fade-in"><div className="px-3 py-1 text-[10px] uppercase font-bold text-gray-400 border-b border-white/10">Risoluzione</div>{qualityOptions.map((quality) => <button type="button" role="menuitemradio" aria-checked={selectedQuality === quality} key={quality} onClick={() => handleQualityChange(quality)} className={`w-full px-3 py-1.5 text-left flex items-center justify-between hover:bg-white/10 transition-colors cursor-pointer ${selectedQuality === quality ? 'text-rose-300 font-semibold' : 'text-gray-200'}`}><span>{quality === 'auto' ? 'Auto (Adattivo)' : quality === '1080p' ? '1080p (Full HD)' : quality === '720p' ? '720p (HD)' : quality === '480p' ? '480p (Media)' : quality === '360p' ? '360p (Leggera)' : '240p (Risparmio dati)'}</span>{selectedQuality === quality && <Check className="w-3.5 h-3.5 text-rose-300" />}</button>)}</div>}
            </div>
            <button type="button" onClick={toggleFullscreen} className="p-1.5 hover:text-rose-300 transition-colors cursor-pointer" aria-label={isFullscreen ? 'Esci da schermo intero' : 'Schermo intero'}>{isFullscreen ? <Minimize className="w-4 h-4" /> : <Maximize className="w-4 h-4" />}</button>
          </div>
        </div>
      </div>
    </div>
  );
};
