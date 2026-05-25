class ClickyVoiceAgentInputProcessor extends AudioWorkletProcessor {
  constructor() {
    super();
    this.pendingChunks = [];
    this.pendingSampleCount = 0;
    this.targetChunkSamples = 1200;
    this.muted = false;

    this.port.onmessage = (event) => {
      if (event.data && event.data.type === "set-muted") {
        this.muted = Boolean(event.data.muted);
      }
    };
  }

  process(inputs) {
    if (this.muted) {
      return true;
    }

    const input = inputs[0] && inputs[0][0];
    if (!input || input.length === 0) {
      return true;
    }

    const pcm16 = new Int16Array(input.length);
    for (let index = 0; index < input.length; index++) {
      const sample = Math.max(-1, Math.min(1, input[index] || 0));
      pcm16[index] = sample < 0 ? sample * 0x8000 : sample * 0x7fff;
    }

    this.pendingChunks.push(pcm16);
    this.pendingSampleCount += pcm16.length;

    if (this.pendingSampleCount >= this.targetChunkSamples) {
      const chunk = new Int16Array(this.pendingSampleCount);
      let offset = 0;

      for (const pendingChunk of this.pendingChunks) {
        chunk.set(pendingChunk, offset);
        offset += pendingChunk.length;
      }

      this.pendingChunks = [];
      this.pendingSampleCount = 0;
      this.port.postMessage(chunk.buffer, [chunk.buffer]);
    }

    return true;
  }
}

registerProcessor("clicky-voice-agent-input", ClickyVoiceAgentInputProcessor);
