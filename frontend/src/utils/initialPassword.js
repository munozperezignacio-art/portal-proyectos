// Uniform, cryptographically secure choices; never fall back to Math.random.
export function generateInitialPassword() {
  const groups = ['ABCDEFGHJKLMNPQRSTUVWXYZ', 'abcdefghijkmnopqrstuvwxyz', '23456789', '!@#$%*-_'];
  const randomIndex = size => {
    const bytes = new Uint8Array(1);
    const limit = 256 - (256 % size);
    do { globalThis.crypto.getRandomValues(bytes); } while (bytes[0] >= limit);
    return bytes[0] % size;
  };
  const alphabet = groups.join('');
  const characters = groups.map(group => group[randomIndex(group.length)]);
  while (characters.length < 20) characters.push(alphabet[randomIndex(alphabet.length)]);
  for (let i = characters.length - 1; i > 0; i--) {
    const j = randomIndex(i + 1);
    [characters[i], characters[j]] = [characters[j], characters[i]];
  }
  return characters.join('');
}

export function escapeCredentialText(value) {
  return String(value ?? '').replace(/[&<>"']/g, character => ({
    '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;'
  })[character]);
}
