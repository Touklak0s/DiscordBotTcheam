function parseColor(input) {
  const namedColors = {
    red: 0xFF0000,
    green: 0x00FF00,
    blue: 0x0000FF,
    purple: 0x800080,
    pink: 0xFFC0CB,
    yellow: 0xFFFF00,
    orange: 0xFFA500,
    black: 0x000000,
    white: 0xFFFFFF,
    gray: 0x808080,
    brown: 0xA52A2A,
    cyan: 0x00FFFF,
    magenta: 0xFF00FF,
  };
  if (!input) return null;
  if (input.startsWith('#')) return parseInt(input.slice(1), 16);
  return namedColors[input.toLowerCase()] || null;
}

module.exports = { parseColor };