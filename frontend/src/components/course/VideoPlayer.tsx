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

interface VideoPlayerProps {
  videoUrl: string;
  lessonId: string;
  onEnded?: () => void;
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
  } = useVideoProgress({ lessonId });

  // Handle seeking from progress load
  useEffect(() => {
    if (seekToSeconds !== null && playerRef.current) {
      playerRef.current.currentTime = seekToSeconds;
      clearSeekTo();
    }
  }, [seekToSeconds, clearSeekTo]);

  // Handle unmount save
  useEffect(() => {
    return () => {
      if (currentTime > 0 && duration > 0) {
        saveProgress(currentTime, duration);
      }
    };
  }, [currentTime, duration, saveProgress]);

  const togglePlay = useCallback(() => {
    if (!playerRef.current) return;
    
    // If saving pause progress manually
    if (isPlaying) {
      saveProgress(currentTime, duration);
    }
    setIsPlaying(!isPlaying);
  }, [isPlaying, currentTime, duration, saveProgress]);

  const skip = useCallback((seconds: number) => {
    if (!playerRef.current) return;
    const newTime = Math.max(0, Math.min(currentTime + seconds, duration));
    playerRef.current.currentTime = newTime;
  }, [currentTime, duration]);

  const handleProgressClick = (e: React.MouseEvent<HTMLDivElement>) => {
    if (!playerRef.current || !progressBarRef.current) return;

    const rect = progressBarRef.current.getBoundingClientRect();
    const pos = (e.clientX - rect.left) / rect.width;
    playerRef.current.currentTime = pos * duration;
  };

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
    if (!containerRef.current) return;

    if (!document.fullscreenElement) {
      containerRef.current.requestFullscreen();
    } else {
      document.exitFullscreen();
    }
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
      }
    };

    document.addEventListener('keydown', handleKeyPress);
    return () => document.removeEventListener('keydown', handleKeyPress);
  }, [changeVolume, skip, toggleFullscreen, toggleMute, togglePlay]);

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

  useEffect(() => {
    // A new lesson may use a different format from the previous one.
    setAspectRatio(16 / 9);
    setRotation(0);

    const controller = new AbortController();
    void getIPhoneVideoRotation(videoUrl, controller.signal)
      .then(setRotation)
      .catch(() => {
        // Non-MP4 sources and servers without range support simply play normally.
      });

    return () => controller.abort();
  }, [videoUrl]);

  return (
    <div
      ref={containerRef}
      className={`relative bg-black rounded-lg overflow-hidden group video-player mx-auto ${
        isPortrait ? 'max-w-[480px]' : 'w-full'
      }`}
      style={{ aspectRatio: String(displayAspectRatio) }}
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
          onTimeUpdate={(event) => {
            const playedSeconds = event.currentTarget.currentTime;
            setCurrentTime(playedSeconds);
            handleTimeUpdate(playedSeconds, duration);
          }}
          onDurationChange={(event) => setDuration(event.currentTarget.duration)}
          onLoadedMetadata={(event) => {
            const { videoWidth, videoHeight } = event.currentTarget;
            if (videoWidth > 0 && videoHeight > 0) {
              setAspectRatio(videoWidth / videoHeight);
            }
          }}
          onEnded={() => {
            setIsPlaying(false);
            markComplete(currentTime, duration);
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

      {/* Controls Overlay */}
      <div 
        className="absolute inset-0 z-10" 
        onClick={(e) => {
          if (e.target === e.currentTarget) togglePlay();
        }}
      >
        <div
          className={`absolute inset-0 bg-gradient-to-t from-black/80 via-transparent to-transparent pointer-events-none transition-opacity duration-300 ${showControls || !isPlaying ? 'opacity-100' : 'opacity-0'
            }`}
        >
          {/* Center Play Button */}
          {!isPlaying && (
            <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
              <button
                onClick={(e) => {
                  e.stopPropagation();
                  togglePlay();
                }}
                className="w-20 h-20 bg-white/20 hover:bg-white/30 rounded-full flex items-center justify-center transition-all backdrop-blur-sm pointer-events-auto"
              >
                <Play className="w-10 h-10 text-white ml-1" />
              </button>
            </div>
          )}

          {/* Bottom Controls */}
          <div className="absolute bottom-0 left-0 right-0 p-4 space-y-2 pointer-events-auto">
            {/* Progress Bar */}
            <div
              ref={progressBarRef}
              onClick={handleProgressClick}
              className="w-full h-1 bg-white/30 rounded-full cursor-pointer hover:h-2 transition-all"
            >
              <div
                className="h-full bg-primary-600 rounded-full relative"
                style={{ width: `${progressPercentage}%` }}
              >
                <div className="absolute right-0 top-1/2 -translate-y-1/2 w-3 h-3 bg-white rounded-full opacity-0 group-hover:opacity-100" />
              </div>
            </div>

            {/* Control Buttons */}
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <button onClick={togglePlay} className="text-white hover:text-primary-400">
                  {isPlaying ? <Pause className="w-6 h-6" /> : <Play className="w-6 h-6" />}
                </button>

                <button
                  onClick={() => {
                    if (playerRef.current) playerRef.current.currentTime = 0;
                    if (!isPlaying) togglePlay();
                  }}
                  className="text-white hover:text-primary-400 hidden sm:block"
                  title="Restart"
                >
                  <RotateCcw className="w-5 h-5" />
                </button>

                <button onClick={() => skip(-10)} className="text-white hover:text-primary-400 hidden sm:block">
                  <SkipBack className="w-5 h-5" />
                </button>

                <button onClick={() => skip(10)} className="text-white hover:text-primary-400 hidden sm:block">
                  <SkipForward className="w-5 h-5" />
                </button>

                <button onClick={toggleMute} className="text-white hover:text-primary-400">
                  {isMuted || volume === 0 ? (
                    <VolumeX className="w-5 h-5" />
                  ) : (
                    <Volume2 className="w-5 h-5" />
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
                  className="w-20 hidden sm:block"
                />

                <span className="text-white text-sm font-medium">
                  {formatDuration(currentTime)} / {formatDuration(duration)}
                </span>
              </div>

              <div className="flex items-center gap-3">
                {/* Settings Menu */}
                <div className="relative">
                  <button
                    onClick={() => setShowSettings(!showSettings)}
                    className="text-white hover:text-primary-400"
                  >
                    <Settings className="w-5 h-5" />
                  </button>

                  {showSettings && (
                    <>
                      <div
                        className="fixed inset-0 z-10"
                        onClick={() => setShowSettings(false)}
                      />
                      <div className="absolute bottom-full right-0 mb-2 bg-black/90 rounded-lg p-2 min-w-[150px] z-20">
                        <div className="text-white text-xs font-semibold mb-2 px-2">
                          Playback Speed
                        </div>
                        {[0.5, 0.75, 1, 1.25, 1.5, 2].map((rate) => (
                          <button
                            key={rate}
                            onClick={() => changePlaybackRate(rate)}
                            className={`w-full text-left px-3 py-1.5 rounded text-sm ${playbackRate === rate
                              ? 'bg-primary-600 text-white'
                              : 'text-white/80 hover:bg-white/10'
                              }`}
                          >
                            {rate}x
                          </button>
                        ))}
                      </div>
                    </>
                  )}
                </div>

                <button onClick={toggleFullscreen} className="text-white hover:text-primary-400">
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
