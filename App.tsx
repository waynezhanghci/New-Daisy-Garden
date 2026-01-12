import React, { useState } from 'react';
import { GardenCanvas } from './components/GardenCanvas';

const App: React.FC = () => {
  const [flowerCount, setFlowerCount] = useState(0);
  const [gestureEnabled, setGestureEnabled] = useState(false);

  const handleUpdateCount = (count: number) => {
    setFlowerCount(count);
  };

  return (
    <div className="w-screen h-screen bg-gradient-to-b from-[#7D7169] to-[#272B2F] overflow-hidden relative font-sans">
      {/* Top Left Instructions - Reverted to light text for dark background */}
      <div className="absolute top-6 left-6 text-white/60 pointer-events-none z-10 select-none">
        {/* Font size increased to text-5xl to be roughly double the previous text-xl */}
        <h1 className="text-5xl font-light tracking-widest uppercase">Daisy Garden</h1>
        <p className="text-sm mt-2 opacity-80 tracking-wide font-medium">
          种下一朵美好，释放一份热爱
        </p>
      </div>

      {/* Top Right Counter Module - Reverted to light theme for dark background */}
      <div className="absolute top-6 right-6 z-10 pointer-events-none select-none">
        <div className="bg-white/10 backdrop-blur-md border border-white/10 rounded-3xl w-40 h-40 flex flex-col items-center justify-center shadow-2xl">
            <div className="text-[10px] font-bold tracking-[0.2em] text-white/60 uppercase mb-1 text-center leading-relaxed">
                Happy<br/>Flowers
            </div>
            <div className="text-6xl text-white font-thin mt-1">
                {flowerCount}
            </div>
        </div>
      </div>

      {/* Bottom Left Toggle Switch */}
      <div className="absolute bottom-6 left-6 z-10 select-none flex items-center gap-3">
        <div 
          className="bg-white/10 backdrop-blur-md border border-white/10 rounded-full px-4 py-2 flex items-center gap-3 shadow-lg cursor-pointer transition-all hover:bg-white/20 active:scale-95 group"
          onClick={() => setGestureEnabled(!gestureEnabled)}
        >
            <div className={`w-10 h-5 rounded-full relative transition-colors duration-300 ${gestureEnabled ? 'bg-[#96B16D]' : 'bg-white/20'}`}>
                <div className={`absolute top-1 w-3 h-3 rounded-full bg-white shadow-sm transition-all duration-300 ${gestureEnabled ? 'translate-x-6' : 'translate-x-1'}`}></div>
            </div>
            <span className={`text-sm font-light tracking-wide transition-colors duration-300 ${gestureEnabled ? 'text-white' : 'text-white/60'}`}>
              手势种花
            </span>
        </div>
      </div>

      <GardenCanvas onUpdateCount={handleUpdateCount} enableGestures={gestureEnabled} />
    </div>
  );
};

export default App;