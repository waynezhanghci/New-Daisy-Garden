
import React, { useRef, useEffect, useCallback, useState } from 'react';
import { Daisy } from '../classes/Daisy';
import { Particle } from '../classes/Particle';
import { GestureRecognizer, FilesetResolver, DrawingUtils } from '@mediapipe/tasks-vision';

interface GardenCanvasProps {
    onUpdateCount: (count: number) => void;
    enableGestures: boolean;
}

interface HandCursor {
    x: number;
    y: number;
    isPinching: boolean;
}

export const GardenCanvas: React.FC<GardenCanvasProps> = ({ onUpdateCount, enableGestures }) => {
  const activeCanvasRef = useRef<HTMLCanvasElement>(null);
  const videoRef = useRef<HTMLVideoElement>(null);
  
  const daisiesRef = useRef<Daisy[]>([]);
  const particlesRef = useRef<Particle[]>([]);
  const collectedScoreRef = useRef<number>(0);

  const requestRef = useRef<number>();
  const gestureLoopRef = useRef<number>();
  const lastVideoTimeRef = useRef<number>(-1);
  const gestureRecognizerRef = useRef<GestureRecognizer | null>(null);
  
  const [isModelLoaded, setIsModelLoaded] = useState(false);
  
  // Interaction State
  const lastPlantTimesRef = useRef<number[]>([0, 0, 0, 0]); // Supports cooldown for up to 4 hands
  const handCursorsRef = useRef<HandCursor[]>([]);

  const calculateDensityModifier = (x: number, y: number): number => {
    let minDist = Infinity;
    const checkLimit = 50;
    const start = Math.max(0, daisiesRef.current.length - checkLimit);
    
    for (let i = start; i < daisiesRef.current.length; i++) {
        const d = daisiesRef.current[i];
        const dist = Math.hypot(d.x - x, d.y - y);
        if (dist < minDist) minDist = dist;
    }

    if (minDist === Infinity) return 1.0;
    
    const minRange = 15;
    const maxRange = 60;
    
    if (minDist < minRange) return 0.6; 
    if (minDist > maxRange) return 1.0;
    
    return 0.6 + ((minDist - minRange) / (maxRange - minRange)) * 0.4;
  };

  const addDaisy = useCallback((x: number, y: number) => {
    const count = Math.random() > 0.8 ? 2 : 1;
    
    for (let i = 0; i < count; i++) {
        const offsetX = i === 0 ? 0 : (Math.random() - 0.5) * 25;
        const finalX = x + offsetX;
        const scale = calculateDensityModifier(finalX, y);
        
        const daisy = new Daisy(finalX, y, scale);
        daisiesRef.current.push(daisy);
    }
  }, []);

  const triggerConfetti = (multiplier: number) => {
    const startX = window.innerWidth - 104;
    const startY = 104;
    const baseCount = 60;
    const count = baseCount * multiplier;
    
    for(let i=0; i<count; i++) {
        particlesRef.current.push(new Particle(startX, startY));
    }
  };

  // --- Hand Gesture Setup ---

  useEffect(() => {
    const loadGestureModel = async () => {
        try {
            const vision = await FilesetResolver.forVisionTasks(
                "https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@0.10.3/wasm"
            );
            gestureRecognizerRef.current = await GestureRecognizer.createFromOptions(vision, {
                baseOptions: {
                    modelAssetPath: "https://storage.googleapis.com/mediapipe-models/gesture_recognizer/gesture_recognizer/float16/1/gesture_recognizer.task",
                    delegate: "GPU"
                },
                runningMode: "VIDEO",
                numHands: 4 // INCREASED: Supports multiple hands
            });
            setIsModelLoaded(true);
        } catch (error) {
            console.error("Failed to load gesture model", error);
        }
    };

    loadGestureModel();
  }, []);

  useEffect(() => {
    if (!isModelLoaded) return;

    let localStream: MediaStream | null = null;

    const startWebcam = async () => {
        if (!enableGestures) return;
        try {
            localStream = await navigator.mediaDevices.getUserMedia({ video: true });
            if (videoRef.current) {
                videoRef.current.srcObject = localStream;
                videoRef.current.onloadeddata = () => {
                    predictWebcam();
                };
            }
        } catch (err) {
            console.error("Error accessing webcam:", err);
        }
    };

    const stopWebcam = () => {
        if (videoRef.current && videoRef.current.srcObject) {
            const tracks = (videoRef.current.srcObject as MediaStream).getTracks();
            tracks.forEach(t => t.stop());
            videoRef.current.srcObject = null;
        }
        if (gestureLoopRef.current) {
            cancelAnimationFrame(gestureLoopRef.current);
            gestureLoopRef.current = undefined;
        }
        handCursorsRef.current = [];
    };

    if (enableGestures) {
        startWebcam();
    } else {
        stopWebcam();
    }

    return () => {
        stopWebcam();
    };
  }, [enableGestures, isModelLoaded]);

  const predictWebcam = () => {
      const video = videoRef.current;
      const recognizer = gestureRecognizerRef.current;
      
      if (!video || !recognizer || !video.srcObject) {
          return;
      }

      const now = Date.now();
      if (video.currentTime !== lastVideoTimeRef.current) {
          lastVideoTimeRef.current = video.currentTime;
          
          try {
            const results = recognizer.recognizeForVideo(video, now);
            
            // --- Multi-Hand Logic ---
            const newCursors: HandCursor[] = [];

            if (results.landmarks.length > 0) {
                results.landmarks.forEach((landmarks, index) => {
                    const indexTip = landmarks[8];
                    const thumbTip = landmarks[4];
                    
                    const screenX = (1 - indexTip.x) * window.innerWidth;
                    const screenY = indexTip.y * window.innerHeight;

                    const pinchDist = Math.hypot(indexTip.x - thumbTip.x, indexTip.y - thumbTip.y);
                    const isPinching = pinchDist < 0.05;

                    newCursors.push({ x: screenX, y: screenY, isPinching });

                    if (isPinching) {
                        // Use unique index for each hand's cooldown
                        const lastPlantTime = lastPlantTimesRef.current[index] || 0;
                        if (now - lastPlantTime > 200) {
                            addDaisy(screenX, screenY);
                            lastPlantTimesRef.current[index] = now;
                        }
                    }
                });
            }
            handCursorsRef.current = newCursors;
          } catch (e) {
              console.warn("Gesture error", e);
          }
      }

      gestureLoopRef.current = requestAnimationFrame(predictWebcam);
  };

  // --- Main Animation Loop (Visuals) ---

  const handleClick = (e: React.MouseEvent | React.TouchEvent) => {
    const canvas = activeCanvasRef.current;
    if (!canvas) return;
    
    let clientX, clientY;
    if ('touches' in e) {
        clientX = e.touches[0].clientX;
        clientY = e.touches[0].clientY;
    } else {
        clientX = (e as React.MouseEvent).clientX;
        clientY = (e as React.MouseEvent).clientY;
    }

    const rect = canvas.getBoundingClientRect();
    const x = clientX - rect.left;
    const y = clientY - rect.top;

    addDaisy(x, y);
  };

  const animate = (time: number) => {
    const activeCanvas = activeCanvasRef.current;
    const activeCtx = activeCanvas?.getContext('2d');

    if (activeCanvas && activeCtx) {
      activeCtx.clearRect(0, 0, activeCanvas.width, activeCanvas.height);
      
      const now = Date.now();
      const targetX = activeCanvas.width - 100;
      const targetY = 100;
      
      // 1. Update Daisies
      let newlyCollected = 0;
      daisiesRef.current = daisiesRef.current.filter(daisy => {
          const age = now - daisy.createdAt;
          
          if (!daisy.isCollecting && age > Daisy.LIFE_SPAN) {
              daisy.collect(targetX, targetY);
          }
          
          const alive = daisy.updateAndDraw(activeCtx, now);
          if (!alive) {
              newlyCollected++;
          }
          return alive;
      });

      // 2. Handle Scoring
      if (newlyCollected > 0) {
          collectedScoreRef.current += newlyCollected;
          const currentScore = collectedScoreRef.current;
          
          if (currentScore >= 100) {
              triggerConfetti(10);
              collectedScoreRef.current = 0;
          } else if (currentScore === 50) {
              triggerConfetti(5);
          } else if (currentScore % 10 === 0 && currentScore > 0) {
              triggerConfetti(1);
          }
          
          onUpdateCount(collectedScoreRef.current);
      }

      // 3. Update Particles
      if (particlesRef.current.length > 0) {
          particlesRef.current = particlesRef.current.filter(p => {
              p.update();
              p.draw(activeCtx);
              return p.life > 0;
          });
      }

      // 4. Draw Multiple Hand Cursors
      if (enableGestures && handCursorsRef.current.length > 0) {
          handCursorsRef.current.forEach(cursor => {
              const { x, y, isPinching } = cursor;
              
              activeCtx.save();
              // Glowing effect for pinched state
              if (isPinching) {
                  activeCtx.shadowBlur = 15;
                  activeCtx.shadowColor = 'rgba(255, 255, 255, 0.8)';
              }

              activeCtx.beginPath();
              activeCtx.arc(x, y, 10, 0, Math.PI * 2);
              activeCtx.fillStyle = isPinching ? 'rgba(255, 255, 255, 0.95)' : 'rgba(255, 255, 255, 0.4)';
              activeCtx.fill();
              
              if (isPinching) {
                  activeCtx.beginPath();
                  activeCtx.arc(x, y, 15 + Math.sin(Date.now() * 0.01) * 3, 0, Math.PI * 2);
                  activeCtx.strokeStyle = 'rgba(255, 255, 255, 0.6)';
                  activeCtx.lineWidth = 2;
                  activeCtx.stroke();
              }
              activeCtx.restore();
          });
      }
    }

    requestRef.current = requestAnimationFrame(animate);
  };

  useEffect(() => {
    const handleResize = () => {
      const w = window.innerWidth;
      const h = window.innerHeight;
      
      if (activeCanvasRef.current) {
        activeCanvasRef.current.width = w;
        activeCanvasRef.current.height = h;
      }
    };
    
    window.addEventListener('resize', handleResize);
    handleResize();

    requestRef.current = requestAnimationFrame(animate);

    return () => {
      window.removeEventListener('resize', handleResize);
      if (requestRef.current) cancelAnimationFrame(requestRef.current);
    };
  }, [onUpdateCount, enableGestures]);

  return (
    <div className="w-full h-full relative cursor-crosshair active:cursor-grabbing">
        <video ref={videoRef} id="webcam" autoPlay playsInline muted></video>
        <canvas
            ref={activeCanvasRef}
            className="absolute top-0 left-0 w-full h-full touch-none"
            onClick={handleClick}
            onTouchStart={handleClick}
        />
    </div>
  );
};
