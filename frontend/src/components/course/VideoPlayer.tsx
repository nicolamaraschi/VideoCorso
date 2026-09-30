import React, { useRef, useState, useEffect, useCallback } from 'react';
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
  '4k': '4K (2160p)',
  '2k': '2K (1440p)',
  '1440p': '2K (1440p)',
  '1080p': 'Full HD (1080p)',
  '720p': 'Alta (720p)',
  '480p': 'Media (480p)',
  '360p': 'Bassa (360p)',
  high: 'Full HD (1080p)',
  medium: 'Media (480p)',
  low: 'Bassa (360p)',
};

const QUALITY_FALLBACK_ORDER: VideoQuality[] = ['4k', '2k', '1080p', '720p', '480p', '360p'];
const STALL_RECOVERY_DELAY_MS = 8_000;
const PLAYBACK_HEARTBEAT_TIMEOUT_MS = 15_000;
const STABLE_PLAYBACK_RESET_MS = 30_000;
const MAX_AUTO_RECOVERY_ATTEMPTS = 3;

interface VideoPlayerProps {
  videoUrl: string;
  lessonId: string;
  onEnded?: () => void;
  availableQualities?: string[];
  quality?: VideoQuality;
  onQualityChange?: (quality: VideoQuality) => void;
  onAutomaticQualityFallback?: (quality: VideoQuality) => void;
  onRequestFreshUrl?: () => Promise<string | null>;
  trackProgress?: boolean;
}



export const VideoPlayer: React.FC<VideoPlayerProps> = ({
  videoUrl,
  lessonId,
  onEnded,
  availableQualities = [],
  quality,
  onQualityChange,
  onAutomaticQualityFallback,
  onRequestFreshUrl,
  trackProgress = true,
}) => {
  const playerRef = useRef<HTMLVideoElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const progressBarRef = useRef<HTMLDivElement>(null);
  const hideControlsTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const stallRecoveryTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const stablePlaybackTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const recoveryAttemptRef = useRef(0);
  const recoveryInFlightRef = useRef(false);
  const playIntentRef = useRef(false);
  const isScrubbingRef = useRef(false);
  const playbackPositionRef = useRef({ currentTime: 0, duration: 0 });

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

  // Shared by quality switches and automatic stall recovery. When the source
  // changes, loadedmetadata restores both the exact position and play state.
  const sourceChangeStateRef = useRef<{ time: number; wasPlaying: boolean } | null>(null);

  const {
    handleTimeUpdate: trackTimeUpdate,
    flushProgress,
    markComplete,
    seekToSeconds,
    clearSeekTo,
  } = useVideoProgress({
    lessonId,
    enabled: trackProgress,
  });

  const handleTimeUpdate = useCallback(
    (time: number, dur: number) => {
      if (trackProgress && dur > 0) {
        trackTimeUpdate(time, dur);
      }
    },
    [trackProgress, trackTimeUpdate]
  );

  const clearStallRecoveryTimer = useCallback(() => {
    if (stallRecoveryTimerRef.current) {
      clearTimeout(stallRecoveryTimerRef.current);
      stallRecoveryTimerRef.current = null;
    }
  }, []);

  const clearStablePlaybackTimer = useCallback(() => {
    if (stablePlaybackTimerRef.current) {
      clearTimeout(stablePlaybackTimerRef.current);
      stablePlaybackTimerRef.current = null;
    }
  }, []);

  const normalizedQuality = useCallback((): VideoQuality => {
    if (quality === 'high') return '1080p';
    if (quality === 'medium') return '480p';
    if (quality === 'low') return '360p';
    return quality || '720p';
  }, [quality]);

  const nextLowerAvailableQuality = useCallback((): VideoQuality | null => {
    const current = normalizedQuality();
    const currentIndex = QUALITY_FALLBACK_ORDER.indexOf(current);
    if (currentIndex < 0) return null;
    for (const candidate of QUALITY_FALLBACK_ORDER.slice(currentIndex + 1)) {
      if (availableQualities.includes(candidate)) return candidate;
    }
    return null;
  }, [availableQualities, normalizedQuality]);

  const recoverPlayback = useCallback(async (forcePlay = false) => {
    const video = playerRef.current;
    if (!video || recoveryInFlightRef.current || video.ended) return;

    clearStallRecoveryTimer();
    clearStablePlaybackTimer();

    const attempt = recoveryAttemptRef.current + 1;
    recoveryAttemptRef.current = attempt;
    if (attempt > MAX_AUTO_RECOVERY_ATTEMPTS) {
      playIntentRef.current = false;
      setIsBuffering(false);
      setIsPlaying(false);
      setVideoPlaybackError(
        'Il browser non è riuscito a riprendere il video. Tocca per ricaricarlo dal punto raggiunto.'
      );
      return;
    }

    const resumeTime = Number.isFinite(video.currentTime)
      ? video.currentTime
      : playbackPositionRef.current.currentTime;
    const wasPlaying = forcePlay || playIntentRef.current || !video.paused;
    playIntentRef.current = wasPlaying;
    sourceChangeStateRef.current = { time: resumeTime, wasPlaying };
    recoveryInFlightRef.current = true;
    setIsBuffering(true);
    setVideoPlaybackError(null);

    try {
      // On the second failure, prefer a lighter compatible rendition when it
      // exists. This also avoids repeatedly exercising a decoder profile that
      // a particular browser/device is struggling with.
      const lowerQuality = attempt >= 2 ? nextLowerAvailableQuality() : null;
      const applyAutomaticFallback = onAutomaticQualityFallback || onQualityChange;
      if (lowerQuality && applyAutomaticFallback) {
        // The lighter rendition deserves a fresh recovery budget: without this
        // reset a couple of stalls would exhaust the attempt limit even though
        // the downgraded quality is about to play fine.
        recoveryAttemptRef.current = 0;
        applyAutomaticFallback(lowerQuality);
        return;
      }

      const freshUrl = onRequestFreshUrl ? await onRequestFreshUrl() : null;
      // A URL generated during the same second can be identical. Explicitly
      // reload in that case; otherwise React will apply the fresh source and
      // loadedmetadata will restore the saved position.
      if (!freshUrl || freshUrl === videoUrl) {
        video.load();
      }
    } catch {
      // Even if refreshing the signed URL fails, retry the already authorised
      // source. This keeps temporary API problems from stranding playback.
      video.load();
    } finally {
      recoveryInFlightRef.current = false;
    }
  }, [
    clearStablePlaybackTimer,
    clearStallRecoveryTimer,
    nextLowerAvailableQuality,
    onAutomaticQualityFallback,
    onQualityChange,
    onRequestFreshUrl,
    videoUrl,
  ]);

  const scheduleStallRecovery = useCallback((delay = STALL_RECOVERY_DELAY_MS) => {
    clearStallRecoveryTimer();
    const video = playerRef.current;
    if (!video || !playIntentRef.current || isScrubbingRef.current || video.ended) return;
    const scheduledAtTime = video.currentTime;
    stallRecoveryTimerRef.current = setTimeout(() => {
      const currentVideo = playerRef.current;
      if (!currentVideo || !playIntentRef.current || currentVideo.ended) return;
      const playbackAdvanced = currentVideo.currentTime > scheduledAtTime + 0.25;
      if (playbackAdvanced && currentVideo.readyState >= HTMLMediaElement.HAVE_FUTURE_DATA) return;
      void recoverPlayback();
    }, delay);
  }, [clearStallRecoveryTimer, recoverPlayback]);

  const handlePlaying = useCallback(() => {
    clearStallRecoveryTimer();
    clearStablePlaybackTimer();
    playIntentRef.current = true;
    setIsPlaying(true);
    setIsBuffering(false);
    setVideoPlaybackError(null);
    stablePlaybackTimerRef.current = setTimeout(() => {
      recoveryAttemptRef.current = 0;
      stablePlaybackTimerRef.current = null;
    }, STABLE_PLAYBACK_RESET_MS);
    scheduleStallRecovery(PLAYBACK_HEARTBEAT_TIMEOUT_MS);
  }, [clearStablePlaybackTimer, clearStallRecoveryTimer, scheduleStallRecovery]);

  const handleCanPlay = useCallback(() => {
    clearStallRecoveryTimer();
    setIsBuffering(false);
    if (playIntentRef.current) scheduleStallRecovery(PLAYBACK_HEARTBEAT_TIMEOUT_MS);
  }, [clearStallRecoveryTimer, scheduleStallRecovery]);

  const handleVideoError = useCallback(() => {
    if (!playIntentRef.current) {
      setIsBuffering(false);
      setVideoPlaybackError('Il browser non è riuscito a caricare il video. Tocca per riprovare.');
      return;
    }
    setIsBuffering(true);
    clearStallRecoveryTimer();
    stallRecoveryTimerRef.current = setTimeout(() => {
      void recoverPlayback();
    }, 500);
  }, [clearStallRecoveryTimer, recoverPlayback]);

  const handlePause = useCallback((event: React.SyntheticEvent<HTMLVideoElement>) => {
    clearStallRecoveryTimer();
    clearStablePlaybackTimer();
    setIsBuffering(false);
    const video = event.currentTarget;
    playbackPositionRef.current = {
      currentTime: video.currentTime,
      duration: Number.isFinite(video.duration) ? video.duration : playbackPositionRef.current.duration,
    };
    if (trackProgress) {
      void flushProgress(
        playbackPositionRef.current.currentTime,
        playbackPositionRef.current.duration
      );
    }

    // WebKit can pause while a hidden tab is suspended or while the source is
    // being replaced. Preserve intent so visibility/pageshow can resume it.
    if (document.hidden || sourceChangeStateRef.current || recoveryInFlightRef.current) return;
    playIntentRef.current = false;
    setIsPlaying(false);
  }, [clearStablePlaybackTimer, clearStallRecoveryTimer, flushProgress, trackProgress]);

  const handleSeeking = useCallback(() => {
    clearStallRecoveryTimer();
    if (playIntentRef.current) setIsBuffering(true);
  }, [clearStallRecoveryTimer]);

  const handleSeeked = useCallback((event: React.SyntheticEvent<HTMLVideoElement>) => {
    const video = event.currentTarget;
    isScrubbingRef.current = false;
    setIsScrubbing(false);
    setIsBuffering(false);
    playbackPositionRef.current = {
      currentTime: video.currentTime,
      duration: Number.isFinite(video.duration) ? video.duration : playbackPositionRef.current.duration,
    };
    if (!playIntentRef.current || video.ended) return;
    if (video.paused) {
      void video.play().catch(() => scheduleStallRecovery(500));
    } else if (video.readyState < HTMLMediaElement.HAVE_FUTURE_DATA) {
      scheduleStallRecovery();
    }
  }, [scheduleStallRecovery]);

  useEffect(() => {
    const handleOnline = () => {
      const video = playerRef.current;
      if (playIntentRef.current && video && video.readyState < HTMLMediaElement.HAVE_FUTURE_DATA) {
        void recoverPlayback();
      }
    };
    const resumeAfterSuspension = () => {
      if (document.hidden || !playIntentRef.current) return;
      const video = playerRef.current;
      if (!video || video.ended) return;
      if (video.readyState < HTMLMediaElement.HAVE_CURRENT_DATA) {
        scheduleStallRecovery(500);
      } else if (video.paused) {
        void video.play().catch(() => scheduleStallRecovery(500));
      }
    };
    const flushBeforeLeaving = () => {
      if (!trackProgress) return;
      const video = playerRef.current;
      if (video) {
        playbackPositionRef.current = {
          currentTime: video.currentTime,
          duration: Number.isFinite(video.duration) ? video.duration : playbackPositionRef.current.duration,
        };
      }
      void flushProgress(
        playbackPositionRef.current.currentTime,
        playbackPositionRef.current.duration
      );
    };
    window.addEventListener('online', handleOnline);
    window.addEventListener('pageshow', resumeAfterSuspension);
    window.addEventListener('pagehide', flushBeforeLeaving);
    document.addEventListener('visibilitychange', resumeAfterSuspension);
    return () => {
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('pageshow', resumeAfterSuspension);
      window.removeEventListener('pagehide', flushBeforeLeaving);
      document.removeEventListener('visibilitychange', resumeAfterSuspension);
    };
  }, [flushProgress, recoverPlayback, scheduleStallRecovery, trackProgress]);

  useEffect(() => {
    if (!isPlaying) clearStallRecoveryTimer();
  }, [clearStallRecoveryTimer, isPlaying]);

  useEffect(() => () => {
    clearStallRecoveryTimer();
    clearStablePlaybackTimer();
  }, [clearStablePlaybackTimer, clearStallRecoveryTimer]);

  useEffect(() => {
    const video = playerRef.current;
    if (!video) return;
    if (isPlaying) {
      playIntentRef.current = true;
      video.play().catch((error: DOMException) => {
        if (error?.name === 'NotAllowedError') {
          playIntentRef.current = false;
          setIsPlaying(false);
          setIsBuffering(false);
          return;
        }
        setIsBuffering(true);
        scheduleStallRecovery(500);
      });
    } else {
      video.pause();
    }
  }, [isPlaying, scheduleStallRecovery]);

  useEffect(() => {
    const video = playerRef.current;
    if (!video) return;
    video.volume = volume;
    video.muted = isMuted;
  }, [volume, isMuted]);

  useEffect(() => {
    const video = playerRef.current;
    if (!video) return;
    video.playbackRate = playbackRate;
  }, [playbackRate]);

  const handleQualitySelect = (newQuality: VideoQuality) => {
    if (newQuality === quality) {
      setShowSettings(false);
      return;
    }
    const currentVideoTime = playerRef.current?.currentTime ?? currentTime;
    recoveryAttemptRef.current = 0;
    sourceChangeStateRef.current = {
      time: currentVideoTime,
      wasPlaying: playIntentRef.current || !playerRef.current?.paused,
    };
    setShowSettings(false);
    onQualityChange?.(newQuality);
  };

  const togglePlay = useCallback(() => {
    const shouldPlay = !playIntentRef.current;
    playIntentRef.current = shouldPlay;
    setIsPlaying(shouldPlay);
  }, []);

  const toggleMute = useCallback(() => {
    setIsMuted((muted) => !muted);
  }, []);

  const changeVolume = useCallback((delta: number) => {
    const newVolume = Math.max(0, Math.min(1, volume + delta));
    setVolume(newVolume);
    if (newVolume > 0) setIsMuted(false);
  }, [volume]);

  const skip = useCallback((seconds: number) => {
    if (playerRef.current) {
      const videoDuration = playerRef.current.duration || duration;
      const newTime = Math.max(0, Math.min(videoDuration, playerRef.current.currentTime + seconds));
      playerRef.current.currentTime = newTime;
      setCurrentTime(newTime);
    }
  }, [duration]);

  const changePlaybackRate = (rate: number) => {
    setPlaybackRate(rate);
    setShowSettings(false);
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
  }, [changeVolume, skip, toggleFullscreen, toggleMute, togglePlay]);

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
  const calculateTimeFromEvent = useCallback((clientX: number): number => {
    if (!progressBarRef.current || duration <= 0) return 0;
    const rect = progressBarRef.current.getBoundingClientRect();
    const pos = Math.max(0, Math.min(1, (clientX - rect.left) / rect.width));
    return pos * duration;
  }, [duration]);

  const seekToTime = useCallback((targetTime: number) => {
    const clampedTime = Math.max(0, Math.min(duration, targetTime));
    if (playerRef.current) {
      playerRef.current.currentTime = clampedTime;
    }
    setCurrentTime(clampedTime);
  }, [duration]);

  const handleProgressBarMouseDown = (e: React.MouseEvent<HTMLDivElement>) => {
    isScrubbingRef.current = true;
    setIsScrubbing(true);
    seekToTime(calculateTimeFromEvent(e.clientX));
  };

  const handleProgressBarMouseMove = (e: React.MouseEvent<HTMLDivElement>) => {
    if (!progressBarRef.current || duration <= 0) return;
    const rect = progressBarRef.current.getBoundingClientRect();
    const pos = Math.max(0, Math.min(1, (e.clientX - rect.left) / rect.width));
    setHoverPosition(pos * 100);
    setHoverTime(pos * duration);

    if (isScrubbingRef.current) {
      seekToTime(pos * duration);
    }
  };

  const handleProgressBarMouseLeave = () => {
    if (!isScrubbingRef.current) {
      setHoverPosition(null);
    }
  };

  const finishScrubbing = useCallback(() => {
    if (!isScrubbingRef.current) return;
    isScrubbingRef.current = false;
    setIsScrubbing(false);
    setHoverPosition(null);
    const video = playerRef.current;
    if (
      playIntentRef.current &&
      video &&
      !video.ended &&
      video.readyState < HTMLMediaElement.HAVE_FUTURE_DATA
    ) {
      scheduleStallRecovery();
    }
  }, [scheduleStallRecovery]);

  useEffect(() => {
    const handleGlobalMouseUp = () => {
      finishScrubbing();
    };

    const handleGlobalMouseMove = (e: MouseEvent) => {
      if (isScrubbingRef.current) {
        seekToTime(calculateTimeFromEvent(e.clientX));
      }
    };

    const handleGlobalTouchEnd = () => finishScrubbing();

    window.addEventListener('mouseup', handleGlobalMouseUp);
    window.addEventListener('mousemove', handleGlobalMouseMove);
    window.addEventListener('touchend', handleGlobalTouchEnd);
    window.addEventListener('touchcancel', handleGlobalTouchEnd);

    return () => {
      window.removeEventListener('mouseup', handleGlobalMouseUp);
      window.removeEventListener('mousemove', handleGlobalMouseMove);
      window.removeEventListener('touchend', handleGlobalTouchEnd);
      window.removeEventListener('touchcancel', handleGlobalTouchEnd);
    };
  }, [calculateTimeFromEvent, finishScrubbing, seekToTime]);

  const displayAspectRatio = rotation === 90 || rotation === 270 ? 1 / aspectRatio : aspectRatio;
  const isPortrait = displayAspectRatio < 1;
  const progressPercentage = duration > 0 ? (currentTime / duration) * 100 : 0;

  useEffect(() => {
    setAspectRatio(16 / 9);
    setRotation(0);
    setVideoPlaybackError(null);
  }, [videoUrl]);

  const handleLoadedMetadata = useCallback((event: React.SyntheticEvent<HTMLVideoElement>) => {
    const videoEl = event.currentTarget;
    if (Number.isFinite(videoEl.duration) && videoEl.duration > 0) {
      playbackPositionRef.current.duration = videoEl.duration;
      setDuration(videoEl.duration);
    }
    if (videoEl.videoWidth > 0 && videoEl.videoHeight > 0) {
      setAspectRatio(videoEl.videoWidth / videoEl.videoHeight);
    }
    setIsBuffering(false);
    setVideoPlaybackError(null);

    const pending = sourceChangeStateRef.current;
    if (pending) {
      sourceChangeStateRef.current = null;
      try {
        videoEl.currentTime = pending.time;
        setCurrentTime(pending.time);
      } catch {
        // Some WebKit versions only accept the seek once more media data is
        // available. The canplay fallback below repeats it safely.
        videoEl.addEventListener('canplay', () => {
          videoEl.currentTime = pending.time;
          setCurrentTime(pending.time);
        }, { once: true });
      }
      videoEl.playbackRate = playbackRate;
      playIntentRef.current = pending.wasPlaying;
      setIsPlaying(pending.wasPlaying);
      if (pending.wasPlaying) {
        const resume = () => {
          void videoEl.play().catch(() => {
            playIntentRef.current = false;
            setIsPlaying(false);
            setIsBuffering(false);
          });
        };
        if (videoEl.readyState >= HTMLMediaElement.HAVE_CURRENT_DATA) resume();
        else videoEl.addEventListener('canplay', resume, { once: true });
      }
    }
  }, [playbackRate]);

  useEffect(() => {
    const videoEl = playerRef.current;
    if (
      !videoEl ||
      sourceChangeStateRef.current ||
      seekToSeconds === null ||
      seekToSeconds <= 0 ||
      !Number.isFinite(videoEl.duration) ||
      seekToSeconds >= videoEl.duration
    ) {
      return;
    }
    videoEl.currentTime = seekToSeconds;
    playbackPositionRef.current.currentTime = seekToSeconds;
    setCurrentTime(seekToSeconds);
    clearSeekTo();
  }, [clearSeekTo, duration, seekToSeconds]);

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
        
        {/* Dynamic CSS Blur Aura - Zero Network Overhead */}
        <div
          className="absolute inset-0 opacity-60 scale-110 blur-3xl saturate-150 pointer-events-none transition-opacity duration-700"
          style={{
            background:
              'radial-gradient(ellipse at center, rgba(142, 28, 59, 0.45) 0%, rgba(76, 5, 25, 0.25) 50%, transparent 80%)',
          }}
          aria-hidden="true"
        />

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
        <video
          ref={playerRef}
          src={videoUrl}
          playsInline
          preload="metadata"
          onWaiting={() => {
            setIsBuffering(true);
            scheduleStallRecovery();
          }}
          onStalled={() => {
            setIsBuffering(true);
            scheduleStallRecovery(4_000);
          }}
          onPlaying={handlePlaying}
          onPause={handlePause}
          onCanPlay={handleCanPlay}
          onSeeking={handleSeeking}
          onSeeked={handleSeeked}
          onError={handleVideoError}
          onTimeUpdate={(event) => {
            const el = event.currentTarget;
            // Safari can leave the buffering spinner on even though playback is
            // advancing: it may fire `waiting` without a matching `playing`
            // (Chrome always re-fires `playing`). Clear it as soon as real
            // frames are being produced.
            if (isBuffering && el.readyState >= HTMLMediaElement.HAVE_CURRENT_DATA) {
              setIsBuffering(false);
            }
            const playedSeconds = el.currentTime;
            playbackPositionRef.current = {
              currentTime: playedSeconds,
              duration: Number.isFinite(el.duration)
                ? el.duration
                : duration,
            };
            if (
              playIntentRef.current &&
              el.readyState >= HTMLMediaElement.HAVE_CURRENT_DATA
            ) {
              scheduleStallRecovery(PLAYBACK_HEARTBEAT_TIMEOUT_MS);
            }
            if (!isScrubbingRef.current) {
              setCurrentTime(playedSeconds);
            }
            handleTimeUpdate(playedSeconds, playbackPositionRef.current.duration);
          }}
          onDurationChange={(event) => {
            const nextDuration = event.currentTarget.duration;
            if (!Number.isFinite(nextDuration) || nextDuration <= 0) return;
            playbackPositionRef.current.duration = nextDuration;
            setDuration(nextDuration);
          }}
          onLoadedMetadata={handleLoadedMetadata}
          onEnded={async (event) => {
            clearStallRecoveryTimer();
            clearStablePlaybackTimer();
            playIntentRef.current = false;
            setIsPlaying(false);
            const endedAt = event.currentTarget.currentTime;
            const totalDuration = Number.isFinite(event.currentTarget.duration)
              ? event.currentTarget.duration
              : duration;
            playbackPositionRef.current = { currentTime: endedAt, duration: totalDuration };
            if (trackProgress) await markComplete(endedAt, totalDuration);
            if (onEnded) onEnded();
          }}
          style={
            rotation === 0
              ? {
                  position: 'absolute',
                  top: 0,
                  left: 0,
                  width: '100%',
                  height: '100%',
                  objectFit: 'contain',
                }
              : {
                  position: 'absolute',
                  top: '50%',
                  left: '50%',
                  width: `${aspectRatio * 100}%`,
                  height: `${100 / aspectRatio}%`,
                  transform: `translate(-50%, -50%) rotate(${rotation}deg)`,
                  objectFit: 'contain',
                }
          }
        />
      </div>

      {/* Playback Error Overlay */}
      {videoPlaybackError && (
        <div className="absolute inset-0 flex flex-col items-center justify-center p-4 bg-black/85 text-white z-30 text-center">
          <p className="text-sm font-medium mb-3 text-red-200">{videoPlaybackError}</p>
          <button
            type="button"
            onClick={() => {
              recoveryAttemptRef.current = 0;
              playIntentRef.current = true;
              setVideoPlaybackError(null);
              setIsBuffering(true);
              setIsPlaying(true);
              void recoverPlayback(true);
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
                isScrubbingRef.current = true;
                setIsScrubbing(true);
                const touch = e.touches[0];
                if (touch) seekToTime(calculateTimeFromEvent(touch.clientX));
              }}
              onTouchMove={(e) => {
                e.stopPropagation();
                const touch = e.touches[0];
                if (touch && isScrubbingRef.current) seekToTime(calculateTimeFromEvent(touch.clientX));
              }}
              onTouchEnd={(e) => {
                e.stopPropagation();
                finishScrubbing();
              }}
              onTouchCancel={(e) => {
                e.stopPropagation();
                finishScrubbing();
              }}
              data-no-swipe="true"
              className="relative w-full py-2 cursor-pointer group/progress select-none touch-none"
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

      {/* Settings Popover (Anchored bottom-right above control bar, non-intrusive so video remains fully visible) */}
      {showSettings && (
        <>
          {/* Transparent click-away layer (does NOT darken or blur the video) */}
          <div
            className="absolute inset-0 z-30 cursor-default"
            onClick={() => setShowSettings(false)}
          />

          {/* Floating Settings Card */}
          <div
            className="absolute bottom-16 right-3 sm:right-6 z-40 w-64 sm:w-72 max-w-[calc(100vw-24px)] bg-neutral-950/92 border border-white/15 rounded-2xl p-3.5 shadow-2xl backdrop-blur-md space-y-3 animate-in fade-in slide-in-from-bottom-2 duration-150"
            onClick={(e) => e.stopPropagation()}
          >
            {/* Popover Header */}
            <div className="flex items-center justify-between border-b border-white/10 pb-2">
              <span className="text-xs sm:text-sm font-bold text-white flex items-center gap-1.5">
                <Settings className="w-4 h-4 text-primary-400" />
                <span>Impostazioni</span>
              </span>
              <button
                type="button"
                onClick={() => setShowSettings(false)}
                className="p-1 rounded-lg text-white/70 hover:text-white hover:bg-white/10 transition cursor-pointer"
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
              {availableQualities.length > 0 ? (
                <div className="grid grid-cols-2 gap-1.5">
                  {availableQualities.map((q) => {
                    const isSelected =
                      quality === q ||
                      ((quality === 'high' || !quality) && (q === '1080p' || (!availableQualities.includes('1080p') && q === '720p')));
                    return (
                      <button
                        key={q}
                        type="button"
                        onClick={() => {
                          handleQualitySelect(q as VideoQuality);
                          setShowSettings(false);
                        }}
                        className={`w-full text-center px-2 py-1.5 rounded-xl text-xs font-semibold transition-all cursor-pointer ${
                          isSelected
                            ? 'bg-primary-600 text-white shadow-md border border-primary-400'
                            : 'bg-white/5 text-white/80 hover:bg-white/15 hover:text-white border border-white/5'
                        }`}
                      >
                        {QUALITY_LABELS[q] || q}
                      </button>
                    );
                  })}
                </div>
              ) : (
                <div className="rounded-xl border border-white/10 bg-white/5 px-3 py-2 text-xs text-white/75">
                  Qualità originale
                </div>
              )}
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
                    className={`text-center py-1 rounded-lg text-xs font-semibold transition-all cursor-pointer ${
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
        </>
      )}
    </div>
  );
};
