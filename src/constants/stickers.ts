export interface StickerCategory {
  id: string;
  name: string;
  stickers: string[];
}

export const STICKER_CATEGORIES: StickerCategory[] = [
  {
    id: 'emojis',
    name: 'Emojis',
    stickers: ['😀', '😂', '🤣', '😍', '😎', '🥳', '🤩', '😜', '🤔', '🤫', '🥺', '😴', '🤯', '😱', '🔥', '✨', '💯', '👍', '✌️', '👏']
  },
  {
    id: 'reactions',
    name: 'Reactions',
    stickers: ['❤️', '💖', '💘', '💔', '💥', '💫', '⚡', '👀', '🙌', '🤝', '💪', '🎯', '🚀', '⭐', '🌟', '🌈', '☀️', '🎉', '🎊', '🎁']
  },
  {
    id: 'celebration',
    name: 'Party',
    stickers: ['🎂', '🎈', '🍾', '🥂', '🍰', '🧁', '🍩', '🍕', '🍔', '🍦', '🍿', '🎸', '🎺', '🏆', '🥇', '👑', '💎', '🕶️', '🎵', '🎶']
  },
  {
    id: 'shapes',
    name: 'Badges',
    stickers: ['NEW!', 'HOT', 'OMG', 'WOW', 'COOL', 'YES!', 'NOPE', 'TOP', 'SALE', 'BEST', 'VIP', '100%', 'FREE', 'LIVE', 'GO!']
  },
  {
    id: 'arrows',
    name: 'Pointers',
    stickers: ['➡️', '⬅️', '⬆️', '⬇️', '↗️', '↘️', '↙️', '↖️', '↔️', '↕️', '🔄', '🔁', '🔀', '▶️', '⏩', '👇', '👉', '👆', '👈', '🎯']
  }
];
