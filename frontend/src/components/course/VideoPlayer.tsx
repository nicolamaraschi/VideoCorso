import React, { useRef, useState, useEffect, useCallback } from 'react';
import ReactPlayer from 'react-player';
import {
  Play,
  Pause,
  Volume2,
  VolumeX,
  Maximize,
  Settings,
  SkipBack,
  SkipForward,
  RotateCcw,
  X,
  Sparkles,
} from 'lucide-react';
import { formatDuration } from '../../utils/formatters';
import { useVideoProgress } from '../../hooks/useVideoProgress';
import type { VideoQuality } from '../../types';

const QUALITY_LABELS: Record<string, string> = {
  '1080p': 'Full HD (1080p)',
  '720p': 'Alta (720p)',
  '480p': 'Media (480p)',
  '360p': 'Bassa (360p)',
  high: 'Alta (720p)',
  medium: 'Media (480p)',
  low: 'Bassa (360p)',
};

interface VideoPlayerProps {
  videoUrl: string;
  lessonId: string;
  onEnded?: () => void;
  availableQualities?: string[];
  quality?: VideoQuality;
  onQualityChange?: (quality: VideoQuality) => void;
  trackProgress?: boolean;
}

const getIPhoneVideoRotation = async (videoUrl: string, signal: AbortSignal): Promise<0 | 90 | 180 | 270> => {
  const readRotation = (bytes: Uint8Array): 0 | 90 | 180 | 270 => {
    const view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);

    for (let index = 4; index < bytes.length - 56; index += 1) {
      if (String.fromCharCode(...bytes.slice(index, index + 4)) !== 'tkhd') continue;

      const boxStart = index - 4;
      const version = bytes[index + 4];
      const matrixStart = boxStart + (version === 1 ? 60 : 48);
      if (matrixStart + 16 > bytes.length) continue;

      const a = view.getInt32(matrixStart);
      const b = view.getInt32(matrixStart + 4);
      const c = view.getInt32(matrixStart + 8);
      const d = view.getInt32(matrixStart + 12);

      if (a === 0 && b > 0 && c < 0 && d === 0) return 90;
      if (a === 0 && b < 0 && c > 0 && d === 0) return 270;
      if (a < 0 && b === 0 && c === 0 && d < 0) return 180;
    }

    return 0;
  };

  for (const range of ['bytes=0-2097151', 'bytes=-2097152']) {
    const response = await fetch(videoUrl, { headers: { Range: range }, signal });
    const rotation = readRotation(new Uint8Array(await response.arrayBuffer()));
    if (rotation !== 0) return rotation;
  }

  return 0;
};

export const VideoPlayer: React.FC<VideoPlayerProps> = ({
  videoUrl,
  lessonId,
  onEnded,
  availableQualities = [],
  quality,
  onQualityChange,
  trackProgress = true,
}) => {
  const playerRef = useRef<HTMLVideoElement>(null);
  const ambientVideoRef = useRef<HTMLVideoElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const progressBarRef = useRef<HTMLDivElement>(null);
  const hideControlsTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // State
  const [isPlaying, setIsPlaying] = useState(false);
  const [volume, setVolume] = useState(1);
  const [isMuted, setIsMuted] = useState(false);
  const [playbackRate, setPlaybackRate] = useState(1);
  const [currentTime, setCurrentTime] = useState(0);
  const [duration, setDuration] = useState(0);
  const [isBuffering, setIsBuffering] = useState(false);
  const [showControls, setShowControls] = useState(true);
  const [showSettings, setShowSettings] = useState(false);
  const [isScrubbing, setIsScrubbing] = useState(false);
  const [hoverPosition, setHoverPosition] = useState<number | null>(null);
  const [hoverTime, setHoverTime] = useState<number>(0);
  const [aspectRatio, setAspectRatio] = useState<number>(16 / 9);
  const [rotation, setRotation] = useState<0 | 90 | 180 | 270>(0);
  const [videoPlaybackError, setVideoPlaybackError] = useState<string | null>(null);

  const qualitySwitchStateRef = useRef<{ time: number; wasPlaying: boolean } | null>(null);

  const { handleTimeUpdate: trackTimeUpdate, markComplete } = useVideoProgress({
    lessonId,
    enabled: trackProgress,
  });

  const handleTimeUpdate = useCallback(
    (time: number, dur: number) => {
      if (trackProgress && dur > 0) {
        trackTimeUpdate(time, dur);
      }
      // Sync ambient video if it drifts by > 0.4s
      const ambient = ambientVideoRef.current;
      if (ambient && Math.abs(ambient.currentTime - time) > 0.4) {
        ambient.currentTime = time;
      }
    },
    [trackProgress, trackTimeUpdate]
  );

  // Sync ambient video playback with main player
  useEffect(() => {
    const ambient = ambientVideoRef.current;
    if (!ambient) return;
    if (isPlaying) {
      ambient.play().catch(() => {});
    } else {
      ambient.pause();
    }
  }, [isPlaying]);

  const handleQualitySelect = (newQuality: VideoQuality) => {
    if (newQuality === quality) {
      setShowSettings(false);
      return;
    }
    const currentVideoTime = playerRef.current?.currentTime ?? currentTime;
    qualitySwitchStateRef.current = {
      time: currentVideoTime,
      wasPlaying: isPlaying,
    };
    setShowSettings(false);
    onQualityChange?.(newQuality);
  };

  const togglePlay = () => {
    setIsPlaying(!isPlaying);
  };

  const toggleMute = () => {
    setIsMuted(!isMuted);
  };

  const changeVolume = (delta: number) => {
    const newVolume = Math.max(0, Math.min(1, volume + delta));
    setVolume(newVolume);
    if (newVolume > 0 && isMuted) {
      setIsMuted(false);
    }
  };

  const skip = (seconds: number) => {
    if (playerRef.current) {
      const newTime = Math.max(0, Math.min(duration, playerRef.current.currentTime + seconds));
      playerRef.current.currentTime = newTime;
      setCurrentTime(newTime);
    }
  };

  const changePlaybackRate = (rate: number) => {
    setPlaybackRate(rate);
    setShowSettings(false);
    if (ambientVideoRef.current) {
      ambientVideoRef.current.playbackRate = rate;
    }
  };

  const toggleFullscreen = useCallback(() => {
    if (document.fullscreenElement) {
      document.exitFullscreen().catch(() => {});
      return;
    }

    const container = containerRef.current;
    const videoEl = (container?.querySelector('video') || playerRef.current) as (HTMLVideoElement & {
      webkitEnterFullscreen?: () => void;
      webkitExitFullscreen?: () => void;
      webkitDisplayingFullscreen?: boolean;
    }) | null;

    const isIOS = typeof navigator !== 'undefined' && /iPhone|iPod|iPad/i.test(navigator.userAgent);
    if (isIOS && videoEl && typeof videoEl.webkitEnterFullscreen === 'function') {
      try {
        videoEl.webkitEnterFullscreen();
        return;
      } catch (err) {
        console.warn('webkitEnterFullscreen failed:', err);
      }
    }

    if (container && typeof container.requestFullscreen === 'function') {
      container.requestFullscreen().catch(() => {
        if (videoEl) {
          if (typeof videoEl.webkitEnterFullscreen === 'function') {
            videoEl.webkitEnterFullscreen();
          } else if (typeof videoEl.requestFullscreen === 'function') {
            videoEl.requestFullscreen().catch(() => {});
          }
        }
      });
      return;
    }

    if (videoEl && typeof videoEl.webkitEnterFullscreen === 'function') {
      videoEl.webkitEnterFullscreen();
    }
  }, []);

  const revealControls = useCallback(() => {
    setShowControls(true);
  }, []);

  // Keyboard shortcuts
  useEffect(() => {
    const handleKeyPress = (e: KeyboardEvent) => {
      if (!playerRef.current) return;
      const activeTag = document.activeElement?.tagName.toLowerCase();
      if (activeTag === 'input' || activeTag === 'textarea') return;

      switch (e.key) {
        case ' ':
        case 'k':
          e.preventDefault();
          togglePlay();
          break;
        case 'm':
          e.preventDefault();
          toggleMute();
          break;
        case 'f':
          e.preventDefault();
          toggleFullscreen();
          break;
        case 'ArrowLeft':
          if (!e.shiftKey && !e.altKey && !e.metaKey) {
            e.preventDefault();
            skip(-10);
          }
          break;
        case 'ArrowRight':
          if (!e.shiftKey && !e.altKey && !e.metaKey) {
            e.preventDefault();
            skip(10);
          }
          break;
        case 'ArrowUp':
          e.preventDefault();
          changeVolume(0.1);
          break;
        case 'ArrowDown':
          e.preventDefault();
          changeVolume(-0.1);
          break;
      }
    };

    window.addEventListener('keydown', handleKeyPress);
    return () => window.removeEventListener('keydown', handleKeyPress);
  }, [isPlaying, volume, isMuted, toggleFullscreen]);

  // Mouse / Touch Activity
  useEffect(() => {
    const handleMouseMove = () => {
      setShowControls(true);
      if (hideControlsTimerRef.current) {
        clearTimeout(hideControlsTimerRef.current);
      }
      if (isPlaying && !showSettings) {
        hideControlsTimerRef.current = setTimeout(() => {
          setShowControls(false);
        }, 3000);
      }
    };

    const container = containerRef.current;
    if (container) {
      container.addEventListener('mousemove', handleMouseMove);
      container.addEventListener('touchstart', handleMouseMove);
    }

    return () => {
      if (container) {
        container.removeEventListener('mousemove', handleMouseMove);
        container.removeEventListener('touchstart', handleMouseMove);
      }
      if (hideControlsTimerRef.current) {
        clearTimeout(hideControlsTimerRef.current);
      }
    };
  }, [isPlaying, showSettings]);

  // Timeline scrub math
  const calculateTimeFromEvent = (clientX: number): number => {
    if (!progressBarRef.current || duration <= 0) return 0;
    const rect = progressBarRef.current.getBoundingClientRect();
    const pos = Math.max(0, Math.min(1, (clientX - rect.left) / rect.width));
    return pos * duration;
  };

  const seekToTime = (targetTime: number) => {
    const clampedTime = Math.max(0, Math.min(duration, targetTime));
    if (playerRef.current) {
      playerRef.current.currentTime = clampedTime;
    }
    if (ambientVideoRef.current) {
      ambientVideoRef.current.currentTime = clampedTime;
    }
    setCurrentTime(clampedTime);
  };

  const handleProgressBarMouseDown = (e: React.MouseEvent<HTMLDivElement>) => {
    setIsScrubbing(true);
    seekToTime(calculateTimeFromEvent(e.clientX));
  };

  const handleProgressBarMouseMove = (e: React.MouseEvent<HTMLDivElement>) => {
    if (!progressBarRef.current || duration <= 0) return;
    const rect = progressBarRef.current.getBoundingClientRect();
    const pos = Math.max(0, Math.min(1, (e.clientX - rect.left) / rect.width));
    setHoverPosition(pos * 100);
    setHoverTime(pos * duration);

    if (isScrubbing) {
      seekToTime(pos * duration);
    }
  };

  const handleProgressBarMouseLeave = () => {
    if (!isScrubbing) {
      setHoverPosition(null);
    }
  };

  useEffect(() => {
    const handleGlobalMouseUp = () => {
      if (isScrubbing) {
        setIsScrubbing(false);
        setHoverPosition(null);
      }
    };

    const handleGlobalMouseMove = (e: MouseEvent) => {
      if (isScrubbing) {
        seekToTime(calculateTimeFromEvent(e.clientX));
      }
    };

    window.addEventListener('mouseup', handleGlobalMouseUp);
    window.addEventListener('mousemove', handleGlobalMouseMove);

    return () => {
      window.removeEventListener('mouseup', handleGlobalMouseUp);
      window.removeEventListener('mousemove', handleGlobalMouseMove);
    };
  }, [isScrubbing, duration]);

  const displayAspectRatio = rotation === 90 || rotation === 270 ? 1 / aspectRatio : aspectRatio;
  const isPortrait = displayAspectRatio < 1;
  const progressPercentage = duration > 0 ? (currentTime / duration) * 100 : 0;

  useEffect(() => {
    setAspectRatio(16 / 9);
    setRotation(0);
    setVideoPlaybackError(null);

    const isMobile = typeof navigator !== 'undefined' && /iPhone|iPad|iPod|Android/i.test(navigator.userAgent);
    if (isMobile) return;

    const controller = new AbortController();
    void getIPhoneVideoRotation(videoUrl, controller.signal)
      .then(setRotation)
      .catch(() => {});

    return () => controller.abort();
  }, [videoUrl]);

  const handleLoadedMetadata = useCallback((event: React.SyntheticEvent<HTMLVideoElement>) => {
    const videoEl = event.currentTarget;
    if (videoEl.videoWidth > 0 && videoEl.videoHeight > 0) {
      setAspectRatio(videoEl.videoWidth / videoEl.videoHeight);
    }
    setIsBuffering(false);
    setVideoPlaybackError(null);

    const pending = qualitySwitchStateRef.current;
    if (pending) {
      qualitySwitchStateRef.current = null;
      videoEl.currentTime = pending.time;
      setIsPlaying(pending.wasPlaying);
    }
  }, []);

  return (
    <div
      ref={containerRef}
      className={`relative rounded-2xl sm:rounded-3xl overflow-hidden group video-player mx-auto w-full max-h-[82vh] flex items-center justify-center select-none shadow-2xl ${
        isPortrait ? 'aspect-[9/16] sm:aspect-[16/10] sm:max-w-4xl' : 'w-full'
      }`}
      style={{
        aspectRatio: isPortrait ? undefined : String(displayAspectRatio),
        background: 'radial-gradient(circle at 50% 50%, #2b1118 0%, #150609 60%, #0c0204 100%)',
      }}
      onTouchStart={revealControls}
    >
      {/* ========================================================================= */}
      {/* LUXURY AMBIENT GLOW BACKDROP (Transforms black bars into cinema aura) */}
      {/* ========================================================================= */}
      <div className="absolute inset-0 overflow-hidden pointer-events-none select-none z-0">
        
        {/* Dynamic Video Blur Aura */}
        <div className="absolute inset-0 opacity-70 scale-125 blur-3xl filter saturate-150 brightness-50 transform pointer-events-none transition-opacity duration-700">
          <video
            ref={ambientVideoRef}
            src={videoUrl}
            muted
            playsInline
            className="w-full h-full object-cover"
            aria-hidden="true"
          />
        </div>

        {/* Velvet Vignette Overlay with Radial Depth */}
        <div
          className="absolute inset-0"
          style={{
            background:
              'radial-gradient(ellipse at center, transparent 30%, rgba(18, 5, 8, 0.65) 75%, rgba(12, 2, 4, 0.95) 100%)',
          }}
        />

        {/* Elegant Lateral Watermarks (Visible on Tablet/Desktop for Portrait Videos) */}
        {isPortrait && (
          <div className="absolute inset-0 hidden sm:flex items-center justify-between px-10 md:px-16 pointer-events-none select-none">
            <div className="flex flex-col items-center opacity-15">
              <Sparkles className="w-6 h-6 text-amber-200 mb-1" />
              <span
                className="text-3xl md:text-5xl font-serif text-amber-100 font-bold tracking-widest"
                style={{ fontFamily: 'Abhaya Libre, serif' }}
              >
                CM
              </span>
              <span className="text-[9px] uppercase tracking-widest text-amber-200 font-semibold mt-1">
                Academy
              </span>
            </div>

            <div className="flex flex-col items-center opacity-15">
              <Sparkles className="w-6 h-6 text-amber-200 mb-1" />
              <span
                className="text-3xl md:text-5xl font-serif text-amber-100 font-bold tracking-widest"
                style={{ fontFamily: 'Abhaya Libre, serif' }}
              >
                CM
              </span>
              <span className="text-[9px] uppercase tracking-widest text-amber-200 font-semibold mt-1">
                Academy
              </span>
            </div>
          </div>
        )}
      </div>

      {/* ========================================================================= */}
      {/* FOREGROUND MAIN VIDEO: Crisp, Centered & Elevated */}
      {/* ========================================================================= */}
      <div
        className={`relative z-10 pointer-events-none flex items-center justify-center ${
          isPortrait
            ? 'h-full max-h-[82vh] aspect-[9/16] rounded-xl sm:rounded-2xl overflow-hidden shadow-2xl ring-1 ring-white/15'
            : 'w-full h-full'
        }`}
      >
        <ReactPlayer
          ref={playerRef}
          src={videoUrl}
          width="100%"
          height="100%"
          playing={isPlaying}
          volume={volume}
          muted={isMuted}
          playbackRate={playbackRate}
          preload="metadata"
          playsInline={true}
          onWaiting={() => setIsBuffering(true)}
          onPlaying={() => {
            setIsBuffering(false);
            setVideoPlaybackError(null);
          }}
          onCanPlay={() => setIsBuffering(false)}
          onError={() => {
            setIsBuffering(false);
            setVideoPlaybackError('Connessione lenta o errore di caricamento. Tocca per riprovare.');
          }}
          onTimeUpdate={(event) => {
            const playedSeconds = event.currentTarget.currentTime;
            if (!isScrubbing) {
              setCurrentTime(playedSeconds);
            }
            handleTimeUpdate(playedSeconds, duration);
          }}
          onDurationChange={(event) => setDuration(event.currentTarget.duration)}
          onLoadedMetadata={handleLoadedMetadata}
          onEnded={() => {
            setIsPlaying(false);
            if (trackProgress) markComplete(currentTime, duration);
            if (onEnded) onEnded();
          }}
          style={
            rotation === 0
              ? {
                  position: 'absolute',
                  top: 0,
                  left: 0,
                }
              : {
                  position: 'absolute',
                  top: '50%',
                  left: '50%',
                  width: `${aspectRatio * 100}%`,
                  height: `${100 / aspectRatio}%`,
                  transform: `translate(-50%, -50%) rotate(${rotation}deg)`,
                }
          }
          config={{
            youtube: {
              rel: 0,
              iv_load_policy: 3,
            },
          }}
        />
      </div>

      {/* Playback Error Overlay */}
      {videoPlaybackError && (
        <div className="absolute inset-0 flex flex-col items-center justify-center p-4 bg-black/85 text-white z-30 text-center">
          <p className="text-sm font-medium mb-3 text-red-200">{videoPlaybackError}</p>
          <button
            type="button"
            onClick={() => {
              setVideoPlaybackError(null);
              setIsBuffering(true);
              if (playerRef.current) {
                playerRef.current.load();
                togglePlay();
              }
            }}
            className="px-4 py-2 rounded-xl bg-primary-700 hover:bg-primary-800 text-white font-semibold text-xs transition"
          >
            Ricarica Video
          </button>
        </div>
      )}

      {/* Buffering Indicator */}
      {isBuffering && isPlaying && (
        <div className="absolute inset-0 flex items-center justify-center pointer-events-none z-20">
          <div className="w-14 h-14 border-4 border-white/20 border-t-primary-500 rounded-full animate-spin backdrop-blur-xs" />
        </div>
      )}

      {/* Controls Overlay */}
      <div
        className="absolute inset-0 z-20"
        onClick={(e) => {
          if (e.target === e.currentTarget) {
            togglePlay();
          }
        }}
      >
        {/* Center Play/Pause Splash on Pause */}
        {!isPlaying && !isBuffering && (
          <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
            <div className="p-4 sm:p-5 rounded-full bg-primary-950/75 border border-primary-500/30 text-white backdrop-blur-md shadow-2xl transform transition hover:scale-110">
              <Play className="w-8 h-8 sm:w-10 sm:h-10 fill-current translate-x-0.5" />
            </div>
          </div>
        )}

        {/* Bottom / Floating Controls Bar */}
        <div
          className={`absolute inset-0 bg-gradient-to-t from-black/90 via-black/25 to-transparent transition-opacity duration-300 pointer-events-none flex flex-col justify-end ${
            showControls ? 'opacity-100' : 'opacity-0'
          }`}
        >
          <div className="space-y-1.5 p-3 sm:p-5 pointer-events-auto max-w-4xl mx-auto w-full">
            {/* Smooth Scrubbable Progress Bar */}
            <div
              ref={progressBarRef}
              onMouseDown={handleProgressBarMouseDown}
              onMouseMove={handleProgressBarMouseMove}
              onMouseLeave={handleProgressBarMouseLeave}
              onTouchStart={(e) => {
                e.stopPropagation();
                setIsScrubbing(true);
                const touch = e.touches[0];
                if (touch) seekToTime(calculateTimeFromEvent(touch.clientX));
              }}
              onTouchMove={(e) => {
                e.stopPropagation();
                const touch = e.touches[0];
                if (touch && isScrubbing) seekToTime(calculateTimeFromEvent(touch.clientX));
              }}
              data-no-swipe="true"
              className="relative w-full py-2 cursor-pointer group/progress select-none"
            >
              {/* Background Track */}
              <div className="w-full h-1.5 group-hover/progress:h-2 bg-white/25 rounded-full overflow-hidden transition-all duration-150 relative">
                {/* Progress Fill */}
                <div
                  className="h-full bg-gradient-to-r from-primary-600 to-primary-400 rounded-full transition-all duration-75"
                  style={{ width: `${progressPercentage}%` }}
                />
              </div>

              {/* Scrub Handle (Thumb) */}
              <div
                className={`absolute top-1/2 -translate-y-1/2 -translate-x-1/2 w-3.5 h-3.5 bg-white rounded-full shadow-lg transition-transform duration-100 pointer-events-none border border-primary-500 ${
                  isScrubbing ? 'scale-125' : 'scale-0 group-hover/progress:scale-100'
                }`}
                style={{ left: `${progressPercentage}%` }}
              />

              {/* Hover Time Tooltip */}
              {hoverPosition !== null && duration > 0 && (
                <div
                  className="absolute -top-7 -translate-x-1/2 px-2 py-0.5 bg-neutral-900/95 border border-white/10 text-white text-xs rounded font-mono shadow-xl pointer-events-none backdrop-blur-xs"
                  style={{ left: `${Math.max(4, Math.min(hoverPosition, 96))}%` }}
                >
                  {formatDuration(hoverTime)}
                </div>
              )}
            </div>

            {/* Control Buttons Bar */}
            <div className="flex items-center justify-between gap-2">
              <div className="flex min-w-0 items-center gap-1.5 sm:gap-2">
                <button
                  onClick={togglePlay}
                  className="rounded-full p-1.5 text-white hover:bg-white/10 hover:text-primary-400 shrink-0"
                  aria-label={isPlaying ? 'Metti in pausa' : 'Riproduci'}
                >
                  {isPlaying ? (
                    <Pause className="w-5 h-5 sm:w-6 sm:h-6" />
                  ) : (
                    <Play className="w-5 h-5 sm:w-6 sm:h-6" />
                  )}
                </button>

                <button
                  onClick={() => {
                    if (playerRef.current) playerRef.current.currentTime = 0;
                    if (ambientVideoRef.current) ambientVideoRef.current.currentTime = 0;
                    if (!isPlaying) togglePlay();
                  }}
                  className="hidden rounded-full p-1.5 text-white hover:bg-white/10 hover:text-primary-400 lg:block shrink-0"
                  title="Restart"
                  aria-label="Riavvia dall'inizio"
                >
                  <RotateCcw className="w-4 h-4" />
                </button>

                <button
                  onClick={() => skip(-10)}
                  className="hidden rounded-full p-1.5 text-white hover:bg-white/10 hover:text-primary-400 md:block shrink-0"
                  aria-label="Indietro di dieci secondi"
                >
                  <SkipBack className="w-4 h-4" />
                </button>

                <button
                  onClick={() => skip(10)}
                  className="hidden rounded-full p-1.5 text-white hover:bg-white/10 hover:text-primary-400 md:block shrink-0"
                  aria-label="Avanti di dieci secondi"
                >
                  <SkipForward className="w-4 h-4" />
                </button>

                <div className="flex items-center group/vol">
                  <button
                    onClick={toggleMute}
                    className="rounded-full p-1.5 text-white hover:bg-white/10 hover:text-primary-400 shrink-0"
                    aria-label={isMuted ? 'Attiva audio' : 'Disattiva audio'}
                  >
                    {isMuted || volume === 0 ? (
                      <VolumeX className="w-4 h-4 sm:w-5 sm:h-5" />
                    ) : (
                      <Volume2 className="w-4 h-4 sm:w-5 sm:h-5" />
                    )}
                  </button>
                  <input
                    type="range"
                    min="0"
                    max="1"
                    step="0.1"
                    value={volume}
                    onChange={(e) => {
                      const val = parseFloat(e.target.value);
                      changeVolume(val - volume);
                    }}
                    className="w-14 hidden group-hover/vol:block md:hidden lg:block accent-primary-500 cursor-pointer"
                  />
                </div>

                <span className="whitespace-nowrap text-[11px] font-medium text-white/90 sm:text-xs ml-1">
                  {formatDuration(currentTime)} / {formatDuration(duration)}
                </span>
              </div>

              <div className="flex shrink-0 items-center gap-1">
                {/* Settings Button */}
                <button
                  type="button"
                  onClick={() => setShowSettings(!showSettings)}
                  className={`rounded-full p-1.5 text-white hover:bg-white/10 hover:text-primary-400 transition ${
                    showSettings ? 'text-primary-400 bg-white/10' : ''
                  }`}
                  aria-label="Impostazioni video"
                >
                  <Settings className="w-5 h-5" />
                </button>

                {/* Fullscreen Button */}
                <button
                  type="button"
                  onClick={toggleFullscreen}
                  className="rounded-full p-1.5 text-white hover:bg-white/10 hover:text-primary-400 transition"
                  aria-label="Schermo intero"
                >
                  <Maximize className="w-5 h-5" />
                </button>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Settings Modal (Centered Overlay inside player, never clipped by overflow-hidden) */}
      {showSettings && (
        <div
          className="absolute inset-0 bg-black/85 backdrop-blur-md z-40 flex items-center justify-center p-3 sm:p-5 overflow-y-auto animate-in fade-in duration-150"
          onClick={(e) => {
            if (e.target === e.currentTarget) setShowSettings(false);
          }}
        >
          <div className="w-full max-w-[280px] sm:max-w-xs bg-neutral-900/95 border border-white/15 rounded-2xl p-4 shadow-2xl space-y-3.5 my-auto">
            {/* Modal Header */}
            <div className="flex items-center justify-between border-b border-white/10 pb-2">
              <span className="text-xs sm:text-sm font-bold text-white flex items-center gap-1.5">
                <Settings className="w-4 h-4 text-primary-400" />
                <span>Impostazioni</span>
              </span>
              <button
                type="button"
                onClick={() => setShowSettings(false)}
                className="p-1 rounded-lg text-white/70 hover:text-white hover:bg-white/10 transition"
                aria-label="Chiudi impostazioni"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            {/* Qualità Video */}
            <div>
              <div className="text-[10px] sm:text-[11px] uppercase tracking-wider font-bold text-gray-400 mb-1.5">
                Qualità Video
              </div>
              <div className="grid grid-cols-2 gap-1.5">
                {(availableQualities.length > 0 ? availableQualities : ['1080p', '720p', '480p', '360p']).map(
                  (q) => {
                    const isSelected = quality === q || (!quality && (q === '1080p' || q === 'high'));
                    return (
                      <button
                        key={q}
                        type="button"
                        onClick={() => {
                          handleQualitySelect(q as VideoQuality);
                          setShowSettings(false);
                        }}
                        className={`w-full text-center px-2 py-1.5 rounded-xl text-xs font-semibold transition-all ${
                          isSelected
                            ? 'bg-primary-600 text-white shadow-md border border-primary-400'
                            : 'bg-white/5 text-white/80 hover:bg-white/15 hover:text-white border border-white/5'
                        }`}
                      >
                        {QUALITY_LABELS[q] || q}
                      </button>
                    );
                  }
                )}
              </div>
            </div>

            {/* Velocità di riproduzione */}
            <div>
              <div className="text-[10px] sm:text-[11px] uppercase tracking-wider font-bold text-gray-400 mb-1.5">
                Velocità
              </div>
              <div className="grid grid-cols-3 gap-1">
                {[0.5, 0.75, 1, 1.25, 1.5, 2].map((rate) => (
                  <button
                    key={rate}
                    type="button"
                    onClick={() => changePlaybackRate(rate)}
                    className={`text-center py-1 rounded-lg text-xs font-semibold transition-all ${
                      playbackRate === rate
                        ? 'bg-primary-600 text-white shadow-md border border-primary-400'
                        : 'bg-white/5 text-white/80 hover:bg-white/15 border border-white/5'
                    }`}
                  >
                    {rate}x
                  </button>
                ))}
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
