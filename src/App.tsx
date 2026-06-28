import { useRef } from 'react';
import './App.css';
import Demuxer from './Demuxer';

export default function App() {
  const demuxerRef = useRef<Demuxer>(null);

  return (
    <main>
      <canvas></canvas>
      <button onClick={async () => {
        const decoder = await Demuxer.init();
        demuxerRef.current = decoder;

        if (decoder) decoder.decode();
      }}>Create</button>
      <button onClick={() => demuxerRef.current?.sourceNode.start()}>Play</button>
    </main>
  )
};
