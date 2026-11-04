export const MAX_SHARE_BYTES = 10 * 1024 * 1024;

export function shareForm(share) {
  if (!share || typeof share.id !== 'string' || !/^[A-Za-z0-9-]{1,80}$/.test(share.id)) {
    throw new Error('The shared item could not be read. Please share it again.');
  }
  const form = new FormData();
  form.append('share_id', share.id);
  const text = typeof share.text === 'string' ? share.text : '';
  let size = new TextEncoder().encode(text).length;
  if (size > MAX_SHARE_BYTES) throw new Error('Share files up to 10 MB at a time.');
  form.append('text', text);
  const files = share.files ?? [];
  if (!Array.isArray(files) || files.length > 5) throw new Error('Share up to five files at a time.');
  for (const file of files) {
    if (typeof file.data !== 'string' || file.data.length > Math.ceil(MAX_SHARE_BYTES / 3) * 4) {
      throw new Error('Share files up to 10 MB at a time.');
    }
    const binary = atob(file.data);
    size += binary.length;
    if (size > MAX_SHARE_BYTES) throw new Error('Share files up to 10 MB at a time.');
    const bytes = Uint8Array.from(binary, character => character.charCodeAt(0));
    const name = typeof file.name === 'string' ? Array.from(file.name,
      character => character.charCodeAt(0) < 32 || '/\\'.includes(character) ? '_' : character).join('').slice(0, 180) : 'shared-file';
    form.append('files', new Blob([bytes], { type: 'application/octet-stream' }), name || 'shared-file');
  }
  if (!text && files.length === 0) throw new Error('Nothing was shared.');
  return form;
}
