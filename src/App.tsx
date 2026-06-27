import { useRef, useState } from 'react';
import './App.css';
import Decoder from './Decoder';

const SAMPLE_RATE = 48000;
const CHANNELS = 2;
const SECONDS_COUNT = Math.floor((2**30 / 4) / (SAMPLE_RATE * CHANNELS));
const SECONDS_SIZE = SECONDS_COUNT * SAMPLE_RATE * CHANNELS;

const videoDecoder = new VideoDecoder({
  output(frame) {
    const canvas = document.querySelector('canvas');
    const ctx = canvas?.getContext('2d');
    if (!canvas || !ctx) return;
    canvas.width = frame.codedWidth;
    canvas.height = frame.codedHeight;
    ctx.drawImage(frame, 0, 0);
  },
  error(e) {
    console.error(e);
  },
});

const ctx = new AudioContext();
const buf = ctx.createBuffer(CHANNELS, SECONDS_SIZE, SAMPLE_RATE);

export default function App() {
  const decoderRef = useRef<Decoder>(null);
  const [ready, setReady] = useState(false);

  return (
    <main>
      <canvas></canvas>
      <button onClick={async () => {
        const decoder = await Decoder.init(videoDecoder);
        decoderRef.current = decoder;

        if (decoder)
          setReady(true);
      }}>Create</button>
      {ready && <button onClick={() => decoderRef.current?.decode()}>Start</button>}
    </main>
  )
};
