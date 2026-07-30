import { useState } from 'react';
import { Star, MessageSquare, User } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { useAuth } from '@/lib/auth';
import { useToast } from '@/hooks/use-toast';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { apiRequest } from '@/lib/queryClient';

interface RatingSystemProps {
  courseId: number;
  courseSlug: string;
  showReviewForm?: boolean;
}

interface Rating {
  id: number;
  userId: number;
  courseId: number;
  rating: number;
  reviewText?: string;
  createdAt: string;
  userName?: string;
}

interface RatingAggregate {
  averageRating: string;
  totalReviews: number;
  rating1Count: number;
  rating2Count: number;
  rating3Count: number;
  rating4Count: number;
  rating5Count: number;
}

export function StarRating({ rating, onRatingChange, interactive = false }: {
  rating: number;
  onRatingChange?: (rating: number) => void;
  interactive?: boolean;
}) {
  const [hoverRating, setHoverRating] = useState(0);

  return (
    <div className="flex items-center space-x-1">
      {[1, 2, 3, 4, 5].map((star) => (
        <Star
          key={star}
          className={`h-5 w-5 cursor-pointer transition-colors ${
            star <= (hoverRating || rating)
              ? 'fill-slate-400 text-slate-400'
              : 'text-gray-300'
          }`}
          onClick={interactive ? () => onRatingChange?.(star) : undefined}
          onMouseEnter={interactive ? () => setHoverRating(star) : undefined}
          onMouseLeave={interactive ? () => setHoverRating(0) : undefined}
        />
      ))}
    </div>
  );
}

export function RatingDisplay({ courseId }: { courseId: number }) {
  const { data: aggregate } = useQuery<RatingAggregate>({
    queryKey: ['/api/ratings/aggregate', courseId],
    queryFn: async () => {
      const response = await fetch(`/api/ratings/aggregate/${courseId}`);
      if (!response.ok) throw new Error('Failed to fetch ratings');
      return response.json();
    },
  });

  const averageRating = parseFloat(aggregate?.averageRating || '4.8');
  const totalReviews = aggregate?.totalReviews || 0;

  return (
    <div className="flex items-center space-x-2">
      <StarRating rating={averageRating} />
      <span className="text-sm font-medium">{averageRating.toFixed(1)}</span>
      <span className="text-sm text-gray-500">({totalReviews} reviews)</span>
    </div>
  );
}

export function RatingForm({ courseId, onSuccess }: {
  courseId: number;
  onSuccess?: () => void;
}) {
  const [rating, setRating] = useState(0);
  const [reviewText, setReviewText] = useState('');
  const { user } = useAuth();
  const { toast } = useToast();
  const queryClient = useQueryClient();

  const { data: userRating } = useQuery<Rating>({
    queryKey: ['/api/ratings/user', courseId],
    queryFn: async () => {
      const response = await fetch(`/api/ratings/user/${courseId}`);
      if (!response.ok) return null;
      return response.json();
    },
    enabled: !!user,
  });

  const submitRating = useMutation({
    mutationFn: async (data: { rating: number; reviewText?: string }) => {
      return apiRequest('POST', `/api/ratings/${courseId}`, data);
    },
    onSuccess: () => {
      toast({
        title: 'Rating submitted',
        description: 'Thank you for your feedback!',
      });
      queryClient.invalidateQueries({ queryKey: ['/api/ratings'] });
      onSuccess?.();
    },
    onError: () => {
      toast({
        title: 'Error',
        description: 'Failed to submit rating. Please try again.',
        variant: 'destructive',
      });
    },
  });

  if (!user) {
    return (
      <Card>
        <CardContent className="p-6 text-center">
          <p className="text-gray-600">Please log in to rate this course</p>
        </CardContent>
      </Card>
    );
  }

  if (userRating) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="text-lg">Your Rating</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <StarRating rating={userRating.rating} />
          {userRating.reviewText && (
            <p className="text-gray-700">{userRating.reviewText}</p>
          )}
          <p className="text-sm text-gray-500">
            Submitted on {new Date(userRating.createdAt).toLocaleDateString()}
          </p>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-lg">Rate This Course</CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        <div>
          <label className="block text-sm font-medium mb-2">Your Rating</label>
          <StarRating 
            rating={rating} 
            onRatingChange={setRating} 
            interactive 
          />
        </div>
        
        <div>
          <label className="block text-sm font-medium mb-2">Review (Optional)</label>
          <Textarea
            value={reviewText}
            onChange={(e) => setReviewText(e.target.value)}
            placeholder="Share your experience with this course..."
            className="min-h-[100px]"
          />
        </div>

        <Button
          onClick={() => submitRating.mutate({ rating, reviewText })}
          disabled={rating === 0 || submitRating.isPending}
          className="w-full"
        >
          {submitRating.isPending ? 'Submitting...' : 'Submit Rating'}
        </Button>
      </CardContent>
    </Card>
  );
}

export function ReviewsList({ courseId }: { courseId: number }) {
  const { data: reviews = [] } = useQuery<Rating[]>({
    queryKey: ['/api/ratings/reviews', courseId],
    queryFn: async () => {
      const response = await fetch(`/api/ratings/reviews/${courseId}`);
      if (!response.ok) throw new Error('Failed to fetch reviews');
      return response.json();
    },
  });

  if (reviews.length === 0) {
    return (
      <Card>
        <CardContent className="p-6 text-center">
          <MessageSquare className="h-12 w-12 text-gray-400 mx-auto mb-4" />
          <p className="text-gray-600">No reviews yet. Be the first to review!</p>
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="space-y-4">
      <h3 className="text-lg font-semibold">Student Reviews</h3>
      {reviews.map((review) => (
        <Card key={review.id}>
          <CardContent className="p-4">
            <div className="flex items-start space-x-3">
              <div className="bg-gray-200 rounded-full p-2">
                <User className="h-4 w-4 text-gray-600" />
              </div>
              <div className="flex-1">
                <div className="flex items-center space-x-2 mb-2">
                  <span className="font-medium">{review.userName || 'Anonymous'}</span>
                  <StarRating rating={review.rating} />
                  <span className="text-sm text-gray-500">
                    {new Date(review.createdAt).toLocaleDateString()}
                  </span>
                </div>
                {review.reviewText && (
                  <p className="text-gray-700">{review.reviewText}</p>
                )}
              </div>
            </div>
          </CardContent>
        </Card>
      ))}
    </div>
  );
}

export default function RatingSystem({ 
  courseId, 
  courseSlug, 
  showReviewForm = true 
}: RatingSystemProps) {
  return (
    <div className="space-y-6">
      <RatingDisplay courseId={courseId} />
      {showReviewForm && <RatingForm courseId={courseId} />}
      <ReviewsList courseId={courseId} />
    </div>
  );
}