import { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';

interface BeforeAfterPair {
  before: string;
  after: string;
  title: string;
}

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
              src={pair.before} 
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
              src={pair.after} 
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