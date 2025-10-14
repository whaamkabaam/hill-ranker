import { Skeleton } from '@/components/ui/skeleton';

export default function ImageCardSkeleton() {
  return (
    <div className="flex flex-col gap-4">
      <div className="glass rounded-2xl overflow-hidden relative">
        <div className="aspect-square relative overflow-hidden">
          <Skeleton className="w-full h-full" />
        </div>
      </div>
      <div className="text-center space-y-2">
        <Skeleton className="h-6 w-24 mx-auto" />
        <Skeleton className="h-4 w-32 mx-auto" />
      </div>
    </div>
  );
}
