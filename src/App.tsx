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
      <button onClick={() => playerRef.current?.play()}>Play</button>
    </main>
  )
};
