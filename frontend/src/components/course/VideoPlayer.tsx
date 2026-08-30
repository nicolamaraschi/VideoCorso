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
} from 'lucide-react';
import { formatDuration } from '../../utils/formatters';
import { useVideoProgress } from '../../hooks/useVideoProgress';
import type { VideoQuality } from '../../types';

interface WebKitVideoElement extends HTMLVideoElement {
  webkitEnterFullscreen?: () => void;
  webkitRequestFullscreen?: () => void;
}

interface WebKitPlayerWrapper {
  getInternalPlayer?: () => WebKitVideoElement | null;
}

const QUALITY_LABELS: Record<string, string> = {
  '1080p': 'Full HD (1080p)',
  '720p': 'Alta (720p)',
  '480p': 'Media (480p)',
  '360p': 'Bassa (360p)',
  high: 'Full HD (1080p)',
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
  // iPhone MOV/MP4 files can store portrait orientation in the `tkhd` atom.
  // Chrome desktop doesn't consistently apply it, so read it explicitly.
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

  // Some phones write `moov` at the beginning, others at the end of the file.
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
  // react-player v3 forwards its ref to the underlying HTMLVideoElement.
  const playerRef = useRef<HTMLVideoElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const progressBarRef = useRef<HTMLDivElement>(null);

  const [isPlaying, setIsPlaying] = useState(false);
  const [currentTime, setCurrentTime] = useState(0);
  const [duration, setDuration] = useState(0);
  const [volume, setVolume] = useState(1);
  const [isMuted, setIsMuted] = useState(false);
  const [playbackRate, setPlaybackRate] = useState(1);
  const [showControls, setShowControls] = useState(true);
  const [showSettings, setShowSettings] = useState(false);
  const [isScrubbing, setIsScrubbing] = useState(false);
  const [hoverPosition, setHoverPosition] = useState<number | null>(null);
  const [hoverTime, setHoverTime] = useState<number>(0);
  const [isBuffering, setIsBuffering] = useState(false);
  // Start with 16:9 to avoid layout shift, then use the uploaded video's
  // native dimensions as soon as its metadata is available.
  const [aspectRatio, setAspectRatio] = useState(16 / 9);
  const [rotation, setRotation] = useState<0 | 90 | 180 | 270>(0);

  const {
    handleTimeUpdate,
    saveProgress,
    markComplete,
    seekToSeconds,
    clearSeekTo
  } = useVideoProgress({ lessonId, enabled: trackProgress });

  // Instant optimistic seeking on the video element
  const seekToTime = useCallback((targetTime: number) => {
    const video = playerRef.current;
    const boundedTime = Math.max(0, Math.min(targetTime, duration || 0));
    setCurrentTime(boundedTime); // Instant UI feedback without waiting for network
    if (video) {
      if ('fastSeek' in video && typeof video.fastSeek === 'function') {
        try {
          video.fastSeek(boundedTime);
        } catch {
          video.currentTime = boundedTime;
        }
      } else {
        video.currentTime = boundedTime;
      }
    }
  }, [duration]);

  // When the user switches quality, the parent fetches a new presigned URL for
  // the same lesson. We keep track of where playback was so switching quality
  // resumes from the same point instead of restarting the video from zero.
  const qualitySwitchStateRef = useRef<{ time: number; wasPlaying: boolean } | null>(null);

  const handleQualitySelect = useCallback((newQuality: VideoQuality) => {
    if (!onQualityChange) return;
    qualitySwitchStateRef.current = { time: currentTime, wasPlaying: isPlaying };
    setShowSettings(false);
    onQualityChange(newQuality);
  }, [currentTime, isPlaying, onQualityChange]);

  // Handle seeking from progress load
  useEffect(() => {
    if (seekToSeconds !== null && playerRef.current) {
      seekToTime(seekToSeconds);
      clearSeekTo();
    }
  }, [seekToSeconds, clearSeekTo, seekToTime]);

  // Keep the latest playback position in refs so the unmount-save effect
  // below can read current values without re-running (and thus re-firing
  // its cleanup) on every timeupdate tick.
  const currentTimeRef = useRef(currentTime);
  const durationRef = useRef(duration);
  currentTimeRef.current = currentTime;
  durationRef.current = duration;

  // Handle unmount save. Empty dependency array is intentional: this effect
  // must mount/cleanup exactly once (on mount / on unmount), not on every
  // currentTime update - otherwise the cleanup fires on every tick and saves
  // progress far more often than intended.
  useEffect(() => {
    return () => {
      if (trackProgress && currentTimeRef.current > 0 && durationRef.current > 0) {
        saveProgress(currentTimeRef.current, durationRef.current);
      }
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const togglePlay = useCallback(() => {
    if (!playerRef.current) return;
    
    // If saving pause progress manually
    if (trackProgress && isPlaying) {
      saveProgress(currentTime, duration);
    }
    setIsPlaying(!isPlaying);
  }, [isPlaying, currentTime, duration, saveProgress, trackProgress]);

  const skip = useCallback((seconds: number) => {
    seekToTime(currentTime + seconds);
  }, [currentTime, seekToTime]);

  const calculateTimeFromEvent = useCallback((clientX: number) => {
    if (!progressBarRef.current || duration <= 0) return 0;
    const rect = progressBarRef.current.getBoundingClientRect();
    const ratio = Math.max(0, Math.min((clientX - rect.left) / rect.width, 1));
    return ratio * duration;
  }, [duration]);

  const handleProgressBarMouseDown = (e: React.MouseEvent<HTMLDivElement>) => {
    e.preventDefault();
    setIsScrubbing(true);
    const target = calculateTimeFromEvent(e.clientX);
    seekToTime(target);
  };

  const handleProgressBarMouseMove = (e: React.MouseEvent<HTMLDivElement>) => {
    if (!progressBarRef.current || duration <= 0) return;
    const rect = progressBarRef.current.getBoundingClientRect();
    const ratio = Math.max(0, Math.min((e.clientX - rect.left) / rect.width, 1));
    setHoverPosition(ratio * 100);
    setHoverTime(ratio * duration);

    if (isScrubbing) {
      seekToTime(ratio * duration);
    }
  };

  const handleProgressBarMouseLeave = () => {
    setHoverPosition(null);
  };

  // Global mouseup/touchend to smoothly stop scrubbing anywhere on the page
  useEffect(() => {
    const handleGlobalRelease = () => {
      if (isScrubbing) {
        setIsScrubbing(false);
      }
    };
    window.addEventListener('mouseup', handleGlobalRelease);
    window.addEventListener('touchend', handleGlobalRelease);
    return () => {
      window.removeEventListener('mouseup', handleGlobalRelease);
      window.removeEventListener('touchend', handleGlobalRelease);
    };
  }, [isScrubbing]);

  const changeVolume = useCallback((delta: number) => {
    const newVolume = Math.max(0, Math.min(1, volume + delta));
    setVolume(newVolume);
    if (newVolume > 0) setIsMuted(false);
  }, [volume]);

  const toggleMute = useCallback(() => {
    setIsMuted(!isMuted);
  }, [isMuted]);

  const changePlaybackRate = (rate: number) => {
    setPlaybackRate(rate);
    setShowSettings(false);
  };

  const toggleFullscreen = useCallback(() => {
    if (document.fullscreenElement) {
      document.exitFullscreen();
      return;
    }

    const container = containerRef.current;
    if (container && 'requestFullscreen' in container && typeof container.requestFullscreen === 'function') {
      container.requestFullscreen();
      return;
    }

    // Fallback nativo per iOS Safari (iPhone / iPad) dove l'API Fullscreen è supportata solo sul tag <video>
    const playerWrapper = playerRef.current as unknown as WebKitPlayerWrapper | WebKitVideoElement | null;
    const videoEl =
      playerWrapper && 'getInternalPlayer' in playerWrapper && typeof playerWrapper.getInternalPlayer === 'function'
        ? playerWrapper.getInternalPlayer()
        : (playerWrapper as WebKitVideoElement | null);

    if (videoEl) {
      if (typeof videoEl.webkitEnterFullscreen === 'function') {
        videoEl.webkitEnterFullscreen();
        return;
      }
      if (typeof videoEl.webkitRequestFullscreen === 'function') {
        videoEl.webkitRequestFullscreen();
      }
    }
  }, []);

  const revealControls = useCallback(() => {
    setShowControls(true);
  }, []);

  // Keyboard shortcuts
  useEffect(() => {
    const handleKeyPress = (e: KeyboardEvent) => {
      if (!playerRef.current) return;

      switch (e.key) {
        case ' ':
        case 'k':
          e.preventDefault();
          togglePlay();
          break;
        case 'ArrowLeft':
          e.preventDefault();
          skip(-10);
          break;
        case 'ArrowRight':
          e.preventDefault();
          skip(10);
          break;
        case 'ArrowUp':
          e.preventDefault();
          changeVolume(0.1);
          break;
        case 'ArrowDown':
          e.preventDefault();
          changeVolume(-0.1);
          break;
        case 'm':
          e.preventDefault();
          toggleMute();
          break;
        case 'f':
          e.preventDefault();
          toggleFullscreen();
          break;
        case 'Escape':
          if (showSettings) {
            e.preventDefault();
            setShowSettings(false);
          }
          break;
      }
    };

    document.addEventListener('keydown', handleKeyPress);
    return () => document.removeEventListener('keydown', handleKeyPress);
  }, [changeVolume, skip, toggleFullscreen, toggleMute, togglePlay, showSettings]);

  // Auto-hide controls
  useEffect(() => {
    let timeout: ReturnType<typeof setTimeout>;

    const handleMouseMove = () => {
      setShowControls(true);
      clearTimeout(timeout);
      timeout = setTimeout(() => {
        if (isPlaying) {
          setShowControls(false);
        }
      }, 3000);
    };

    const container = containerRef.current;
    if (container) {
      container.addEventListener('mousemove', handleMouseMove);
    }

    return () => {
      if (container) {
        container.removeEventListener('mousemove', handleMouseMove);
      }
      clearTimeout(timeout);
    };
  }, [isPlaying]);

  const progressPercentage = duration > 0 ? (currentTime / duration) * 100 : 0;
  const displayAspectRatio = rotation === 90 || rotation === 270 ? 1 / aspectRatio : aspectRatio;
  const isPortrait = displayAspectRatio < 1;

  const [videoPlaybackError, setVideoPlaybackError] = useState<string | null>(null);

  useEffect(() => {
    // A new lesson may use a different format from the previous one.
    setAspectRatio(16 / 9);
    setRotation(0);
    setVideoPlaybackError(null);

    // Mobile devices (iOS & Android) auto-rotate portrait MP4s natively in hardware.
    // Avoid running extra 4MB range requests on mobile 4G networks.
    const isMobile = typeof navigator !== 'undefined' && /iPhone|iPad|iPod|Android/i.test(navigator.userAgent);
    if (isMobile) {
      return;
    }

    const controller = new AbortController();
    void getIPhoneVideoRotation(videoUrl, controller.signal)
      .then(setRotation)
      .catch(() => {
        // Non-MP4 sources and servers without range support simply play normally.
      });

    return () => controller.abort();
  }, [videoUrl]);

  // Resume at the same position (and playing state) right after a quality
  // switch loads a new source for this same lesson.
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
      className={`relative bg-black rounded-lg overflow-hidden group video-player mx-auto ${
        isPortrait ? 'max-w-[480px] max-h-[78vh] w-auto' : 'w-full max-h-[82vh]'
      }`}
      style={{ aspectRatio: String(displayAspectRatio) }}
      onTouchStart={revealControls}
    >
      {/* Video Element */}
      <div className="absolute inset-0 pointer-events-none">
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
          style={rotation === 0 ? {
            position: 'absolute',
            top: 0,
            left: 0,
          } : {
            position: 'absolute',
            top: '50%',
            left: '50%',
            width: `${aspectRatio * 100}%`,
            height: `${100 / aspectRatio}%`,
            transform: `translate(-50%, -50%) rotate(${rotation}deg)`,
          }}
          config={{
            youtube: {
              rel: 0,
              iv_load_policy: 3,
            }
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
        className="absolute inset-0 z-10" 
        onClick={(e) => {
          if (e.target === e.currentTarget) {
            if (!showControls && isPlaying) {
              revealControls();
            } else {
              togglePlay();
            }
          }
        }}
      >
        <div
          className={`absolute inset-0 bg-gradient-to-t from-black/85 via-black/20 to-transparent pointer-events-none transition-opacity duration-300 ${showControls || !isPlaying ? 'opacity-100' : 'opacity-0'
            }`}
        >
          {/* Center Play Button */}
          {!isPlaying && !isBuffering && (
            <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
              <button
                onClick={(e) => {
                  e.stopPropagation();
                  togglePlay();
                }}
                className="w-20 h-20 bg-white/20 hover:bg-white/30 rounded-full flex items-center justify-center transition-all backdrop-blur-sm pointer-events-auto shadow-2xl hover:scale-105"
              >
                <Play className="w-10 h-10 text-white ml-1" />
              </button>
            </div>
          )}

          {/* Bottom Controls */}
          <div className="absolute bottom-0 left-0 right-0 space-y-1.5 p-2.5 sm:p-4 pointer-events-auto">
            {/* Smooth Scrubbable Progress Bar with Enlarged Hit Area and Hover Tooltip */}
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

            {/* Control Buttons */}
            <div className="flex items-center justify-between gap-2">
              <div className="flex min-w-0 items-center gap-1.5 sm:gap-2">
                <button
                  onClick={togglePlay}
                  className="rounded-full p-1.5 text-white hover:bg-white/10 hover:text-primary-400 shrink-0"
                  aria-label={isPlaying ? 'Metti in pausa' : 'Riproduci'}
                >
                  {isPlaying ? <Pause className="w-5 h-5 sm:w-6 sm:h-6" /> : <Play className="w-5 h-5 sm:w-6 sm:h-6" />}
                </button>

                <button
                  onClick={() => {
                    if (playerRef.current) playerRef.current.currentTime = 0;
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
                {/* Settings Menu */}
                <div className="relative">
                  <button
                    onClick={() => setShowSettings(!showSettings)}
                    className={`rounded-full p-1.5 text-white hover:bg-white/10 hover:text-primary-400 ${showSettings ? 'text-primary-400 bg-white/10' : ''}`}
                    aria-label="Impostazioni video"
                  >
                    <Settings className="w-5 h-5" />
                  </button>

                  {showSettings && (
                    <>
                      <div
                        className="fixed inset-0 z-20"
                        onClick={() => setShowSettings(false)}
                      />
                      <div className="absolute bottom-full right-0 mb-2 bg-neutral-900/95 border border-white/15 rounded-xl p-2.5 min-w-[180px] max-h-[65vh] overflow-y-auto overscroll-contain shadow-2xl backdrop-blur-md z-30">
                        {/* Qualità Video */}
                        <div className="text-white text-xs font-semibold mb-1 px-2 flex items-center justify-between">
                          <span>Qualità video</span>
                        </div>
                        {(availableQualities.length > 0 ? availableQualities : ['1080p', '720p', '480p', '360p']).map((q) => {
                          const isSelected = quality === q || (!quality && (q === '1080p' || q === 'high'));
                          return (
                            <button
                              key={q}
                              onClick={() => handleQualitySelect(q as VideoQuality)}
                              className={`w-full text-left px-2.5 py-1.5 rounded-lg text-xs font-medium transition-colors ${
                                isSelected
                                  ? 'bg-primary-600 text-white font-semibold shadow-sm'
                                  : 'text-white/80 hover:bg-white/10 hover:text-white'
                              }`}
                            >
                              {QUALITY_LABELS[q] || q}
                            </button>
                          );
                        })}

                        {/* Velocità di riproduzione */}
                        <div className="text-white text-xs font-semibold mt-2.5 mb-1 px-2 border-t border-white/15 pt-2">
                          Velocità
                        </div>
                        <div className="grid grid-cols-3 gap-1">
                          {[0.5, 0.75, 1, 1.25, 1.5, 2].map((rate) => (
                            <button
                              key={rate}
                              onClick={() => changePlaybackRate(rate)}
                              className={`text-center py-1 rounded text-xs transition-colors ${
                                playbackRate === rate
                                  ? 'bg-primary-600 text-white font-semibold'
                                  : 'text-white/80 hover:bg-white/10'
                              }`}
                            >
                              {rate}x
                            </button>
                          ))}
                        </div>
                      </div>
                    </>
                  )}
                </div>

                <button onClick={toggleFullscreen} className="rounded-full p-1.5 text-white hover:bg-white/10 hover:text-primary-400" aria-label="Schermo intero">
                  <Maximize className="w-5 h-5" />
                </button>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
