import React, { useEffect, useState, useRef, useCallback } from 'react';
import {
  StyleSheet,
  Text,
  View,
  TouchableOpacity,
  ActivityIndicator,
  ScrollView,
  Dimensions,
  PanResponder,
  Animated,
  Modal,
  Image,
  NativeSyntheticEvent,
  NativeScrollEvent,
} from 'react-native';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
import { ArrowLeft, Scissors, Crop, Clock, Gauge, Type, Download, Plus, Play, Pause, SkipBack, SkipForward, Video, Image as ImageIcon, Layers, X, SplitSquareHorizontal } from 'lucide-react-native';
import { decodeGifFromUri, compositeGifFrames } from '../services/gif/decoder';
import { useVideoPlayer, VideoView } from 'expo-video';
import { useEvent, useEventListener } from 'expo';
import * as FileSystem from 'expo-file-system';
import GifToVideoModule from '../../modules/gif-to-video/src/GifToVideoModule';
import VideoFrameExtractorModule from '../../modules/video-frame-extractor/src/VideoFrameExtractorModule';
import { generateColorMatrix } from '../utils/filterMatrix';
import { DEFAULT_FILTER } from '../constants/filters';
// @ts-ignore
import { GIFEncoder, quantize, applyPalette } from 'gifenc';
import * as ImagePicker from 'expo-image-picker';
import { CropOverlay, CropRect } from '../components/editor/CropOverlay';
import { CropControls, AspectRatioType } from '../components/editor/CropControls';
import { SpeedControls } from '../components/editor/SpeedControls';
import { TextLayer } from '../types/editor';
import { TextOverlay } from '../components/editor/TextOverlay';
import { TextControls } from '../components/editor/TextControls';
import { TextTimelineTrack } from '../components/editor/TextTimelineTrack';
interface GifEditorScreenProps {
  uri: string; // Original GIF URI
  onBack: () => void;
  onExport: (info: any) => void;
}

const { width: SCREEN_WIDTH } = Dimensions.get('window');
// Horizontal padding inside the timeline ScrollView content (matches scrubberOverlay left/right)
const TIMELINE_H_PADDING = 12;
// Viewport width available for the timeline filmstrip
const TIMELINE_VIEWPORT_WIDTH = SCREEN_WIDTH - TIMELINE_H_PADDING * 2;

type TimelineSegment = {
  id: string;
  type: 'video' | 'gif' | 'image';
  uri: string;
  durationMs: number;
  trimStartMs?: number;
  trimEndMs?: number;
  width: number;
  height: number;
  thumbnails: string[];
  crop?: CropRect;
  speed?: number;
};

function getEffectiveDuration(seg: TimelineSegment) {
  const speed = seg.speed ?? 1;
  return ((seg.trimEndMs ?? seg.durationMs) - (seg.trimStartMs ?? 0)) / speed;
}

// 1. The wrapper that converts initial GIF to MP4
export default function GifEditorScreenWrapper({ uri, onBack, onExport }: GifEditorScreenProps) {
  const [initialSegment, setInitialSegment] = useState<TimelineSegment | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [progressText, setProgressText] = useState('Preparing GIF...');

  useEffect(() => {
    let mounted = true;

    async function prepareVideo() {
      try {
        setProgressText('Preparing GIF...');
        const gifInfo = await decodeGifFromUri(uri);

        setProgressText('Converting...');
        await new Promise(resolve => setTimeout(resolve, 50));

        const frames = compositeGifFrames(gifInfo);
        if (frames.length === 0) throw new Error('No frames found in GIF');

        const timestamp = new Date().getTime();
        const outFile = new FileSystem.File(FileSystem.Paths.cache, `editor_temp_${timestamp}.mp4`);
        const outUri = outFile.uri;

        const outWidth = gifInfo.width % 2 !== 0 ? gifInfo.width + 1 : gifInfo.width;
        const outHeight = gifInfo.height % 2 !== 0 ? gifInfo.height + 1 : gifInfo.height;

        await GifToVideoModule.initVideoEncoder(outWidth, outHeight, 30, 2000000, outUri);
        for (let i = 0; i < frames.length; i++) {
          await GifToVideoModule.encodeFrame(frames[i].data, frames[i].delayMs);
        }
        await GifToVideoModule.finishVideoEncoder();
        if (!outFile.exists) throw new Error('Failed to create MP4 file.');

        setProgressText('Extracting Thumbnails...');
        const extracted = await VideoFrameExtractorModule.extractFrames(outUri, 0, gifInfo.durationMs, Math.max(gifInfo.durationMs / 8, 100));
        const thumbnails = extracted.map(f => f.uri);

        if (mounted) {
          setInitialSegment({
            id: `seg_${Date.now()}`,
            type: 'gif',
            uri: outUri, // Converted MP4
            durationMs: gifInfo.durationMs,
            width: outWidth,
            height: outHeight,
            thumbnails,
          });
        }
      } catch (err) {
        if (mounted) setError(err instanceof Error ? err.message : 'Failed to prepare video');
      }
    }
    prepareVideo();
    return () => { mounted = false; };
  }, [uri]);

  const insets = useSafeAreaInsets();

  if (error) {
    return (
      <View style={styles.container}>
        <View style={[styles.centerContainer, { paddingTop: insets.top, paddingBottom: insets.bottom }]}>
          <Text style={styles.errorText}>{error}</Text>
          <TouchableOpacity style={styles.retryButton} onPress={onBack}>
            <Text style={styles.retryButtonText}>Go Back</Text>
          </TouchableOpacity>
        </View>
      </View>
    );
  }

  if (!initialSegment) {
    return (
      <View style={styles.container}>
        <View style={[styles.centerContainer, { paddingTop: insets.top, paddingBottom: insets.bottom }]}>
          <ActivityIndicator size="large" color="#06b6d4" />
          <Text style={styles.loadingText}>{progressText}</Text>
        </View>
      </View>
    );
  }

  return <GifEditorWorkspace initialSegment={initialSegment} onBack={onBack} onExport={onExport} />;
}

// 2. The Video-based Editor Foundation
interface GifEditorWorkspaceProps {
  initialSegment: TimelineSegment;
  onBack: () => void;
  onExport: (info: any) => void;
}

function formatTime(ms: number) {
  const totalMs = Math.max(0, ms);
  const totalSeconds = totalMs / 1000;
  const m = Math.floor(totalSeconds / 60);
  const s = Math.floor(totalSeconds % 60);
  const msPart = Math.floor(totalMs % 1000);
  return `${m.toString().padStart(2, '0')}:${s.toString().padStart(2, '0')}.${msPart.toString().padStart(3, '0')}`;
}

// Playback mode: 'project' = play all segments sequentially, 'segment' = play only selected
type PlaybackMode = 'project' | 'segment';

function GifEditorWorkspace({ initialSegment, onBack, onExport }: GifEditorWorkspaceProps) {
  // â”€â”€ Segment state â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
  const [segments, setSegments] = useState<TimelineSegment[]>([initialSegment]);
  const [activeSegmentIndex, setActiveSegmentIndex] = useState(0);
  const [playbackMode, setPlaybackMode] = useState<PlaybackMode>('project');

  // Refs so event listeners always see latest state (avoid stale closures)
  const segmentsRef = useRef(segments);
  const activeSegmentIndexRef = useRef(activeSegmentIndex);
  const playbackModeRef = useRef(playbackMode);
  useEffect(() => { segmentsRef.current = segments; }, [segments]);
  useEffect(() => { activeSegmentIndexRef.current = activeSegmentIndex; }, [activeSegmentIndex]);
  useEffect(() => { playbackModeRef.current = playbackMode; }, [playbackMode]);

  // â”€â”€ UI state â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
  const [currentTimeSec, setCurrentTimeSec] = useState(0);
  const [isAddingMedia, setIsAddingMedia] = useState(false);
  const [isProcessingMedia, setIsProcessingMedia] = useState(false);
  const [processMsg, setProcessMsg] = useState('');
  const [isTrimming, setIsTrimming] = useState(false);
  const [isCropping, setIsCropping] = useState(false);
  const [isSpeeding, setIsSpeeding] = useState(false);
  const [isEditingText, setIsEditingText] = useState(false);
  const [isDraggingTimeline, setIsDraggingTimeline] = useState(false);
  const [speedState, setSpeedState] = useState(1);
  const [textLayers, setTextLayers] = useState<TextLayer[]>([]);
  const [stickerLayers, setStickerLayers] = useState<StickerLayer[]>([]);
  const [selectedTextLayerId, setSelectedTextLayerId] = useState<string | null>(null);
  const [showTextTimelines, setShowTextTimelines] = useState(false);
  const [cropState, setCropState] = useState<CropRect>({ x: 0, y: 0, width: 1, height: 1 });
  const [cropRatio, setCropRatio] = useState<AspectRatioType>('free');
  const [previewLayout, setPreviewLayout] = useState<{ width: number; height: number } | null>(null);

  const [isExporting, setIsExporting] = useState(false);
  const [exportProgress, setExportProgress] = useState(0);

  const handleExport = async () => {
    setIsExporting(true);
    setExportProgress(0);
    try {
      const intervalMs = 100;
      const gif = GIFEncoder();
      
      let totalFrames = 0;
      for (const seg of segments) {
         const s = seg.speed ?? 1;
         const dur = (seg.trimEndMs ?? seg.durationMs) - (seg.trimStartMs ?? 0);
         totalFrames += Math.floor((dur / s) / intervalMs);
      }
      
      let frameCounter = 0;
      let globalW = 480;
      let globalH = 480;
      let accMs = 0;
      
      for (let i = 0; i < segments.length; i++) {
         const seg = segments[i];
         const speed = seg.speed ?? 1;
         const startMs = seg.trimStartMs ?? 0;
         const endMs = seg.trimEndMs ?? seg.durationMs;
         
         const target = await VideoFrameExtractorModule.beginExtraction(seg.uri, 480, 480);
         
         const crop = seg.crop || { x: 0, y: 0, width: 1, height: 1 };
         let cw = Math.round(target.width * crop.width);
         let ch = Math.round(target.height * crop.height);
         if (cw % 2 !== 0) cw--;
         if (ch % 2 !== 0) ch--;
         cw = Math.max(2, cw);
         ch = Math.max(2, ch);

         if (i === 0) {
             globalW = cw;
             globalH = ch;
         }
         
         for (let t = startMs; t < endMs; t += intervalMs * speed) {
            const globalTimeMs = accMs + ((t - startMs) / speed);
            const activeTextLayers = textLayers.filter(l => globalTimeMs >= l.startMs && globalTimeMs <= l.endMs);
            const activeStickers = stickerLayers.filter(s => frameCounter >= s.startFrame && frameCounter <= s.endFrame);
            
            // Assume we had a filters state. We will just generate the matrix for DEFAULT_FILTER for now,
            // but if the component is updated to have a filters state, it will just replace this variable.
            const currentFilters = DEFAULT_FILTER; // Replace with actual state when UI is implemented
            const matrix = currentFilters.preset !== 'original' || currentFilters.brightness !== 0 
                ? generateColorMatrix(currentFilters) 
                : undefined;

            let options: any = undefined;
            if ((activeTextLayers.length > 0 && previewLayout) || (activeStickers.length > 0 && previewLayout) || matrix) {
              const containerRatio = previewLayout?.width ? previewLayout.width / previewLayout.height : 1;
              const croppedRatio = (target.width * crop.width) / (target.height * crop.height);
              let renderW = target.width, renderH = target.height;
              let videoLeftInContainer = 0, videoTopInContainer = 0;
              
              if (previewLayout) {
                  if (croppedRatio > containerRatio) {
                      renderW = previewLayout.width;
                      renderH = previewLayout.width / croppedRatio;
                  } else {
                      renderH = previewLayout.height;
                      renderW = previewLayout.height * croppedRatio;
                  }
                  videoLeftInContainer = (previewLayout.width - renderW) / 2;
                  videoTopInContainer = (previewLayout.height - renderH) / 2;
              }

              options = {};
              if (matrix) {
                  options.colorMatrix = matrix;
              }
              if ((activeTextLayers.length > 0 || activeStickers.length > 0) && previewLayout) {
                const combinedLayers: any[] = [];
                activeTextLayers.forEach(l => {
                  const layerAbsX = (l.x / 100) * previewLayout.width;
                  const layerAbsY = (l.y / 100) * previewLayout.height;
                  const layerVidX = layerAbsX - videoLeftInContainer;
                  const layerVidY = layerAbsY - videoTopInContainer;
                  
                  const cropVidPctX = (layerVidX / renderW) * 100;
                  const cropVidPctY = (layerVidY / renderH) * 100;
                  
                  const uncroppedPctX = (crop.x * 100) + (cropVidPctX * crop.width);
                  const uncroppedPctY = (crop.y * 100) + (cropVidPctY * crop.height);
                  
                  const exportedFontSize = (l.fontSize * l.scale) * (target.height * crop.height) / renderH;

                  combinedLayers.push({
                    text: l.text,
                    color: l.color,
                    isBold: l.isBold,
                    isItalic: l.isItalic,
                    outlineEnabled: l.outlineEnabled,
                    outlineColor: l.outlineColor,
                    outlineWidth: l.outlineWidth,
                    startMs: 0,
                    endMs: 999999999,
                    x: uncroppedPctX,
                    y: uncroppedPctY,
                    fontSize: exportedFontSize,
                    scale: 1.0,
                    rotation: l.rotation
                  });
                });

                activeStickers.forEach(s => {
                  const layerAbsX = (s.x / 100) * previewLayout.width;
                  const layerAbsY = (s.y / 100) * previewLayout.height;
                  const layerVidX = layerAbsX - videoLeftInContainer;
                  const layerVidY = layerAbsY - videoTopInContainer;
                  
                  const cropVidPctX = (layerVidX / renderW) * 100;
                  const cropVidPctY = (layerVidY / renderH) * 100;
                  
                  const uncroppedPctX = (crop.x * 100) + (cropVidPctX * crop.width);
                  const uncroppedPctY = (crop.y * 100) + (cropVidPctY * crop.height);
                  
                  // Stickers base size
                  const exportedFontSize = (72 * s.scale) * (target.height * crop.height) / renderH;

                  combinedLayers.push({
                    text: s.content,
                    color: '#FFFFFF',
                    startMs: 0,
                    endMs: 999999999,
                    x: uncroppedPctX,
                    y: uncroppedPctY,
                    fontSize: exportedFontSize,
                    scale: 1.0,
                    rotation: s.rotation
                  });
                });

                options.textLayers = combinedLayers;
              }
            }

            let rgba = await VideoFrameExtractorModule.getFrame(Math.round(t), options);
            if (rgba) {
                const cx = Math.round(target.width * crop.x);
                const cy = Math.round(target.height * crop.y);
                const cropped = new Uint8Array(cw * ch * 4);
                
                for (let y = 0; y < ch; y++) {
                    const srcY = cy + y;
                    if (srcY >= target.height) break;
                    const srcIdx = (srcY * target.width + cx) * 4;
                    const dstIdx = y * cw * 4;
                    const copyW = Math.max(0, Math.min(cw, target.width - cx));
                    if (copyW > 0) {
                        cropped.set(rgba.subarray(srcIdx, srcIdx + copyW * 4), dstIdx);
                    }
                }
                rgba = cropped;

                if (cw !== globalW || ch !== globalH) {
                    const canvas = new Uint8Array(globalW * globalH * 4);
                    // Fill with opaque black for safety
                    for (let k = 3; k < canvas.length; k += 4) canvas[k] = 255;
                    
                    const minW = Math.min(cw, globalW);
                    const minH = Math.min(ch, globalH);
                    for (let y = 0; y < minH; y++) {
                        const srcIdx = y * cw * 4;
                        const dstIdx = y * globalW * 4;
                        canvas.set(rgba.subarray(srcIdx, srcIdx + minW * 4), dstIdx);
                    }
                    rgba = canvas;
                }
                
                const palette = quantize(rgba, 256, { format: 'rgba4444' });
                const index = applyPalette(rgba, palette, 'rgba4444');
                gif.writeFrame(index, globalW, globalH, { palette, delay: intervalMs });
            }
            frameCounter++;
            setExportProgress(Math.round((frameCounter / Math.max(1, totalFrames)) * 100));
            await new Promise(r => setTimeout(r, 1));
         }
         await VideoFrameExtractorModule.endExtraction();
         accMs += (endMs - startMs) / speed;
      }
      
      gif.finish();
      const outputBuffer = gif.bytes();
      
      const filename = `edited_gif_${Date.now()}.gif`;
      const fileInfo = new FileSystem.File(FileSystem.Paths.cache, filename);
      await fileInfo.write(outputBuffer);
      
      setIsExporting(false);
      
      onExport({
        uri: fileInfo.uri,
        filename,
        width: globalW,
        height: globalH,
        durationMs: frameCounter * intervalMs,
        sizeBytes: outputBuffer.length
      });
    } catch (e: any) {
      alert("Export failed: " + e.message);
      setIsExporting(false);
      try {
        await VideoFrameExtractorModule.endExtraction();
      } catch (err) {}
    }
  };

  // ── Derived ─────────────────────────────────────────────────────────────────
  const activeSegment = segments[activeSegmentIndex];
  const totalDurationMs = segments.reduce((acc, seg) => acc + getEffectiveDuration(seg), 0);
  const segmentStartMs = segments
    .slice(0, activeSegmentIndex)
    .reduce((acc, seg) => acc + getEffectiveDuration(seg), 0);

  const speed = activeSegment.speed ?? 1;
  const sourceTimePassed = (currentTimeSec * 1000) - (activeSegment.trimStartMs ?? 0);
  const effectiveSegmentTimePassed = sourceTimePassed / speed;

  const clampedSegmentCurrentMs = Math.max(0, Math.min(
    effectiveSegmentTimePassed,
    getEffectiveDuration(activeSegment)
  ));
  let globalCurrentMs = segmentStartMs + clampedSegmentCurrentMs;
  if (playbackMode === 'project' && activeSegmentIndex === segments.length - 1) {
    globalCurrentMs = Math.min(globalCurrentMs, totalDurationMs);
  }

  const rawDisplayCurrentMs = playbackMode === 'segment' ? clampedSegmentCurrentMs : globalCurrentMs;
  const displayTotalMs = playbackMode === 'segment' ? getEffectiveDuration(activeSegment) : totalDurationMs;
  const displayCurrentMs = Math.min(rawDisplayCurrentMs, displayTotalMs);

  // â”€â”€ Single persistent player â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
  // CRITICAL FIX: timeUpdateEventInterval defaults to 0, meaning timeUpdate NEVER fires.
  // Set it to 0.1s so the playhead gets updated every 100ms during playback.
  const player = useVideoPlayer(initialSegment.uri, p => {
    p.loop = false;
    p.timeUpdateEventInterval = 0.1; // â†  this is the root cause fix
  });

  // Play state
  const playingEvent = useEvent(player, 'playingChange', { isPlaying: player.playing });
  const isPlaying = playingEvent?.isPlaying ?? player.playing;

  const switchToSegment = useCallback((newIdx: number, autoPlay: boolean, seekTimeSec: number = 0) => {
    setActiveSegmentIndex(newIdx);
    const seg = segmentsRef.current[newIdx];
    if (seg) {
      player.replace(seg.uri);
      player.playbackRate = seg.speed ?? 1;
      const targetTime = ((seg.trimStartMs ?? 0) / 1000) + seekTimeSec;
      if (targetTime > 0) {
        player.currentTime = targetTime;
      }
      setCurrentTimeSec(targetTime);
      if (autoPlay) {
        player.play();
      } else {
        player.pause();
      }
    }
  }, [player]);

  // â”€â”€ REAL-TIME PLAYHEAD SYNC â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
  // This fires every 100ms while playing, updating React state so the
  // time display and playhead Animated.Value update continuously.
  useEventListener(player, 'timeUpdate', ({ currentTime }) => {
    const seg = segmentsRef.current[activeSegmentIndexRef.current];
    if (!seg) return;
    const maxTime = (seg.trimEndMs ?? seg.durationMs) / 1000;

    if (currentTime >= maxTime) {
      if (playbackModeRef.current === 'project') {
        const segs = segmentsRef.current;
        const nextIdx = activeSegmentIndexRef.current + 1;
        if (nextIdx < segs.length) {
          switchToSegment(nextIdx, true, 0);
        } else {
          setCurrentTimeSec(maxTime);
          player.pause();
        }
      } else {
        setCurrentTimeSec(maxTime);
        player.pause();
      }
    } else {
      setCurrentTimeSec(currentTime);
    }
  });

  // ── Multi-segment project playback ──────────────────────────────────────────
  // When current segment ends in project mode, automatically advance to next.
  useEventListener(player, 'playToEnd', () => {
    const seg = segmentsRef.current[activeSegmentIndexRef.current];
    if (!seg) return;
    const maxTime = (seg.trimEndMs ?? seg.durationMs) / 1000;

    if (playbackModeRef.current === 'segment') {
      player.pause();
      setCurrentTimeSec(maxTime);
      return;
    }
    const segs = segmentsRef.current;
    const nextIdx = activeSegmentIndexRef.current + 1;
    if (nextIdx < segs.length) {
      switchToSegment(nextIdx, true, 0);
    } else {
      player.pause();
      setCurrentTimeSec(maxTime);
    }
  });

  // Reset displayed time when the source changes
  useEventListener(player, 'sourceChange', () => {
    setCurrentTimeSec(0);
  });

  // When activeSegmentIndex changes (user taps a segment or scrub crosses boundary),
  // switch the player source without recreating the player.
  const didMountRef = useRef(false);
  useEffect(() => {
    if (!didMountRef.current) {
      didMountRef.current = true;
      return; // skip initial mount â€” player already loaded initialSegment.uri
    }
    const seg = segmentsRef.current[activeSegmentIndex];
    if (!seg) return;
    player.replace(seg.uri);
    // player.playing state is preserved: if it was playing (project chaining),
    // the playToEnd listener calls player.play() after replace, so we don't
    // need to do it here. If paused (user tap), stay paused.
  }, [activeSegmentIndex]);

  // â”€â”€ Timeline geometry refs â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
  const timelineScrollRef = useRef<ScrollView>(null);
  const scrollOffsetX = useRef(0);
  const timelineContentWidth = useRef(TIMELINE_VIEWPORT_WIDTH);

  // â”€â”€ Playhead animated value (viewport X) â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
  const playheadViewportX = useRef(new Animated.Value(0)).current;

  // Accurate mapping of time to horizontal scroll content pixels
  const getPlayheadContentX = useCallback((currentMs: number, segmentsArray: TimelineSegment[], totalDuration: number) => {
    let playheadContentX = 0;
    let accMs = 0;
    for (let i = 0; i < segmentsArray.length; i++) {
      const seg = segmentsArray[i];
      const effDur = getEffectiveDuration(seg);
      const segWidthPx = Math.max(
        48,
        (effDur / Math.max(totalDuration, 1)) * TIMELINE_VIEWPORT_WIDTH,
      );
      if (currentMs <= accMs + effDur || i === segmentsArray.length - 1) {
        const localMs = Math.max(0, Math.min(currentMs - accMs, effDur));
        playheadContentX += (localMs / Math.max(effDur, 1)) * segWidthPx;
        break;
      }
      playheadContentX += segWidthPx + 6;
      accMs += effDur;
    }
    return playheadContentX;
  }, []);

  // â”€â”€ Scrub state â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
  const isScrubbing = useRef(false);
  const isManualScrolling = useRef(false);
  const scrubStartX = useRef(0);
  const lastSeekTimeRef = useRef(0);

  // Use refs for PanResponder to avoid stale closures
  const globalCurrentMsRef = useRef(globalCurrentMs);
  useEffect(() => { globalCurrentMsRef.current = globalCurrentMs; }, [globalCurrentMs]);
  const totalDurationMsRef = useRef(totalDurationMs);
  useEffect(() => { totalDurationMsRef.current = totalDurationMs; }, [totalDurationMs]);

  // â”€â”€ Sync playhead + auto-scroll from live currentTimeSec â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
  useEffect(() => {
    if (isScrubbing.current) return;
    if (totalDurationMs <= 0) return;

    const playheadContentX = getPlayheadContentX(globalCurrentMs, segments, totalDurationMs);
    const scrollOffset = scrollOffsetX.current;
    const viewportX = playheadContentX - scrollOffset;
    playheadViewportX.setValue(viewportX);

    if (isPlaying && !isManualScrolling.current) {
      const viewportWidth = TIMELINE_VIEWPORT_WIDTH;
      if (viewportX > viewportWidth * 0.75) {
        const contentWidth = timelineContentWidth.current;
        const newScrollOffset = Math.min(
          playheadContentX - viewportWidth * 0.25,
          Math.max(0, contentWidth - viewportWidth),
        );
        if (newScrollOffset > scrollOffset) {
          timelineScrollRef.current?.scrollTo({ x: newScrollOffset, animated: false });
        }
      }
    }
  }, [globalCurrentMs, totalDurationMs, isPlaying, segments, getPlayheadContentX]);

  // â”€â”€ Scrub handler â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
  const handleScrubTo = useCallback((contentX: number) => {
    const safeX = Math.max(0, contentX);
    playheadViewportX.setValue(safeX - scrollOffsetX.current);

    let accMs = 0;
    let accPx = 0;
    let targetGlobalMs = 0;

    for (let i = 0; i < segments.length; i++) {
      const seg = segments[i];
      const effDur = getEffectiveDuration(seg);
      const segWidthPx = Math.max(
        48,
        (effDur / Math.max(totalDurationMs, 1)) * TIMELINE_VIEWPORT_WIDTH,
      );

      if (safeX <= accPx + segWidthPx + 6 || i === segments.length - 1) {
        const localPx = Math.max(0, Math.min(safeX - accPx, segWidthPx));
        targetGlobalMs = accMs + ((localPx / segWidthPx) * effDur);
        break;
      }
      accPx += segWidthPx + 6;
      accMs += effDur;
    }

    targetGlobalMs = Math.min(targetGlobalMs, totalDurationMs);

    let acc = 0;
    for (let i = 0; i < segments.length; i++) {
      const seg = segments[i];
      const effDur = getEffectiveDuration(seg);
      const end = acc + effDur;
      if (targetGlobalMs <= end || i === segments.length - 1) {
        const localMs = Math.max(0, Math.min(targetGlobalMs - acc, effDur));
        const localSec = localMs / 1000;

        if (i !== activeSegmentIndex) {
          switchToSegment(i, false, localSec);
        } else {
          const targetTime = ((seg.trimStartMs ?? 0) / 1000) + localSec;
          const now = Date.now();
          if (now - lastSeekTimeRef.current > 50) {
            player.currentTime = targetTime;
            lastSeekTimeRef.current = now;
          }
          setCurrentTimeSec(targetTime);
        }
        break;
      }
      acc += effDur;
    }
  }, [segments, activeSegmentIndex, totalDurationMs, switchToSegment, player, playheadViewportX]);

  const handleScrubToRef = useRef(handleScrubTo);
  useEffect(() => { handleScrubToRef.current = handleScrubTo; }, [handleScrubTo]);

  const panResponder = useRef(
    PanResponder.create({
      onStartShouldSetPanResponder: () => true,
      onMoveShouldSetPanResponder: () => true,
      onPanResponderGrant: (evt) => {
        isScrubbing.current = true;
        player.pause();
        scrubStartX.current = getPlayheadContentX(globalCurrentMsRef.current, segmentsRef.current, totalDurationMsRef.current);
      },
      onPanResponderMove: (_evt, gestureState) => {
        handleScrubToRef.current(scrubStartX.current + gestureState.dx);
      },
      onPanResponderRelease: (_evt, gestureState) => {
        isScrubbing.current = false;
        lastSeekTimeRef.current = 0;
        handleScrubToRef.current(scrubStartX.current + gestureState.dx);
      },
      onPanResponderTerminate: () => {
        isScrubbing.current = false;
        lastSeekTimeRef.current = 0;
      },
    }),
  ).current;

  // â”€â”€ Play/Pause with restart-at-end behavior â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
  const handlePlayPause = useCallback(() => {
    if (isPlaying) {
      player.pause();
    } else {
      const effDur = getEffectiveDuration(activeSegment);
      const localCurrentSec = currentTimeSec - ((activeSegment.trimStartMs ?? 0) / 1000);
      const atProjectEnd = playbackMode === 'project' && activeSegmentIndex === segments.length - 1 && localCurrentSec >= (effDur / 1000) - 0.05;
      const atSegmentEnd = playbackMode === 'segment' && localCurrentSec >= (effDur / 1000) - 0.05;

      if (atProjectEnd) {
        setPlaybackMode('project');
        switchToSegment(0, true, 0);
      } else if (atSegmentEnd) {
        player.currentTime = (activeSegment.trimStartMs ?? 0) / 1000;
        player.play();
      } else {
        player.play();
      }
    }
  }, [isPlaying, player, playbackMode, currentTimeSec, activeSegment, segments.length, switchToSegment, activeSegmentIndex]);

  // â”€â”€ Delete segment â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
  const handleDeleteSegment = useCallback((sIdx: number) => {
    if (segments.length <= 1) return;

    const newSegments = segments.filter((_, i) => i !== sIdx);
    const newIdx = Math.min(activeSegmentIndex, Math.max(0, newSegments.length - 1));

    setSegments(newSegments);
    setPlaybackMode('project');

    if (newIdx !== activeSegmentIndex || sIdx === activeSegmentIndex) {
      setActiveSegmentIndex(newIdx);
      const seg = newSegments[newIdx];
      if (seg) {
        player.replace(seg.uri);
        player.currentTime = 0;
        player.pause();
      }
      setCurrentTimeSec(0);
    }
  }, [segments, activeSegmentIndex, player]);

  // â”€â”€ Add Media â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
  const handleAddMedia = async (type: 'video' | 'gif' | 'image') => {
    setIsAddingMedia(false);
    setIsProcessingMedia(true);
    setProcessMsg(`Adding ${type}...`);

    try {
      if (type === 'video') {
        const result = await ImagePicker.launchImageLibraryAsync({ mediaTypes: ['videos'], allowsEditing: false });
        if (!result.canceled && result.assets.length > 0) {
          const asset = result.assets[0];
          setProcessMsg('Extracting thumbnails...');
          const extracted = await VideoFrameExtractorModule.extractFrames(
            asset.uri, 0, asset.duration || 1000, Math.max((asset.duration || 1000) / 8, 100),
          );
          setSegments(prev => [...prev, {
            id: `seg_${Date.now()}`,
            type: 'video',
            uri: asset.uri,
            durationMs: asset.duration || 1000,
            width: asset.width,
            height: asset.height,
            thumbnails: extracted.map(f => f.uri),
          }]);
        }
      } else if (type === 'gif') {
        const result = await ImagePicker.launchImageLibraryAsync({ mediaTypes: ['images'], allowsEditing: false });
        if (!result.canceled && result.assets.length > 0) {
          const uri = result.assets[0].uri;
          setProcessMsg('Preparing GIF...');
          const gifInfo = await decodeGifFromUri(uri);
          setProcessMsg('Converting to MP4...');
          await new Promise(r => setTimeout(r, 50));
          const frames = compositeGifFrames(gifInfo);
          const timestamp = new Date().getTime();
          const outFile = new FileSystem.File(FileSystem.Paths.cache, `editor_temp_${timestamp}.mp4`);
          const outWidth = gifInfo.width % 2 !== 0 ? gifInfo.width + 1 : gifInfo.width;
          const outHeight = gifInfo.height % 2 !== 0 ? gifInfo.height + 1 : gifInfo.height;
          await GifToVideoModule.initVideoEncoder(outWidth, outHeight, 30, 2000000, outFile.uri);
          for (let i = 0; i < frames.length; i++) await GifToVideoModule.encodeFrame(frames[i].data, frames[i].delayMs);
          await GifToVideoModule.finishVideoEncoder();
          setProcessMsg('Extracting thumbnails...');
          const extracted = await VideoFrameExtractorModule.extractFrames(outFile.uri, 0, gifInfo.durationMs, Math.max(gifInfo.durationMs / 8, 100));
          setSegments(prev => [...prev, {
            id: `seg_${Date.now()}`,
            type: 'gif',
            uri: outFile.uri,
            durationMs: gifInfo.durationMs,
            width: outWidth,
            height: outHeight,
            thumbnails: extracted.map(f => f.uri),
          }]);
        }
      } else if (type === 'image') {
        const result = await ImagePicker.launchImageLibraryAsync({ mediaTypes: ['images'], allowsEditing: false });
        if (!result.canceled && result.assets.length > 0) {
          const uri = result.assets[0].uri;
          setProcessMsg('Decoding image...');
          const decoded = await VideoFrameExtractorModule.decodeImage(uri, 720, 720);
          setProcessMsg('Creating video segment...');
          await new Promise(r => setTimeout(r, 50));
          const timestamp = new Date().getTime();
          const outFile = new FileSystem.File(FileSystem.Paths.cache, `editor_temp_${timestamp}.mp4`);
          await GifToVideoModule.initVideoEncoder(decoded.width, decoded.height, 30, 2000000, outFile.uri);
          for (let i = 0; i < 30; i++) await GifToVideoModule.encodeFrame(decoded.rgba, 100);
          await GifToVideoModule.finishVideoEncoder();
          setProcessMsg('Extracting thumbnails...');
          const extracted = await VideoFrameExtractorModule.extractFrames(outFile.uri, 0, 3000, 3000 / 8);
          setSegments(prev => [...prev, {
            id: `seg_${Date.now()}`,
            type: 'image',
            uri: outFile.uri,
            durationMs: 3000,
            width: decoded.width,
            height: decoded.height,
            thumbnails: extracted.map(f => f.uri),
          }]);
        }
      }
    } catch (err: any) {
      alert(`Error adding media: ${err.message}`);
    } finally {
      setIsProcessingMedia(false);
    }
  };

  // â”€â”€ Scroll tracking â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
  const handleScroll = useCallback((e: NativeSyntheticEvent<NativeScrollEvent>) => {
    scrollOffsetX.current = e.nativeEvent.contentOffset.x;
    if (!isScrubbing.current && totalDurationMs > 0) {
      const playheadCX = getPlayheadContentX(globalCurrentMs, segments, totalDurationMs);
      playheadViewportX.setValue(playheadCX - e.nativeEvent.contentOffset.x);
    }
  }, [globalCurrentMs, totalDurationMs, segments, getPlayheadContentX]);

  const handleContentSizeChange = useCallback((w: number) => {
    timelineContentWidth.current = w;
  }, []);

  const insets = useSafeAreaInsets();

  return (
    <View style={styles.container}>
      {/* 1. Top bar */}
      <View style={[styles.header, { paddingTop: insets.top + 14 }]}>
        <TouchableOpacity style={styles.headerButton} onPress={onBack}>
          <ArrowLeft color="#f8fafc" size={24} />
        </TouchableOpacity>
        <Text style={styles.title}>GIF Editor</Text>
        <TouchableOpacity style={styles.headerButton} onPress={() => alert('Timeline Zoom â€” coming next')}>
          <Text style={{ color: '#06b6d4', fontWeight: 'bold', fontSize: 16 }}>- O +</Text>
        </TouchableOpacity>
      </View>

      {isProcessingMedia ? (
        <View style={styles.centerContainer}>
          <ActivityIndicator size="large" color="#06b6d4" />
          <Text style={styles.loadingText}>{processMsg}</Text>
        </View>
      ) : (
        <View style={styles.workspace}>
          {/* Main preview */}
          <View style={styles.previewContainer} onLayout={(e) => setPreviewLayout(e.nativeEvent.layout)}>
            {previewLayout && (
              <>
                <CroppedVideoPreview
                  segment={activeSegment}
                  player={player}
                  containerWidth={previewLayout.width}
                  containerHeight={previewLayout.height}
                  isCropping={isCropping}
                  cropState={cropState}
                  onCropChange={setCropState}
                  cropRatio={cropRatio}
                  currentTimeSec={currentTimeSec}
                />
                {isEditingText && (
                  <View style={[StyleSheet.absoluteFill, { backgroundColor: 'rgba(0,0,0,0.6)', zIndex: 1 }]} />
                )}
                <TextOverlay
                  layers={textLayers}
                  currentTimeMs={globalCurrentMs}
                  selectedLayerId={selectedTextLayerId}
                  editable={true}
                  onSelectLayer={(id) => {
                    setSelectedTextLayerId(id);
                    setPlaybackMode('project');
                    setIsTrimming(false);
                    setIsCropping(false);
                    setIsSpeeding(false);
                  }}
                  onDoubleTapLayer={(id) => {
                    setSelectedTextLayerId(id);
                    setIsEditingText(true);
                  }}
                  onUpdateLayer={(updated) => {
                    setTextLayers(prev => prev.map(l => l.id === updated.id ? updated : l));
                  }}
                  onDeleteLayer={(id) => {
                    setTextLayers(prev => prev.filter(l => l.id !== id));
                    if (selectedTextLayerId === id) {
                      setIsEditingText(false);
                      setSelectedTextLayerId(null);
                    }
                  }}
                  containerWidth={previewLayout.width}
                  containerHeight={previewLayout.height}
                />
              </>
            )}
          </View>

          <View style={{ height: 308 + insets.bottom }}>
            {isEditingText && selectedTextLayerId ? (
              <TextControls
                layer={textLayers.find(l => l.id === selectedTextLayerId)!}
                onChange={(updated) => setTextLayers(prev => prev.map(l => l.id === updated.id ? updated : l))}
                onApply={() => setIsEditingText(false)}
                onCancel={() => setIsEditingText(false)}
                fonts={[
                  'Roboto_400Regular', 'Roboto_700Bold', 'Lato_400Regular', 'Oswald_400Regular',
                  'Raleway_400Regular', 'Montserrat_400Regular', 'Poppins_400Regular',
                  'Nunito_400Regular', 'PlayfairDisplay_400Regular', 'Merriweather_400Regular',
                  'Lora_400Regular', 'PTSerif_400Regular', 'DancingScript_400Regular',
                  'Pacifico_400Regular', 'AmaticSC_400Regular', 'Bangers_400Regular',
                  'FjallaOne_400Regular', 'Righteous_400Regular', 'Lobster_400Regular',
                  'AbrilFatface_400Regular', 'Anton_400Regular'
                ]}
                insets={insets}
              />
            ) : isSpeeding ? (
              <SpeedControls
                currentSpeed={speedState}
                onSpeedSelect={(s) => {
                  setSpeedState(s);
                  player.playbackRate = s; // Real-time preview update
                }}
                onApply={() => {
                  setSegments(prev => {
                    const updated = [...prev];
                    updated[activeSegmentIndex] = { ...updated[activeSegmentIndex], speed: speedState };
                    return updated;
                  });
                  setIsSpeeding(false);
                }}
                onCancel={() => {
                  player.playbackRate = activeSegment.speed ?? 1;
                  setIsSpeeding(false);
                }}
                insets={insets}
              />
            ) : isCropping ? (
              <CropControls
                currentRatio={cropRatio}
                onRatioSelect={setCropRatio}
                onApply={() => {
                  setSegments(prev => {
                    const updated = [...prev];
                    updated[activeSegmentIndex] = { ...updated[activeSegmentIndex], crop: cropState };
                    return updated;
                  });
                  setIsCropping(false);
                }}
                onCancel={() => {
                  setIsCropping(false);
                }}
                onReset={() => {
                  setCropState({ x: 0, y: 0, width: 1, height: 1 });
                  setCropRatio('free');
                }}
                insets={insets}
              />
            ) : isTrimming ? (
              <TrimControls
                segment={activeSegment}
                player={player}
                onApply={(startMs: number, endMs: number) => {
                  setSegments(prev => {
                    const updated = [...prev];
                    updated[activeSegmentIndex] = { ...updated[activeSegmentIndex], trimStartMs: startMs, trimEndMs: endMs };
                    return updated;
                  });
                  setIsTrimming(false);
                }}
                onCancel={() => {
                  setIsTrimming(false);
                  player.currentTime = (activeSegment.trimStartMs ?? 0) / 1000;
                }}
                insets={insets}
              />
            ) : (
              <>
                {showTextTimelines && (
                  <View style={styles.trimHeader}>
                    <TouchableOpacity onPress={() => setShowTextTimelines(false)}>
                      <Text style={styles.trimCancel}>Done</Text>
                    </TouchableOpacity>
                    <Text style={styles.trimTitle}>Text Timing</Text>
                    <View style={{ width: 40 }} />
                  </View>
                )}

                {!showTextTimelines && (
                  <View style={styles.controlsRow}>
                    <Text style={styles.timeText}>
                      {formatTime(displayCurrentMs)} / {formatTime(displayTotalMs)}
                    </Text>
                    <View style={styles.playbackControls}>
                      <TouchableOpacity
                        onPress={() => { player.currentTime = 0; setCurrentTimeSec(0); }}
                        style={styles.playBtn}
                      >
                        <SkipBack color="#f8fafc" size={20} />
                      </TouchableOpacity>
                      <TouchableOpacity onPress={handlePlayPause} style={styles.playBtnMain}>
                        {isPlaying
                          ? <Pause color="#09090b" size={24} fill="#09090b" />
                          : <Play color="#09090b" size={24} fill="#09090b" />}
                      </TouchableOpacity>
                      <TouchableOpacity
                        onPress={() => { player.currentTime = getEffectiveDuration(activeSegment) / 1000; }}
                        style={styles.playBtn}
                      >
                        <SkipForward color="#f8fafc" size={20} />
                      </TouchableOpacity>
                    </View>
                    <View style={{ flexDirection: 'row', gap: 12, alignItems: 'center' }}>
                      {(activeSegment.speed && activeSegment.speed !== 1) ? (
                        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 4 }}>
                          <Gauge size={14} color="#06b6d4" />
                          <Text style={{ color: '#06b6d4', fontSize: 12, fontWeight: 'bold' }}>{activeSegment.speed}×</Text>
                        </View>
                      ) : (
                        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 4 }}>
                          <Gauge size={14} color="#a1a1aa" />
                          <Text style={styles.infoText}>1.0×</Text>
                        </View>
                      )}
                      <Text style={styles.infoText}>{activeSegment.width}×{activeSegment.height}</Text>
                    </View>
                  </View>

                )}

                {/* 4. Timeline */}
                <View style={[styles.timelineContainer, showTextTimelines && { flex: 1, height: undefined, borderBottomWidth: 0, backgroundColor: '#09090b' }]}>
                  <ScrollView
                    ref={timelineScrollRef}
                    horizontal
                    scrollEnabled={!isDraggingTimeline}
                    showsHorizontalScrollIndicator={false}
                    contentContainerStyle={[styles.timelineContent, { flexDirection: 'column', alignItems: 'flex-start' }]}
                    scrollEventThrottle={16}
                    onScroll={handleScroll}
                    onScrollBeginDrag={() => { isManualScrolling.current = true; }}
                    onScrollEndDrag={() => { isManualScrolling.current = false; }}
                    onMomentumScrollBegin={() => { isManualScrolling.current = true; }}
                    onMomentumScrollEnd={() => { isManualScrolling.current = false; }}
                    onContentSizeChange={handleContentSizeChange}
                  >
                    <View style={{ flexDirection: 'row', alignItems: 'center', height: 60 }}>
                      {segments.map((seg, sIdx) => {
                        const isActive = playbackMode === 'segment' && sIdx === activeSegmentIndex;
                        const effDur = getEffectiveDuration(seg);
                        const segWidthPx = Math.max(
                          48,
                          (effDur / Math.max(totalDurationMs, 1)) * TIMELINE_VIEWPORT_WIDTH,
                        );

                        // Calculate which thumbnails to show based on trimmed duration
                        const timePerThumb = seg.durationMs / Math.max(1, seg.thumbnails.length);
                        const startIndex = Math.floor((seg.trimStartMs ?? 0) / timePerThumb);
                        const endIndex = Math.ceil((seg.trimEndMs ?? seg.durationMs) / timePerThumb);
                        let visibleThumbnails = seg.thumbnails.slice(startIndex, endIndex);
                        if (visibleThumbnails.length === 0 && seg.thumbnails.length > 0) {
                          visibleThumbnails = [seg.thumbnails[Math.min(startIndex, seg.thumbnails.length - 1)]];
                        }
                        return (
                          <View key={seg.id} style={[styles.segmentWrapper, { width: segWidthPx }]}>
                            <TouchableOpacity
                              style={[
                                styles.segmentContainer,
                                { width: '100%' },
                                isActive && styles.segmentActive,
                              ]}
                              onPress={() => {
                                if (isActive && playbackMode === 'segment') {
                                  // Deselect segment, return to project mode
                                  setPlaybackMode('project');
                                } else {
                                  // Enter segment mode â€” preview the segment, stay paused
                                  setPlaybackMode('segment');
                                  if (!isActive) {
                                    switchToSegment(sIdx, false, 0);
                                  } else {
                                    player.pause();
                                  }
                                }
                              }}
                            >
                              {visibleThumbnails.map((t, idx) => {
                                const crop = seg.crop || { x: 0, y: 0, width: 1, height: 1 };
                                const imgW = 100 / crop.width;
                                const imgH = 100 / crop.height;
                                const imgL = -(crop.x / crop.width) * 100;
                                const imgT = -(crop.y / crop.height) * 100;
                                return (
                                  <View key={idx} style={{ flex: 1, height: '100%', overflow: 'hidden' }}>
                                    <Image
                                      source={{ uri: t }}
                                      style={{
                                        position: 'absolute',
                                        width: `${imgW}%`,
                                        height: `${imgH}%`,
                                        left: `${imgL}%`,
                                        top: `${imgT}%`,
                                        resizeMode: 'stretch'
                                      }}
                                    />
                                  </View>
                                );
                              })}
                            </TouchableOpacity>
                            {/* Small Ã— delete button â€” shown only on selected segment */}
                            {isActive && segments.length > 1 && (
                              <TouchableOpacity
                                style={styles.deleteSegmentBtn}
                                onPress={() => handleDeleteSegment(sIdx)}
                                hitSlop={{ top: 6, right: 6, bottom: 6, left: 6 }}
                              >
                                <X color="#fff" size={10} />
                              </TouchableOpacity>
                            )}
                          </View>
                        );
                      })}
                    </View>

                    {/* Text Tracks (Now inside the horizontal ScrollView) */}
                    {showTextTimelines && textLayers.length > 0 && (
                      <View style={{ marginTop: 24, width: segments.reduce((sum, seg) => sum + Math.max(48, (getEffectiveDuration(seg) / Math.max(totalDurationMs, 1)) * TIMELINE_VIEWPORT_WIDTH), 0) }}>
                        {textLayers.map((layer) => {
                          const isSelected = selectedTextLayerId === layer.id;
                          const videoRowWidth = segments.reduce((sum, seg) => sum + Math.max(48, (getEffectiveDuration(seg) / Math.max(totalDurationMs, 1)) * TIMELINE_VIEWPORT_WIDTH), 0);
                          return (
                            <TextTimelineTrack
                              key={layer.id}
                              layer={layer}
                              isSelected={isSelected}
                              onSelect={() => {
                                setSelectedTextLayerId(layer.id);
                              }}
                              onUpdateTiming={(startMs, endMs) => {
                                setTextLayers(prev => prev.map(l => l.id === layer.id ? { ...l, startMs, endMs } : l));
                              }}
                              onDragStart={() => setIsDraggingTimeline(true)}
                              onDragEnd={() => setIsDraggingTimeline(false)}
                              totalDurationMs={totalDurationMs}
                              timelineWidth={videoRowWidth}
                            />
                          );
                        })}
                      </View>
                    )}
                  </ScrollView>

                  {/* Playhead overlay in viewport space */}
                  <View style={styles.scrubberOverlay} pointerEvents="box-none">
                    <Animated.View
                      style={[styles.playhead, { transform: [{ translateX: playheadViewportX }] }]}
                      {...panResponder.panHandlers}
                    >
                      <View style={styles.playheadKnob} />
                      <View style={styles.playheadLine} />
                    </Animated.View>
                  </View>
                </View>

                {!showTextTimelines && (
                  <>
                    {/* 5. Editing toolbar */}
                    <View style={styles.toolbarContainer}>
                      <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.toolbarContent}>
                        {([
                          { id: 'trim', name: 'Trim', icon: Scissors },
                          { id: 'split', name: 'Split', icon: SplitSquareHorizontal },
                          { id: 'crop', name: 'Crop', icon: Crop },
                          { id: 'speed', name: 'Speed', icon: Clock },
                          { id: 'text', name: 'Text', icon: Type },
                          { id: 'text_timing', name: 'Text Timing', icon: Layers },
                        ] as const).map(tool => (
                          <TouchableOpacity key={tool.id} style={styles.toolButton} onPress={() => {
                            if (tool.id === 'trim') {
                              if (playbackMode !== 'segment') {
                                alert('Please select a segment in the timeline first.');
                                return;
                              }
                              setIsTrimming(true);
                            } else if (tool.id === 'split') {
                              const activeSegment = segments[activeSegmentIndex];
                              const splitMs = currentTimeSec * 1000;
                              const startMs = activeSegment.trimStartMs ?? 0;
                              const endMs = activeSegment.trimEndMs ?? activeSegment.durationMs;
                              if (splitMs - startMs < 50 || endMs - splitMs < 50) {
                                alert('Cannot split so close to the edge of the segment.');
                                return;
                              }

                              const segA = { ...activeSegment, id: `${activeSegment.id}_a_${Date.now()}`, trimEndMs: splitMs };
                              const segB = { ...activeSegment, id: `${activeSegment.id}_b_${Date.now()}`, trimStartMs: splitMs };
                              
                              setSegments(prev => {
                                const newSegments = [...prev];
                                newSegments.splice(activeSegmentIndex, 1, segA, segB);
                                return newSegments;
                              });
                              
                              setPlaybackMode('project');
                              switchToSegment(activeSegmentIndex + 1, false, 0);
                            } else if (tool.id === 'crop') {
                              if (playbackMode !== 'segment') {
                                alert('Please select a segment in the timeline first.');
                                return;
                              }
                              player.pause();
                              setCropState(activeSegment.crop || { x: 0, y: 0, width: 1, height: 1 });
                              setCropRatio('free');
                              setIsCropping(true);
                            } else if (tool.id === 'speed') {
                              if (playbackMode !== 'segment') {
                                alert('Please select a segment in the timeline first.');
                                return;
                              }
                              setSpeedState(activeSegment.speed ?? 1);
                              setIsSpeeding(true);
                            } else if (tool.id === 'text') {
                              if (textLayers.length >= 5) {
                                alert('You can only add up to 5 text boxes.');
                                return;
                              }
                              setPlaybackMode('project');
                              player.pause();
                              const newId = `text-${Date.now()}`;
                              const start = 0;
                              const end = totalDurationMs;
                              const newLayer: TextLayer = {
                                id: newId,
                                text: 'Your text',
                                startMs: start,
                                endMs: end,
                                x: 50, y: 50, scale: 1, rotation: 0, opacity: 1,
                                fontFamily: 'sans-serif', fontSize: 48, isBold: true, isItalic: false, color: '#ffffff',
                                outlineEnabled: false, outlineColor: '#000000', outlineWidth: 2,
                                shadowEnabled: true, shadowColor: '#000000', shadowOpacity: 0.8, shadowBlur: 4, shadowOffsetX: 2, shadowOffsetY: 2,
                                backgroundEnabled: false, backgroundColor: '#000000', backgroundOpacity: 0.5, backgroundPadding: 8,
                                textAlign: 'center', zIndex: textLayers.length + 1
                              };
                              setTextLayers(prev => [...prev, newLayer]);
                              setSelectedTextLayerId(newId);
                              setIsEditingText(true);
                              setShowTextTimelines(true);
                            } else if (tool.id === 'text_timing') {
                              if (textLayers.length === 0) {
                                alert('Add some text first to adjust timing.');
                                return;
                              }
                              setShowTextTimelines(prev => !prev);
                            } else {
                              alert(`${(tool as any).name} — coming next`);
                            }
                          }}>
                            <View style={styles.toolIconContainer}><tool.icon size={24} color="#f8fafc" /></View>
                            <Text style={styles.toolText}>{(tool as any).name}</Text>
                          </TouchableOpacity>
                        ))}
                      </ScrollView>
                    </View>

                    {/* 6. Export footer */}
                    <View style={[styles.footerContainer, { paddingBottom: insets.bottom + 12 }]}>
                      <TouchableOpacity style={styles.addMediaFooterBtn} onPress={() => setIsAddingMedia(true)}>
                        <Plus size={20} color="#06b6d4" style={{ marginRight: 6 }} />
                        <Text style={styles.addMediaFooterText}>Add Media</Text>
                      </TouchableOpacity>

                      <TouchableOpacity
                        style={styles.exportButton}
                        onPress={handleExport}
                      >
                        <Download size={20} color="#ffffff" style={{ marginRight: 6 }} />
                        <Text style={styles.exportButtonText}>Export</Text>
                      </TouchableOpacity>
                    </View>
                  </>
                )}
              </>
            )}
          </View>
        </View>
      )}

      {/* Add Media Bottom Sheet Modal */}
      <Modal visible={isAddingMedia} transparent animationType="slide">
        <View style={styles.modalOverlay}>
          <View style={styles.bottomSheet}>
            <Text style={styles.sheetTitle}>Add Media</Text>

            <TouchableOpacity style={styles.sheetAction} onPress={() => handleAddMedia('video')}>
              <Video color="#8b5cf6" size={24} />
              <Text style={styles.sheetActionText}>Video</Text>
            </TouchableOpacity>

            <TouchableOpacity style={styles.sheetAction} onPress={() => handleAddMedia('gif')}>
              <Layers color="#06b6d4" size={24} />
              <Text style={styles.sheetActionText}>GIF</Text>
            </TouchableOpacity>

            <TouchableOpacity style={styles.sheetAction} onPress={() => handleAddMedia('image')}>
              <ImageIcon color="#10b981" size={24} />
              <Text style={styles.sheetActionText}>Image</Text>
            </TouchableOpacity>

            <TouchableOpacity style={styles.sheetCancel} onPress={() => setIsAddingMedia(false)}>
              <Text style={styles.sheetCancelText}>Cancel</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>

      {/* Exporting Modal */}
      <Modal visible={isExporting} transparent animationType="fade">
        <View style={styles.modalOverlay}>
          <View style={[styles.bottomSheet, { alignItems: 'center', justifyContent: 'center' }]}>
            <ActivityIndicator size="large" color="#06b6d4" />
            <Text style={[styles.sheetTitle, { marginTop: 16 }]}>Exporting GIF... {exportProgress}%</Text>
          </View>
        </View>
      </Modal>
    </View>
  );
}

function CroppedVideoPreview({ segment, player, containerWidth, containerHeight, isCropping, cropState, onCropChange, cropRatio, currentTimeSec }: any) {
  const statusEvent = useEvent(player, 'statusChange', { status: player.status, error: null });
  const isReady = statusEvent?.status === 'readyToPlay';

  let thumbnailUri = segment.thumbnails?.[0];
  if (currentTimeSec !== undefined && segment.thumbnails?.length > 0) {
    const localSec = currentTimeSec - ((segment.trimStartMs ?? 0) / 1000);
    const totalSegSec = segment.durationMs / 1000;
    const thumbIndex = Math.max(0, Math.min(
      Math.floor((localSec / totalSegSec) * segment.thumbnails.length),
      segment.thumbnails.length - 1
    ));
    thumbnailUri = segment.thumbnails[thumbIndex];
  }

  const videoRatio = segment.width / segment.height;
  const containerRatio = containerWidth / containerHeight;

  if (isCropping) {
    let fullRenderW, fullRenderH;
    if (videoRatio > containerRatio) {
      fullRenderW = containerWidth;
      fullRenderH = containerWidth / videoRatio;
    } else {
      fullRenderH = containerHeight;
      fullRenderW = containerHeight * videoRatio;
    }

    let numericRatio: number | null = null;
    if (cropRatio !== 'free' && cropRatio !== 'original') {
      const [w, h] = cropRatio.split(':').map(Number);
      numericRatio = w / h;
    } else if (cropRatio === 'original') {
      numericRatio = videoRatio;
    }

    return (
      <View style={{ width: fullRenderW, height: fullRenderH, overflow: 'hidden' }}>
        <VideoView player={player} style={{ width: '100%', height: '100%' }} contentFit="fill" nativeControls={false} />
        {!isReady && thumbnailUri && (
          <Image source={{ uri: thumbnailUri }} style={[StyleSheet.absoluteFill, { resizeMode: 'stretch' }]} />
        )}
        <CropOverlay initialCrop={cropState} onChange={onCropChange} width={fullRenderW} height={fullRenderH} aspectRatio={numericRatio} />
      </View>
    );
  }

  const crop = segment.crop || { x: 0, y: 0, width: 1, height: 1 };
  const croppedWidth = segment.width * crop.width;
  const croppedHeight = segment.height * crop.height;
  const croppedRatio = croppedWidth / croppedHeight;

  let renderW, renderH;
  if (croppedRatio > containerRatio) {
    renderW = containerWidth;
    renderH = containerWidth / croppedRatio;
  } else {
    renderH = containerHeight;
    renderW = containerHeight * croppedRatio;
  }

  const fullVideoW = renderW / crop.width;
  const fullVideoH = renderH / crop.height;
  const leftOffset = -crop.x * fullVideoW;
  const topOffset = -crop.y * fullVideoH;

  return (
    <View style={{ width: renderW, height: renderH, overflow: 'hidden' }}>
      <VideoView
        player={player}
        style={{ position: 'absolute', left: leftOffset, top: topOffset, width: fullVideoW, height: fullVideoH }}
        contentFit="fill"
        nativeControls={false}
      />
      {!isReady && thumbnailUri && (
        <Image
          source={{ uri: thumbnailUri }}
          style={{ position: 'absolute', left: leftOffset, top: topOffset, width: fullVideoW, height: fullVideoH, resizeMode: 'stretch' }}
        />
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#09090b' },
  header: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    paddingHorizontal: 16, paddingVertical: 14,
    borderBottomWidth: 1, borderBottomColor: '#27272a',
  },
  headerButton: { padding: 8 },
  title: { fontSize: 18, fontWeight: '600', color: '#f8fafc', letterSpacing: 0.5 },
  centerContainer: { flex: 1, justifyContent: 'center', alignItems: 'center', padding: 24 },
  loadingText: { color: '#a1a1aa', marginTop: 16, fontSize: 16 },
  errorText: { color: '#ef4444', fontSize: 16, textAlign: 'center', marginBottom: 24 },
  retryButton: { paddingHorizontal: 24, paddingVertical: 12, backgroundColor: '#27272a', borderRadius: 8 },
  retryButtonText: { color: '#f8fafc', fontSize: 16, fontWeight: '500' },

  workspace: { flex: 1, flexDirection: 'column', overflow: 'hidden' },

  previewContainer: {
    flex: 1, width: '100%',
    justifyContent: 'center', alignItems: 'center',
    backgroundColor: '#000000',
  },
  previewVideo: { width: '100%', height: '100%' },

  controlsRow: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    paddingHorizontal: 12, paddingVertical: 10,
    backgroundColor: '#09090b',
  },
  timeText: { color: '#f8fafc', fontSize: 13, fontWeight: '600', fontVariant: ['tabular-nums'], flexShrink: 1 },
  infoText: { color: '#a1a1aa', fontSize: 12, fontWeight: '500' },
  playbackControls: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  playBtn: { padding: 6 },
  playBtnMain: { width: 38, height: 38, borderRadius: 19, backgroundColor: '#06b6d4', justifyContent: 'center', alignItems: 'center' },

  timelineContainer: {
    height: 96,
    borderBottomWidth: 1, borderBottomColor: '#27272a',
    backgroundColor: '#0f0f11',
    overflow: 'hidden',
  },
  timelineContent: {
    flexDirection: 'row',
    paddingHorizontal: TIMELINE_H_PADDING,
    paddingVertical: 8,
    alignItems: 'center',
    minWidth: '100%',
  },

  // Segment wrapper â€” needed so the delete button can be absolute-positioned over the segment
  segmentWrapper: {
    position: 'relative',
    marginRight: 6,
  },
  segmentContainer: {
    flexDirection: 'row', height: 60,
    borderRadius: 8, overflow: 'hidden',
    borderWidth: 2, borderColor: '#334155',
    backgroundColor: '#18181b',
  },
  segmentActive: { borderColor: '#8b5cf6' },
  thumbnail: { flex: 1, height: '100%', resizeMode: 'cover' },

  // Small Ã— delete button â€” top-right corner of selected segment
  deleteSegmentBtn: {
    position: 'absolute',
    top: -6, right: -6,
    width: 18, height: 18,
    borderRadius: 9,
    backgroundColor: '#ef4444',
    justifyContent: 'center',
    alignItems: 'center',
    zIndex: 10,
  },

  scrubberOverlay: {
    position: 'absolute',
    top: 8, bottom: 8,
    left: TIMELINE_H_PADDING, right: TIMELINE_H_PADDING,
  },
  playhead: { position: 'absolute', top: 0, bottom: 0, width: 40, marginLeft: -20, alignItems: 'center' },
  playheadKnob: { width: 14, height: 16, borderRadius: 3, backgroundColor: '#ff0000', marginBottom: 2 },
  playheadLine: { width: 2, flex: 1, backgroundColor: '#ff0000' },

  toolbarContainer: { height: 82, backgroundColor: '#09090b' },
  toolbarContent: { paddingHorizontal: 16, paddingVertical: 12, gap: 20, alignItems: 'center' },
  toolButton: { alignItems: 'center', gap: 6 },
  toolIconContainer: { width: 42, height: 42, borderRadius: 21, backgroundColor: '#18181b', justifyContent: 'center', alignItems: 'center' },
  toolText: { color: '#a1a1aa', fontSize: 11, fontWeight: '500' },

  footerContainer: { flexDirection: 'row', gap: 12, paddingHorizontal: 20, paddingBottom: 12, paddingTop: 12, backgroundColor: '#09090b' },
  addMediaFooterBtn: { flex: 1, flexDirection: 'row', backgroundColor: '#18181b', borderWidth: 1, borderColor: '#27272a', paddingVertical: 14, borderRadius: 100, justifyContent: 'center', alignItems: 'center' },
  addMediaFooterText: { color: '#06b6d4', fontSize: 16, fontWeight: 'bold' },
  exportButton: { flex: 1, flexDirection: 'row', backgroundColor: '#8b5cf6', paddingVertical: 14, borderRadius: 100, justifyContent: 'center', alignItems: 'center' },
  exportButtonText: { color: '#ffffff', fontSize: 16, fontWeight: 'bold' },

  modalOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.6)', justifyContent: 'flex-end' },
  bottomSheet: { backgroundColor: '#18181b', borderTopLeftRadius: 24, borderTopRightRadius: 24, padding: 24, paddingBottom: 40 },
  sheetTitle: { color: '#f8fafc', fontSize: 20, fontWeight: 'bold', marginBottom: 24, textAlign: 'center' },
  sheetAction: { flexDirection: 'row', alignItems: 'center', backgroundColor: '#27272a', padding: 16, borderRadius: 16, marginBottom: 12, gap: 16 },
  sheetActionText: { color: '#f8fafc', fontSize: 16, fontWeight: '600' },
  sheetCancel: { marginTop: 8, padding: 16, alignItems: 'center' },
  sheetCancelText: { color: '#a1a1aa', fontSize: 16, fontWeight: '600' },

  trimContainer: { flex: 1, backgroundColor: '#09090b', borderTopWidth: 1, borderColor: '#27272a', justifyContent: 'space-between', paddingTop: 16 },
  trimHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', padding: 16 },
  trimTitle: { color: '#f8fafc', fontSize: 16, fontWeight: 'bold' },
  trimCancel: { color: '#a1a1aa', fontSize: 16 },
  trimApply: { color: '#06b6d4', fontSize: 16, fontWeight: 'bold' },
  trimInfo: { flexDirection: 'row', justifyContent: 'space-around', marginBottom: 16 },
  trimTimeText: { color: '#f8fafc', fontSize: 13, fontVariant: ['tabular-nums'] },
  trimPlayRow: { alignItems: 'center', marginBottom: 16 },
  trimTrackContainer: { height: 60, marginHorizontal: 20, position: 'relative', backgroundColor: '#18181b', borderRadius: 8, overflow: 'hidden' },
  trimThumbnails: { flexDirection: 'row', width: '100%', height: '100%' },
  trimThumb: { flex: 1, height: '100%', resizeMode: 'cover' },
  trimDim: { position: 'absolute', top: 0, bottom: 0, backgroundColor: 'rgba(0,0,0,0.6)' },
  trimBorder: { position: 'absolute', top: 0, bottom: 0, borderWidth: 2, borderColor: '#06b6d4' },
  trimPlayhead: { position: 'absolute', top: -5, bottom: -5, width: 2, backgroundColor: '#ff0000', marginLeft: -1 },
  trimHandle: { position: 'absolute', top: 0, bottom: 0, width: 20, justifyContent: 'center', alignItems: 'center', backgroundColor: '#06b6d4', zIndex: 10 },
  trimHandleInner: { width: 2, height: 20, backgroundColor: '#09090b', borderRadius: 1 },
});

function TrimControls({ segment, player, onApply, onCancel, insets }: any) {
  const [startMs, setStartMs] = useState(segment.trimStartMs ?? 0);
  const [endMs, setEndMs] = useState(segment.trimEndMs ?? segment.durationMs);

  const [currentMs, setCurrentMs] = useState(startMs);
  const lastSeekTimeRef = useRef(0);

  const startMsRef = useRef(startMs);
  useEffect(() => { startMsRef.current = startMs; }, [startMs]);
  const endMsRef = useRef(endMs);
  useEffect(() => { endMsRef.current = endMs; }, [endMs]);

  useEffect(() => {
    player.pause();
    player.currentTime = startMs / 1000;
  }, []);

  useEventListener(player, 'timeUpdate', ({ currentTime }) => {
    const cMs = currentTime * 1000;
    if (cMs >= endMsRef.current) {
      player.pause();
      setCurrentMs(endMsRef.current);
    } else {
      setCurrentMs(cMs);
    }
  });

  const playingEvent = useEvent(player, 'playingChange', { isPlaying: player.playing });
  const isPlaying = playingEvent?.isPlaying ?? player.playing;

  const handlePlayPause = () => {
    if (isPlaying) {
      player.pause();
    } else {
      if (currentMs >= endMs - 50) {
        player.currentTime = startMs / 1000;
        setCurrentMs(startMs);
      }
      player.play();
    }
  };

  const [trackWidth, setTrackWidth] = useState(0);
  const trackWidthRef = useRef(trackWidth);
  useEffect(() => { trackWidthRef.current = trackWidth; }, [trackWidth]);

  const msToPx = (ms: number) => trackWidthRef.current > 0 ? (ms / segment.durationMs) * trackWidthRef.current : 0;
  const getMsFromPx = (px: number) => trackWidthRef.current > 0 ? Math.max(0, Math.min((px / trackWidthRef.current) * segment.durationMs, segment.durationMs)) : 0;

  const startPx = msToPx(startMs);
  const endPx = msToPx(endMs);
  const currentPx = msToPx(currentMs);

  const leftPanStartRef = useRef(0);
  const leftResponder = useRef(PanResponder.create({
    onStartShouldSetPanResponder: () => true,
    onPanResponderGrant: () => {
      player.pause();
      leftPanStartRef.current = startMsRef.current;
    },
    onPanResponderMove: (e, g) => {
      const deltaMs = trackWidthRef.current > 0 ? (g.dx / trackWidthRef.current) * segment.durationMs : 0;
      let newStart = leftPanStartRef.current + deltaMs;
      newStart = Math.max(0, Math.min(newStart, endMsRef.current - 100));
      setStartMs(newStart);
      setCurrentMs(newStart);
      const now = Date.now();
      if (now - lastSeekTimeRef.current > 50) {
        player.currentTime = newStart / 1000;
        lastSeekTimeRef.current = now;
      }
    },
    onPanResponderRelease: (e, g) => {
      const deltaMs = trackWidthRef.current > 0 ? (g.dx / trackWidthRef.current) * segment.durationMs : 0;
      let newStart = leftPanStartRef.current + deltaMs;
      newStart = Math.max(0, Math.min(newStart, endMsRef.current - 100));
      player.currentTime = newStart / 1000;
      lastSeekTimeRef.current = 0;
    }
  })).current;

  const rightPanStartRef = useRef(0);
  const rightResponder = useRef(PanResponder.create({
    onStartShouldSetPanResponder: () => true,
    onPanResponderGrant: () => {
      player.pause();
      rightPanStartRef.current = endMsRef.current;
    },
    onPanResponderMove: (e, g) => {
      const deltaMs = trackWidthRef.current > 0 ? (g.dx / trackWidthRef.current) * segment.durationMs : 0;
      let newEnd = rightPanStartRef.current + deltaMs;
      newEnd = Math.max(startMsRef.current + 100, Math.min(newEnd, segment.durationMs));
      setEndMs(newEnd);
      setCurrentMs(newEnd);
      const now = Date.now();
      if (now - lastSeekTimeRef.current > 50) {
        player.currentTime = newEnd / 1000;
        lastSeekTimeRef.current = now;
      }
    },
    onPanResponderRelease: (e, g) => {
      const deltaMs = trackWidthRef.current > 0 ? (g.dx / trackWidthRef.current) * segment.durationMs : 0;
      let newEnd = rightPanStartRef.current + deltaMs;
      newEnd = Math.max(startMsRef.current + 100, Math.min(newEnd, segment.durationMs));
      player.currentTime = newEnd / 1000;
      lastSeekTimeRef.current = 0;
    }
  })).current;

  const trackPanStartRef = useRef(0);
  const trackResponder = useRef(PanResponder.create({
    onStartShouldSetPanResponder: (e) => true,
    onPanResponderGrant: (e) => {
      player.pause();
      const newMs = getMsFromPx(e.nativeEvent.locationX);
      trackPanStartRef.current = newMs;
      const clampedMs = Math.max(startMsRef.current, Math.min(newMs, endMsRef.current));
      setCurrentMs(clampedMs);
      player.currentTime = clampedMs / 1000;
    },
    onPanResponderMove: (e, g) => {
      const deltaMs = trackWidthRef.current > 0 ? (g.dx / trackWidthRef.current) * segment.durationMs : 0;
      let newMs = trackPanStartRef.current + deltaMs;
      newMs = Math.max(startMsRef.current, Math.min(newMs, endMsRef.current));
      setCurrentMs(newMs);
      const now = Date.now();
      if (now - lastSeekTimeRef.current > 50) {
        player.currentTime = newMs / 1000;
        lastSeekTimeRef.current = now;
      }
    },
    onPanResponderRelease: (e, g) => {
      const deltaMs = trackWidthRef.current > 0 ? (g.dx / trackWidthRef.current) * segment.durationMs : 0;
      let newMs = trackPanStartRef.current + deltaMs;
      newMs = Math.max(startMsRef.current, Math.min(newMs, endMsRef.current));
      player.currentTime = newMs / 1000;
      lastSeekTimeRef.current = 0;
    }
  })).current;

  return (
    <View style={[styles.trimContainer, { paddingBottom: insets.bottom + 12 }]}>
      <View style={styles.trimHeader}>
        <TouchableOpacity onPress={onCancel}><Text style={styles.trimCancel}>Cancel</Text></TouchableOpacity>
        <Text style={styles.trimTitle}>Trim</Text>
        <TouchableOpacity onPress={() => onApply(startMs, endMs)}><Text style={styles.trimApply}>Apply</Text></TouchableOpacity>
      </View>
      <View style={styles.trimInfo}>
        <Text style={styles.trimTimeText}>Start: {formatTime(startMs)}</Text>
        <Text style={styles.trimTimeText}>End: {formatTime(endMs)}</Text>
        <Text style={styles.trimTimeText}>Duration: {formatTime(endMs - startMs)}</Text>
      </View>
      <View style={styles.trimPlayRow}>
        <TouchableOpacity onPress={handlePlayPause} style={styles.playBtnMain}>
          {isPlaying ? <Pause color="#09090b" size={24} fill="#09090b" /> : <Play color="#09090b" size={24} fill="#09090b" />}
        </TouchableOpacity>
      </View>
      <View style={styles.trimTrackContainer} onLayout={(e) => setTrackWidth(e.nativeEvent.layout.width)}>
        <View style={styles.trimThumbnails} {...trackResponder.panHandlers}>
          {segment.thumbnails.map((t: string, idx: number) => (
            <Image key={idx} source={{ uri: t }} style={styles.trimThumb} />
          ))}
        </View>
        <View style={[styles.trimDim, { left: 0, width: startPx }]} pointerEvents="none" />
        <View style={[styles.trimDim, { left: endPx, right: 0 }]} pointerEvents="none" />
        <View style={[styles.trimBorder, { left: startPx, width: endPx - startPx }]} pointerEvents="none" />
        <View style={[styles.trimPlayhead, { left: currentPx }]} pointerEvents="none" />
        <View style={[styles.trimHandle, { left: startPx - 10 }]} {...leftResponder.panHandlers}>
          <View style={styles.trimHandleInner} />
        </View>
        <View style={[styles.trimHandle, { left: endPx - 10 }]} {...rightResponder.panHandlers}>
          <View style={styles.trimHandleInner} />
        </View>
      </View>
    </View>
  );
}
