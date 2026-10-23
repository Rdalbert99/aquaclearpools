import { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';

interface BeforeAfterPair {
  before: string;
  after: string;
  title: string;
}

// Optimized WebP copies live in /lovable-uploads/opt/<id>-{480,960}.webp
const optimized = (src: string) => {
  const m = src.match(/^\/lovable-uploads\/([0-9a-f-]+)\.png$/);
  if (!m) return { src };
  const base = `/lovable-uploads/opt/${m[1]}`;
  return {
    src: `${base}-960.webp`,
    srcSet: `${base}-480.webp 480w, ${base}-960.webp 960w`,
    sizes: '(max-width: 1024px) 100vw, 1024px',
  };
};

interface BeforeAfterFadeProps {
  pair: BeforeAfterPair;
  interval?: number;
}

export const BeforeAfterFade = ({ pair, interval = 3000 }: BeforeAfterFadeProps) => {
  const [showBefore, setShowBefore] = useState(true);

  useEffect(() => {
    const timer = setInterval(() => {
      setShowBefore(prev => !prev);
    }, interval);

    return () => clearInterval(timer);
  }, [interval]);

  return (
    <Card className="overflow-hidden">
      <CardHeader>
        <CardTitle className="text-center">{pair.title}</CardTitle>
      </CardHeader>
      <CardContent>
        <div className="relative h-96 overflow-hidden rounded-lg">
          {/* Before Image */}
          <div className={`absolute inset-0 transition-opacity duration-1000 ${showBefore ? 'opacity-100' : 'opacity-0'}`}>
            <img 
              {...optimized(pair.before)}
              loading="lazy"
              decoding="async"
              width={960}
              height={1280}
              alt="Pool before service" 
              className="w-full h-full object-cover"
            />
            <div className="absolute top-4 left-4 bg-destructive/90 text-destructive-foreground px-3 py-1 rounded-md font-semibold text-sm">
              BEFORE
            </div>
          </div>
          
          {/* After Image */}
          <div className={`absolute inset-0 transition-opacity duration-1000 ${showBefore ? 'opacity-0' : 'opacity-100'}`}>
            <img 
              {...optimized(pair.after)}
              loading="lazy"
              decoding="async"
              width={960}
              height={1280}
              alt="Pool after service" 
              className="w-full h-full object-cover"
            />
            <div className="absolute top-4 left-4 bg-green-600/90 text-white px-3 py-1 rounded-md font-semibold text-sm">
              AFTER
            </div>
          </div>
        </div>
      </CardContent>
    </Card>
  );
};