import { useRef } from 'react';
import './App.css';
import Decoder from './Decoder';

export default function App() {
  const decoderRef = useRef<Decoder>(null);

  return (
    <main>
      <canvas></canvas>
      <button onClick={async () => {
        const decoder = await Decoder.init();
        decoderRef.current = decoder;

        if (decoder) decoder.decode();
      }}>Create</button>
      <button onClick={() => decoderRef.current?.sourceNode.start()}>Play</button>
    </main>
  )
};
