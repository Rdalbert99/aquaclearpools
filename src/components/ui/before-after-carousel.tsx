import {
  Carousel,
  CarouselContent,
  CarouselItem,
  CarouselNext,
  CarouselPrevious,
} from "@/components/ui/carousel"
import { BeforeAfterFade } from '@/components/ui/before-after-fade';

interface BeforeAfterPair {
  before: string;
  after: string;
  title: string;
}

interface BeforeAfterCarouselProps {
  pairs: BeforeAfterPair[];
}

export const BeforeAfterCarousel = ({ pairs }: BeforeAfterCarouselProps) => {
  return (
    <div className="w-full">
      <h2 className="text-3xl font-bold text-center mb-8">See the Difference</h2>
      
      <Carousel
        opts={{
          align: "start",
          loop: true,
        }}
        className="w-full max-w-5xl mx-auto"
      >
        <CarouselContent>
          {pairs.map((pair, index) => (
            <CarouselItem key={index} className="md:basis-1/1 lg:basis-1/1">
              <div className="p-1">
                <BeforeAfterFade pair={pair} />
              </div>
            </CarouselItem>
          ))}
        </CarouselContent>
        <CarouselPrevious className="left-2 md:left-4" />
        <CarouselNext className="right-2 md:right-4" />
      </Carousel>
    </div>
  );
};