/**
 * Local audio chunk buffer that accumulates raw PCM or encoded audio before
 * uploading. Reduces network round-trips by batching small microphone chunks.
 */
export class AudioBuffer {
  private chunks: ArrayBuffer[] = [];
  private totalBytes = 0;
  private readonly flushThresholdBytes: number;
  private readonly onFlush: (buffer: ArrayBuffer) => Promise<void>;

  constructor(options: {
    /** Minimum bytes to accumulate before flushing (default: 32 KB). */
    flushThresholdBytes?: number;
    /** Called with the concatenated buffer when the threshold is reached or flush() is called. */
    onFlush: (buffer: ArrayBuffer) => Promise<void>;
  }) {
    this.flushThresholdBytes = options.flushThresholdBytes ?? 32 * 1024;
    this.onFlush = options.onFlush;
  }

  /** Appends a chunk of audio data. Flushes automatically when threshold is met. */
  async append(chunk: ArrayBuffer): Promise<void> {
    this.chunks.push(chunk);
    this.totalBytes += chunk.byteLength;

    if (this.totalBytes >= this.flushThresholdBytes) {
      await this.flush();
    }
  }

  /** Forces an immediate flush regardless of the accumulated size. */
  async flush(): Promise<void> {
    if (this.chunks.length === 0) return;

    const merged = mergeArrayBuffers(this.chunks);
    this.chunks = [];
    this.totalBytes = 0;

    await this.onFlush(merged);
  }

  /** Returns how many bytes are currently buffered. */
  get bufferedBytes(): number {
    return this.totalBytes;
  }
}

/** Concatenates an array of ArrayBuffer chunks into a single ArrayBuffer. */
export function mergeArrayBuffers(buffers: ArrayBuffer[]): ArrayBuffer {
  const totalLength = buffers.reduce((acc, buf) => acc + buf.byteLength, 0);
  const result = new Uint8Array(totalLength);
  let offset = 0;
  for (const buf of buffers) {
    result.set(new Uint8Array(buf), offset);
    offset += buf.byteLength;
  }
  return result.buffer;
}
