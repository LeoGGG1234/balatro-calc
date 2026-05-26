/**
 * Balatro Save File Decompressor (Zero-Dependency).
 *
 * Decompresses `.jkr` binary save files into Lua table text using the
 * browser-native `DecompressionStream('deflate')` API.
 *
 * Pipeline: ArrayBuffer → DecompressionStream('deflate') → Lua text string
 */

// ─── Error types ──────────────────────────────────────────────────

export class SaveDecodeError extends Error {
  constructor(message: string, public readonly cause?: unknown) {
    super(message);
    this.name = 'SaveDecodeError';
  }
}

// ─── Main API ─────────────────────────────────────────────────────

export async function decompressBalatroSave(fileBuffer: ArrayBuffer): Promise<string> {
  if (fileBuffer.byteLength === 0) {
    throw new SaveDecodeError(
      'INVALID_SAVE_STREAM: Input buffer is empty. The file may be corrupted or not a valid Balatro save.',
    );
  }

  let decompressedText: string;

  try {
    const blob = new Blob([fileBuffer]);
    const ds = new DecompressionStream('deflate');
    const decompressedStream = blob.stream().pipeThrough(ds);
    const decompressed = await new Response(decompressedStream).arrayBuffer();
    decompressedText = new TextDecoder().decode(decompressed);
  } catch (err) {
    throw new SaveDecodeError(
      'INVALID_SAVE_STREAM: Failed to decompress save file. ' +
      'The file header may be corrupted or the data is not valid deflate-compressed Balatro save.',
      err,
    );
  }

  if (!decompressedText || decompressedText.trim().length === 0) {
    throw new SaveDecodeError(
      'INVALID_SAVE_STREAM: Decompression produced empty output. The file may not be a valid Balatro save.',
    );
  }

  return decompressedText;
}
