import { useRef, useState } from 'react';
import './App.css';
import Decoder from './Decoder';

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
