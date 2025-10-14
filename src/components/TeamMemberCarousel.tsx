import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import {
  Carousel,
  CarouselContent,
  CarouselItem,
  CarouselNext,
  CarouselPrevious,
} from "@/components/ui/carousel";

interface TeamMember {
  id: string;
  full_name: string;
  job_title?: string;
  email: string;
  profile_image_url: string;
}

const TeamMemberCarousel = () => {
  const [members, setMembers] = useState<TeamMember[]>([]);

  useEffect(() => {
    const fetchMembers = async () => {
      const { data } = await supabase
        .from('profiles')
        .select('id, full_name, job_title, email, profile_image_url')
        .not('profile_image_url', 'is', null)
        .order('full_name');

      if (data) {
        setMembers(data as TeamMember[]);
      }
    };

    fetchMembers();
  }, []);

  if (members.length === 0) return null;

  return (
    <div className="w-full max-w-2xl">
      <Carousel
        opts={{
          align: "start",
          loop: true,
        }}
        className="w-full"
      >
        <CarouselContent className="-ml-2">
          {members.map((member) => (
            <CarouselItem key={member.id} className="pl-2 basis-1/3 md:basis-1/4 lg:basis-1/5">
              <div className="group relative aspect-square overflow-hidden rounded-lg cursor-pointer">
                {/* Image */}
                <img
                  src={member.profile_image_url}
                  alt={member.full_name}
                  className="absolute inset-0 w-full h-full object-cover grayscale group-hover:grayscale-0 transition-all duration-300"
                />
                
                {/* Overlay Info */}
                <div className="absolute inset-0 bg-gradient-to-r from-transparent via-transparent to-background/95 opacity-0 group-hover:opacity-100 transition-opacity duration-300">
                  <div className="absolute right-2 top-1/2 -translate-y-1/2 text-right pr-2 w-2/5">
                    <p className="text-xs font-semibold leading-tight mb-1 line-clamp-2">
                      {member.full_name}
                    </p>
                    {member.job_title && (
                      <p className="text-[10px] text-muted-foreground leading-tight mb-1 line-clamp-2">
                        {member.job_title}
                      </p>
                    )}
                    <p className="text-[9px] text-muted-foreground leading-tight line-clamp-2">
                      {member.email}
                    </p>
                  </div>
                </div>
              </div>
            </CarouselItem>
          ))}
        </CarouselContent>
        <CarouselPrevious className="hidden md:flex -left-4" />
        <CarouselNext className="hidden md:flex -right-4" />
      </Carousel>
    </div>
  );
};

export default TeamMemberCarousel;