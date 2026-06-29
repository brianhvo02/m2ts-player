import { useRef } from 'react';
import './App.css';
import Player from './Player';

export default function App() {
  const playerRef = useRef<Player>(null);

  return (
    <main>
      <canvas id='video'></canvas>
      <button onClick={async () => {
        const player = await Player.init();
        playerRef.current = player;
      }}>Create</button>
      <button onClick={() => playerRef.current?.audioRenderer.changeAudioTrack(0x1100)}>Change track 1</button>
      <button onClick={() => playerRef.current?.audioRenderer.changeAudioTrack(0x1101)}>Change track 2</button>
      <button onClick={() => playerRef.current?.audioRenderer.changeAudioTrack(0x1102)}>Change track 3</button>
    </main>
  )
};
