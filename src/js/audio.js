// src/js/audio.js
export function createAudioController(audioElement) {
  let audioCtx;
  let analyser;
  let dataArray;
  let isInitialized = false;

  function init() {
    if (isInitialized) return;

    // Create Web Audio Context & Analyser Node
    audioCtx = new (window.AudioContext || window.webkitAudioContext)();
    analyser = audioCtx.createAnalyser();
    
    // fftSize = 128 gives 64 frequency bins
    analyser.fftSize = 128;

    const source = audioCtx.createMediaElementSource(audioElement);
    source.connect(analyser);
    analyser.connect(audioCtx.destination);

    dataArray = new Uint8Array(analyser.frequencyBinCount);
    isInitialized = true;
  }

  function getFrequencyData() {
    if (!analyser) return new Uint8Array(0);
    analyser.getByteFrequencyData(dataArray);
    return dataArray;
  }

  function getBinWidth() {
    if (!audioCtx || !analyser) return 0;
    return audioCtx.sampleRate / analyser.fftSize;
  }

  return { init, getFrequencyData, getBinWidth };
}