import { useState, useEffect } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { apiRequest } from "@/lib/queryClient";
import { Bell, BellOff, X, BookOpen, Star, TrendingUp, Users } from "lucide-react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { useToast } from "@/hooks/use-toast";
import { publicProductPath } from "@shared/public-assessment-routes";

interface Notification {
  id: number;
  title: string;
  message: string;
  type: string;
  isRead: boolean;
  createdAt: string;
  data?: {
    courseId?: number;
    certificateId?: string;
    actionUrl?: string;
    priority?: string;
  };
}

interface RecommendedCourse {
  id?: number;
  slug?: string;
  title?: string;
  description?: string;
  price?: string | number;
  level?: string;
  productType?: "assessment" | "video_course" | "ebook" | "bundle";
  category?: {
    name?: string;
  } | null;
}

interface RecommendationDetails {
  id?: number;
  reason?: string;
  score?: string | number;
  course?: RecommendedCourse | null;
}

interface CourseRecommendation extends RecommendedCourse, RecommendationDetails {
  course_recommendations?: RecommendationDetails | null;
}

export function SmartNotifications() {
  const [showNotifications, setShowNotifications] = useState(false);
  const { toast } = useToast();
  const queryClient = useQueryClient();

  // Fetch notifications
  const { data: notifications = [], isLoading: notificationsLoading } = useQuery<Notification[]>({
    queryKey: ["/api/notifications"],
    retry: false,
  });

  // Fetch recommendations
  const { data: recommendations = [], isLoading: recommendationsLoading } = useQuery<CourseRecommendation[]>({
    queryKey: ["/api/recommendations"],
    retry: false,
  });

  // Generate recommendations mutation
  const generateRecommendations = useMutation({
    mutationFn: () => apiRequest("POST", "/api/recommendations/generate"),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/recommendations"] });
      toast({
        title: "Recommendations Updated",
        description: "New course recommendations generated based on your activity",
      });
    },
    onError: () => {
      toast({
        title: "Error",
        description: "Failed to generate recommendations",
        variant: "destructive",
      });
    },
  });

  // Mark notification as read
  const markAsRead = useMutation({
    mutationFn: (notificationId: number) => apiRequest("PUT", `/api/notifications/${notificationId}/read`),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/notifications"] });
    },
  });

  // Mark all as read
  const markAllAsRead = useMutation({
    mutationFn: () => apiRequest("PUT", "/api/notifications/read-all"),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/notifications"] });
      toast({
        title: "All notifications marked as read",
      });
    },
  });

  const unreadCount = notifications.filter((notification) => !notification.isRead).length;

  const getReasonIcon = (reason: string) => {
    switch (reason) {
      case "based_on_category":
        return <BookOpen className="w-4 h-4" />;
      case "trending":
        return <TrendingUp className="w-4 h-4" />;
      case "popular":
        return <Users className="w-4 h-4" />;
      default:
        return <Star className="w-4 h-4" />;
    }
  };

  const getReasonText = (reason: string) => {
    switch (reason) {
      case "based_on_category":
        return "Based on your interests";
      case "trending":
        return "Trending now";
      case "popular":
        return "Popular choice";
      default:
        return "Recommended for you";
    }
  };

  return (
    <div className="relative">
      {/* Notification Bell */}
      <Button
        variant="ghost"
        size="sm"
        onClick={() => setShowNotifications(!showNotifications)}
        className="relative"
      >
        {unreadCount > 0 ? <Bell className="w-5 h-5" /> : <BellOff className="w-5 h-5" />}
        {unreadCount > 0 && (
          <Badge 
            variant="destructive" 
            className="absolute -top-2 -right-2 w-5 h-5 rounded-full p-0 flex items-center justify-center text-xs"
          >
            {unreadCount > 99 ? "99+" : unreadCount}
          </Badge>
        )}
      </Button>

      {/* Notifications Panel */}
      {showNotifications && (
        <div className="absolute right-0 top-full mt-2 w-96 bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-700 rounded-lg shadow-lg z-50 max-h-96 overflow-hidden">
          <div className="p-4 border-b border-gray-200 dark:border-gray-700 flex items-center justify-between">
            <h3 className="font-semibold">Notifications</h3>
            <div className="flex items-center gap-2">
              {unreadCount > 0 && (
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => markAllAsRead.mutate()}
                  disabled={markAllAsRead.isPending}
                >
                  Mark all read
                </Button>
              )}
              <Button
                variant="ghost"
                size="sm"
                onClick={() => setShowNotifications(false)}
              >
                <X className="w-4 h-4" />
              </Button>
            </div>
          </div>

          <div className="overflow-y-auto max-h-80">
            {notificationsLoading ? (
              <div className="p-4">Loading notifications...</div>
            ) : notifications.length === 0 ? (
              <div className="p-4 text-center text-gray-500 dark:text-gray-400">
                No notifications yet
              </div>
            ) : (
              notifications.map((notification) => (
                <div
                  key={notification.id}
                  className={`p-4 border-b border-gray-100 dark:border-gray-800 cursor-pointer hover:bg-gray-50 dark:hover:bg-gray-800 ${
                    !notification.isRead ? "bg-blue-50 dark:bg-blue-900/20" : ""
                  }`}
                  onClick={() => !notification.isRead && markAsRead.mutate(notification.id)}
                >
                  <div className="flex items-start justify-between">
                    <div className="flex-1">
                      <h4 className="font-medium text-sm">{notification.title}</h4>
                      <p className="text-sm text-gray-600 dark:text-gray-300 mt-1">
                        {notification.message}
                      </p>
                      <p className="text-xs text-gray-400 mt-2">
                        {new Date(notification.createdAt).toLocaleDateString()}
                      </p>
                    </div>
                    {!notification.isRead && (
                      <div className="w-2 h-2 bg-blue-500 rounded-full flex-shrink-0 mt-1"></div>
                    )}
                  </div>
                </div>
              ))
            )}
          </div>
        </div>
      )}

      {/* Course Recommendations Section */}
      <div className="mt-8">
        <Card>
          <CardHeader>
            <div className="flex items-center justify-between">
              <div>
                <CardTitle className="flex items-center gap-2">
                  <BookOpen className="w-5 h-5" />
                  Recommended for You
                </CardTitle>
                <CardDescription>
                  Personalized course suggestions based on your learning journey
                </CardDescription>
              </div>
              <Button
                variant="outline"
                size="sm"
                onClick={() => generateRecommendations.mutate()}
                disabled={generateRecommendations.isPending}
              >
                {generateRecommendations.isPending ? "Generating..." : "Refresh"}
              </Button>
            </div>
          </CardHeader>
          <CardContent>
            {recommendationsLoading ? (
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {[1, 2, 3, 4].map((i) => (
                  <div key={i} className="h-32 bg-gray-100 dark:bg-gray-800 rounded-lg animate-pulse"></div>
                ))}
              </div>
            ) : recommendations.length === 0 ? (
              <div className="text-center py-8">
                <BookOpen className="w-12 h-12 mx-auto text-gray-400 mb-4" />
                <p className="text-gray-500 dark:text-gray-400 mb-4">
                  No recommendations available yet
                </p>
                <Button
                  onClick={() => generateRecommendations.mutate()}
                  disabled={generateRecommendations.isPending}
                >
                  Generate Recommendations
                </Button>
              </div>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {recommendations.map((rec) => {
                  // Handle different API response structures
                  const course = rec.course || rec.course_recommendations?.course || rec;
                  const recommendation = rec.course_recommendations || rec;
                  const reason = recommendation.reason ?? rec.reason ?? "recommended";
                  const recommendationScore = Number(recommendation.score ?? rec.score ?? 0.5);
                  
                  if (!course || !course.title) {
                    return null; // Skip invalid entries
                  }
                  
                  return (
                    <Card key={rec.id || recommendation.id} className="border-2 hover:border-blue-500 transition-colors">
                      <CardContent className="p-4">
                        <div className="flex items-start justify-between mb-2">
                          <Badge variant="secondary" className="flex items-center gap-1">
                            {getReasonIcon(reason)}
                            {getReasonText(reason)}
                          </Badge>
                          <div className="flex items-center gap-1">
                            <Star className="w-3 h-3 fill-yellow-400 text-yellow-400" />
                            <span className="text-xs font-medium">
                              {(recommendationScore * 100).toFixed(0)}%
                            </span>
                          </div>
                        </div>
                        <h4 className="font-semibold text-sm mb-1">{course.title}</h4>
                        <p className="text-xs text-gray-600 dark:text-gray-300 mb-2 line-clamp-2">
                          {course.description}
                        </p>
                        <div className="flex items-center justify-between">
                          <div className="flex items-center gap-2">
                            <Badge variant="outline" className="text-xs">
                              {course.category?.name || 'General'}
                            </Badge>
                            <Badge variant="outline" className="text-xs">
                              {course.level || 'Beginner'}
                            </Badge>
                          </div>
                          <span className="text-sm font-semibold">₹{course.price || '99.00'}</span>
                        </div>
                        <Button className="w-full mt-3" size="sm" asChild>
                          <a href={publicProductPath(course.slug || course.id, course.productType || "assessment")}>
                            Explore Course
                          </a>
                        </Button>
                      </CardContent>
                    </Card>
                  );
                })}
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
