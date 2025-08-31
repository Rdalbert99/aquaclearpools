import { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible';
import { ChevronDown, ChevronUp } from 'lucide-react';
import { BeforeAfterFade } from '@/components/ui/before-after-fade';

interface BeforeAfterPair {
  before: string;
  after: string;
  title: string;
}

interface CollapsibleBeforeAfterProps {
  pairs: BeforeAfterPair[];
}

export const CollapsibleBeforeAfter = ({ pairs }: CollapsibleBeforeAfterProps) => {
  const [openSections, setOpenSections] = useState<{ [key: number]: boolean }>({});

  const toggleSection = (index: number) => {
    setOpenSections(prev => ({
      ...prev,
      [index]: !prev[index]
    }));
  };

  // Show first pair expanded by default, rest collapsible
  const featuredPair = pairs[0];
  const collapsiblePairs = pairs.slice(1);

  return (
    <div className="space-y-8">
      {/* Featured Before/After - Always Expanded */}
      <div className="mb-12">
        <BeforeAfterFade pair={featuredPair} />
      </div>

      {/* Collapsible Before/After Examples */}
      <div className="space-y-4">
        <h3 className="text-2xl font-semibold text-center mb-6">More Transformations</h3>
        {collapsiblePairs.map((pair, index) => (
          <Collapsible key={index} open={openSections[index]} onOpenChange={() => toggleSection(index)}>
            <Card className="overflow-hidden">
              <CollapsibleTrigger asChild>
                <CardHeader className="cursor-pointer hover:bg-muted/50 transition-colors">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center space-x-4">
                      {/* Small preview thumbnails */}
                      <div className="flex space-x-2">
                        <img 
                          src={pair.before} 
                          alt="Before preview" 
                          className="w-12 h-12 object-cover rounded border-2 border-destructive/20"
                        />
                        <img 
                          src={pair.after} 
                          alt="After preview" 
                          className="w-12 h-12 object-cover rounded border-2 border-green-600/20"
                        />
                      </div>
                      <CardTitle className="text-left">{pair.title}</CardTitle>
                    </div>
                    {openSections[index] ? (
                      <ChevronUp className="h-5 w-5 text-muted-foreground" />
                    ) : (
                      <ChevronDown className="h-5 w-5 text-muted-foreground" />
                    )}
                  </div>
                </CardHeader>
              </CollapsibleTrigger>
              <CollapsibleContent>
                <CardContent className="pt-0">
                  <BeforeAfterFade pair={pair} />
                </CardContent>
              </CollapsibleContent>
            </Card>
          </Collapsible>
        ))}
      </div>
    </div>
  );
};