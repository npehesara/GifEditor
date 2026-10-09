import { FilterConfig, FilterPresetId } from '../types/editor';

export const DEFAULT_FILTER: FilterConfig = {
  preset: 'original',
  brightness: 0,
  contrast: 0,
  saturation: 0,
  exposure: 0,
  temperature: 0,
  tint: 0,
  highlights: 0,
  shadows: 0,
  fade: 0,
  vignette: 0,
  sharpen: 0,
  hue: 0,
};

export interface FilterPreset {
  id: FilterPresetId;
  label: string;
  config: Partial<Omit<FilterConfig, 'preset'>>;
}

export const FILTER_PRESETS: FilterPreset[] = [
  // Basic
  { id: 'original', label: 'Original', config: {} },
  { id: 'bright', label: 'Bright', config: { brightness: 20, exposure: 10 } },
  { id: 'contrast', label: 'Contrast', config: { contrast: 30 } },
  { id: 'saturated', label: 'Saturated', config: { saturation: 40 } },
  { id: 'vibrant', label: 'Vibrant', config: { saturation: 25, contrast: 15, brightness: 10 } },
  
  // Cinematic
  { id: 'cinematic', label: 'Cinematic', config: { contrast: 20, saturation: -10, temperature: -5, vignette: 30 } },
  { id: 'dramatic', label: 'Dramatic', config: { contrast: 40, saturation: -20, shadows: -20, vignette: 50 } },
  { id: 'movie', label: 'Movie', config: { contrast: 15, saturation: 10, temperature: 10 } },
  { id: 'teal_orange', label: 'Teal & Orange', config: { temperature: 20, tint: -10, contrast: 25, saturation: 15 } },
  { id: 'cool', label: 'Cool', config: { temperature: -30, tint: 5 } },
  
  // Vintage
  { id: 'vintage', label: 'Vintage', config: { contrast: -10, saturation: -30, temperature: 20, fade: 30, vignette: 40 } },
  { id: 'retro', label: 'Retro', config: { contrast: 10, saturation: -20, temperature: 15, fade: 15, tint: -5 } },
  { id: 'fade', label: 'Fade', config: { fade: 50, contrast: -20 } },
  { id: 'sepia', label: 'Sepia', config: { temperature: 50, saturation: -50, tint: -10 } },
  { id: 'warm', label: 'Warm', config: { temperature: 30, tint: 10, saturation: 10 } },
  
  // Artistic
  { id: 'noir', label: 'Noir', config: { saturation: -100, contrast: 40, brightness: -10, vignette: 40 } },
  { id: 'black_white', label: 'B & W', config: { saturation: -100 } },
  { id: 'dream', label: 'Dream', config: { brightness: 15, contrast: -15, fade: 20, saturation: 10 } },
  { id: 'vivid', label: 'Vivid', config: { saturation: 50, contrast: 20, brightness: 15, hue: 5 } },
  { id: 'pop', label: 'Pop', config: { saturation: 40, contrast: 30, hue: 15 } },
];

export const getPresetConfig = (id: FilterPresetId): FilterConfig => {
  const preset = FILTER_PRESETS.find(p => p.id === id);
  if (!preset) return { ...DEFAULT_FILTER };
  return { ...DEFAULT_FILTER, ...preset.config, preset: id };
};
