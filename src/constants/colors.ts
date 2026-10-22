export const Colors = {
  // Backgrounds: Soft tinted charcoal, deep navy, and subtle purple-blue tones
  background: '#0c0e1a',
  backgroundDark: '#080912',
  surface: '#131629',
  surfaceLight: '#1d223c',
  card: '#181c34',
  cardHover: '#23294c',
  previewBg: '#090a14',

  // Borders & Dividers: Subtle lavender, blue, and navy tones
  border: '#272d4c',
  borderLight: '#39416d',
  divider: 'rgba(165, 180, 252, 0.12)',

  // Primary: Vibrant violet and purple
  primary: '#8b5cf6',
  primaryLight: '#a78bfa',
  primaryDark: '#6d28d9',

  // Secondary: Electric blue and cyan
  secondary: '#06b6d4',
  secondaryLight: '#38bdf8',
  secondaryDark: '#0284c7',

  // Accent: Coral pink and soft magenta
  accent: '#ec4899',
  accentLight: '#f472b6',
  accentCoral: '#fb7185',

  // Highlights: Subtle lavender and aqua
  lavender: '#c084fc',
  aqua: '#2dd4bf',

  // Text: Crisp white / soft white with readable secondary and muted tones
  text: '#ffffff',
  textSecondary: '#cbd5e1',
  textMuted: '#94a3b8',

  // Status & Feedback
  success: '#10b981',
  warning: '#f59e0b',
  danger: '#f43f5e',

  // Editor specific
  overlay: 'rgba(8, 9, 18, 0.75)',
  timelineTrack: '#0f1222',
  scrubberNeedle: '#ec4899',
  selection: '#8b5cf6',

  // Gradients
  gradient: {
    primary: ['#8b5cf6', '#06b6d4'] as const,
    violetPink: ['#8b5cf6', '#ec4899'] as const,
    surface: ['#1d223c', '#131629'] as const,
  }
};

