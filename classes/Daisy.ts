import { randomRange, randomInt, degToRad, easeOutQuad, easeOutBack, clamp } from '../utils/math';

export class Daisy {
  x: number;
  y: number; // Ground level
  
  // Properties
  finalHeight: number;
  petalCount: number;
  maxPetalLength: number;
  maxPetalWidth: number;
  stemControlPointOffset: number; 
  leafConfig: { yPct: number; side: number; length: number; angle: number; width: number }[];
  petalAngles: number[];
  
  // Variation Properties
  intrinsicScale: number; 
  tilt: number; 
  petalShapeProfile: number; 
  windPhase: number; 
  petalColor: string;
  seedRotation: number; // Random tilt for the seed
  
  // State
  createdAt: number;
  scaleModifier: number; 

  // Collection State
  isCollecting: boolean = false;
  collectionStartTime: number = 0;
  originX: number = 0;
  originY: number = 0;
  targetX: number = 0;
  targetY: number = 0;

  // Constants
  static DROP_DURATION = 300; 
  static WAIT_DURATION = 3000; // Wait 3 seconds before growing
  static SPROUT_DURATION = 200;
  static STEM_DURATION = 500;
  static BUD_DURATION = 400; 
  static BLOOM_DURATION = 400; 
  static COLLECTION_DURATION = 1000;
  
  // Time until fully grown (Growth phases only)
  static FULL_GROWTH_TIME = 200 + 500 + 400 + 400; 
  
  // Auto collect: Drop + Wait + Growth + 10s Idle
  static LIFE_SPAN = 300 + 3000 + 1500 + 10000; 

  // Colors
  static COLOR_STEM = '#96B16D';
  static COLOR_CENTER = '#F9A602';
  
  static PASTEL_PALETTE = [
    '#FFFEFA', 
    '#FFFACD', 
    '#FFD1DC', 
    '#D0E8F2', 
  ];

  constructor(x: number, y: number, scaleModifier: number = 1) {
    this.x = x;
    this.y = y;
    this.scaleModifier = scaleModifier;
    this.createdAt = Date.now();

    const colorIndex = randomInt(0, Daisy.PASTEL_PALETTE.length - 1);
    this.petalColor = Daisy.PASTEL_PALETTE[colorIndex];

    this.finalHeight = randomRange(35, 170); 
    this.intrinsicScale = randomRange(0.5, 1.5);
    
    const totalScale = this.scaleModifier * this.intrinsicScale;

    this.stemControlPointOffset = randomRange(-25, 25);
    
    this.petalCount = randomInt(6, 14); 
    this.tilt = randomRange(0.3, 0.9); 
    this.petalShapeProfile = Math.random(); 
    this.windPhase = Math.random() * Math.PI * 2;
    this.seedRotation = randomRange(-0.8, 0.8); // Randomize angle for natural fall

    const baseLen = randomRange(15, 30);
    const baseWid = randomRange(4, 11); 
    this.maxPetalLength = baseLen * totalScale; 
    this.maxPetalWidth = baseWid * totalScale; 
    
    this.petalAngles = [];
    const step = (Math.PI * 2) / this.petalCount;
    for(let i=0; i<this.petalCount; i++) {
        this.petalAngles.push((i * step) + randomRange(-0.3, 0.3)); 
    }

    const leafCount = this.finalHeight > 100 ? randomInt(3, 5) : randomInt(2, 3);
    this.leafConfig = [];
    for (let i = 0; i < leafCount; i++) {
      this.leafConfig.push({
        yPct: randomRange(0.1, 0.7), 
        side: Math.random() > 0.5 ? 1 : -1,
        length: randomRange(12, 28) * totalScale, 
        angle: randomRange(30, 80),
        width: randomRange(5, 10) * totalScale
      });
    }
  }

  // Trigger collection animation
  collect(targetX: number, targetY: number) {
    if (this.isCollecting) return;
    this.isCollecting = true;
    this.collectionStartTime = Date.now();
    this.originX = this.x;
    this.originY = this.y;
    this.targetX = targetX;
    this.targetY = targetY;
  }

  // Returns false if the flower should be removed (animation done)
  updateAndDraw(ctx: CanvasRenderingContext2D, currentTime: number): boolean {
    if (this.isCollecting) {
        const progress = (currentTime - this.collectionStartTime) / Daisy.COLLECTION_DURATION;
        
        if (progress >= 1) return false; // Remove me
        
        const ease = easeOutQuad(progress, 0, 1, 1);
        
        // Lerp Position
        const currX = this.originX + (this.targetX - this.originX) * ease;
        const currY = this.originY + (this.targetY - this.originY) * ease;
        
        // Scale down as it flies
        const scale = 1 - (progress * 0.8);
        
        ctx.save();
        ctx.translate(currX, currY);
        ctx.scale(scale, scale);
        // Draw centered at 0,0 relative to translation
        // We need to offset standard drawing which assumes y is ground
        ctx.translate(-this.x, -this.y + this.finalHeight / 2); // Roughly center visuals
        this.drawPlant(ctx, 99999, currentTime); // 99999 ensures full bloom state
        ctx.restore();
        
        return true;
    }

    const age = currentTime - this.createdAt;
    
    // Phase 1 & 2: Drop and Wait
    const timeBeforeGrowth = Daisy.DROP_DURATION + Daisy.WAIT_DURATION;

    if (age < timeBeforeGrowth) {
      // Clamp the animation time to DROP_DURATION so it stays static on the ground during the wait period
      const dropAnimationTime = Math.min(age, Daisy.DROP_DURATION);
      this.drawSeed(ctx, dropAnimationTime);
      return true;
    }

    // Phase 3: Growth
    const growthTime = age - timeBeforeGrowth;
    this.drawPlant(ctx, growthTime, currentTime);
    return true;
  }

  private drawSeed(ctx: CanvasRenderingContext2D, age: number) {
    // Drop animation: Fall 20px
    const currentY = easeOutQuad(age, this.y - 20, 20, Daisy.DROP_DURATION);
    
    ctx.save();
    ctx.translate(this.x, currentY);
    ctx.rotate(this.seedRotation);

    // Draw Oat Grain (Elongated, tapered shape)
    // SCALED UP 2X
    // RESTORED LIGHTER COLORS (Golden Oat)
    ctx.fillStyle = '#E6C898'; 
    ctx.beginPath();
    // Top to bottom curve
    ctx.moveTo(0, -10); 
    ctx.quadraticCurveTo(4.4, 0, 0, 10); 
    ctx.quadraticCurveTo(-4.4, 0, 0, -10); 
    ctx.fill();

    // Draw the crease (groove) down the middle
    ctx.strokeStyle = '#997D50'; 
    ctx.lineWidth = 1.2;
    ctx.beginPath();
    ctx.moveTo(0, -7);
    ctx.lineTo(0, 7);
    ctx.stroke();

    ctx.restore();
  }

  private drawTaperedStem(ctx: CanvasRenderingContext2D, startX: number, startY: number, endX: number, endY: number, cpX: number, cpY: number, progress: number) {
    const segments = 15;
    const baseWidth = (4 + (this.finalHeight / 40)) * this.intrinsicScale * this.scaleModifier; 
    const tipWidth = baseWidth * 0.4;

    ctx.fillStyle = Daisy.COLOR_STEM;
    ctx.beginPath();

    for (let i = 0; i <= segments; i++) {
        const t = (i / segments) * progress;
        if (t > 1) break;
        
        const mt = 1-t;
        const px = (mt*mt)*startX + 2*mt*t*cpX + (t*t)*endX;
        const py = (mt*mt)*startY + 2*mt*t*cpY + (t*t)*endY;

        const tx = 2*mt*(cpX - startX) + 2*t*(endX - cpX);
        const ty = 2*mt*(cpY - startY) + 2*t*(endY - cpY);
        
        const len = Math.hypot(tx, ty);
        const nx = -ty / len;
        const ny = tx / len;

        const w = baseWidth - ((baseWidth - tipWidth) * t);

        if (i === 0) ctx.moveTo(px + nx * (w/2), py + ny * (w/2));
        else ctx.lineTo(px + nx * (w/2), py + ny * (w/2));
    }

    for (let i = segments; i >= 0; i--) {
        const t = (i / segments) * progress;
        if (t > 1) continue;

        const mt = 1-t;
        const px = (mt*mt)*startX + 2*mt*t*cpX + (t*t)*endX;
        const py = (mt*mt)*startY + 2*mt*t*cpY + (t*t)*endY;

        const tx = 2*mt*(cpX - startX) + 2*t*(endX - cpX);
        const ty = 2*mt*(cpY - startY) + 2*t*(endY - cpY);
        
        const len = Math.hypot(tx, ty);
        const nx = -ty / len;
        const ny = tx / len;

        const w = baseWidth - ((baseWidth - tipWidth) * t);

        ctx.lineTo(px - nx * (w/2), py - ny * (w/2));
    }

    ctx.closePath();
    ctx.fill();
  }

  private drawPlant(ctx: CanvasRenderingContext2D, growthTime: number, currentTime: number) {
    const sproutEnd = Daisy.SPROUT_DURATION;
    const stemEnd = sproutEnd + Daisy.STEM_DURATION;
    const budEnd = stemEnd + Daisy.BUD_DURATION;
    
    let currentHeight = 0;
    if (growthTime < stemEnd) {
      currentHeight = easeOutQuad(growthTime, 0, this.finalHeight, stemEnd);
    } else {
      currentHeight = this.finalHeight;
    }

    const revealProgress = clamp(currentHeight / this.finalHeight, 0, 1);
    
    // --- Soft Organic Wind Logic ---
    const t = currentTime * 0.0008; 
    
    const baseSway = Math.sin(t + (this.x * 0.002) + this.windPhase);
    const secondarySway = Math.sin(t * 2.5 + (this.x * 0.01)) * 0.5;
    
    const windForce = baseSway + secondarySway;

    // Disable sway during collection to avoid jittering while flying
    const isStatic = this.isCollecting;

    const swaySensitivity = Math.pow(this.finalHeight, 1.5) / 100;
    const currentSway = isStatic ? 0 : (windForce * swaySensitivity * revealProgress);

    const startX = this.x;
    const startY = this.y;
    
    const endX = this.x + (this.stemControlPointOffset * 0.6) + currentSway;
    const endY = this.y - this.finalHeight;
    
    const cpX = this.x + this.stemControlPointOffset + (currentSway * 0.4);
    const cpY = this.y - (this.finalHeight * 0.5);

    const qT = revealProgress;
    const mt = 1-qT;
    const currentTipX = (mt*mt)*startX + 2*mt*qT*cpX + (qT*qT)*endX;
    const currentTipY = (mt*mt)*startY + 2*mt*qT*cpY + (qT*qT)*endY;

    if (revealProgress > 0.01) {
        this.drawTaperedStem(ctx, startX, startY, endX, endY, cpX, cpY, revealProgress);
    }

    if (revealProgress > 0.15) {
      this.leafConfig.forEach(leaf => {
         if (revealProgress > leaf.yPct) {
            const leafStartT = leaf.yPct;
            const leafGrowth = clamp((revealProgress - leafStartT) / 0.2, 0, 1);
            
            const lt = leaf.yPct;
            const mlt = 1-lt;
            const attachX = (mlt*mlt)*startX + 2*mlt*lt*cpX + (lt*lt)*endX;
            const attachY = (mlt*mlt)*startY + 2*mlt*lt*cpY + (lt*lt)*endY;
            
            const currentLeafLen = leaf.length * easeOutBack(leafGrowth, 0, 1, 1);
            
            ctx.fillStyle = Daisy.COLOR_STEM;
            ctx.save();
            ctx.translate(attachX, attachY);
            
            const baseAngle = leaf.side === 1 ? -leaf.angle : 180 + leaf.angle;
            
            const stemBendInfluence = isStatic ? 0 : ((cpX - startX) / 20) * 15; 
            const angleRad = degToRad(baseAngle + stemBendInfluence);
            
            ctx.rotate(angleRad);

            const w = leaf.width; 
            const l = currentLeafLen;

            ctx.beginPath();
            ctx.moveTo(0, 0);
            ctx.quadraticCurveTo(l * 0.4, -w, l, -w * 0.2);
            ctx.quadraticCurveTo(l * 0.4, w * 0.6, 0, 0);
            ctx.fill();
            ctx.restore();
         }
      });
    }

    if (growthTime > stemEnd) {
        const budTime = growthTime - stemEnd;
        
        let budScale = 0;
        if (budTime < Daisy.BUD_DURATION) {
             budScale = easeOutBack(budTime, 0, 1, Daisy.BUD_DURATION);
        } else {
             budScale = 1;
        }

        const bloomTime = growthTime - budEnd;
        let bloomProgress = 0;
        
        if (bloomTime > 0) {
            bloomProgress = easeOutBack(Math.min(bloomTime, Daisy.BLOOM_DURATION), 0, 1, Daisy.BLOOM_DURATION, 2.0);
        }

        ctx.save();
        ctx.translate(currentTipX, currentTipY);
        
        const tangentX = 2 * (endX - cpX);
        const tangentY = 2 * (endY - cpY);
        const rotation = Math.atan2(tangentY, tangentX) + Math.PI / 2;
        
        ctx.rotate(rotation);

        ctx.scale(1, this.tilt);

        if (bloomProgress > 0) {
            ctx.fillStyle = this.petalColor;
            
            for (let i = 0; i < this.petalCount; i++) {
                ctx.save();
                const angle = this.petalAngles[i];
                ctx.rotate(angle);
                
                const pLen = this.maxPetalLength * bloomProgress;
                const pWid = this.maxPetalWidth * bloomProgress;
                
                ctx.beginPath();
                ctx.moveTo(0, 0);
                
                const offset = 2 * bloomProgress * this.scaleModifier;
                
                const tipTaper = 0.5 + (this.petalShapeProfile * 0.4); 
                const baseBulge = 0.3 + ((1 - this.petalShapeProfile) * 0.2); 
                
                ctx.bezierCurveTo(
                    -pWid, offset + pLen * baseBulge, 
                    -pWid * (1 - this.petalShapeProfile * 0.6), offset + pLen * tipTaper, 
                    0, offset + pLen
                );
                
                ctx.bezierCurveTo(
                    pWid * (1 - this.petalShapeProfile * 0.6), offset + pLen * tipTaper, 
                    pWid, offset + pLen * baseBulge, 
                    0, 0 
                );
                
                ctx.fill();
                ctx.restore();
            }
        }

        const centerSize = (4 + (bloomProgress * 1.5)) * this.scaleModifier * this.intrinsicScale;
        ctx.fillStyle = Daisy.COLOR_CENTER;
        ctx.beginPath();
        ctx.arc(0, 0, centerSize * budScale, 0, Math.PI * 2);
        ctx.fill();

        ctx.restore();
    }
  }
}
