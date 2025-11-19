import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Link } from "wouter";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { Trophy, Medal, Award } from "lucide-react";
import Header from "@/components/header";
import Footer from "@/components/footer";
import type { Course, Leaderboard, Category } from "@shared/schema";

type LeaderboardWithCourse = Leaderboard & { courseTitle: string | null; courseSlug: string | null };

export default function LeaderboardPage() {
  const [selectedCourseId, setSelectedCourseId] = useState<number | null>(null);

  const { data: coursesData } = useQuery<(Course & { category: Category })[]>({
    queryKey: ["/api/all-courses"],
  });

  const courses = coursesData || [];

  const queryKey = selectedCourseId 
    ? [`/api/leaderboard?courseId=${selectedCourseId}&limit=100`]
    : ["/api/leaderboard?limit=100"];
    
  const { data: leaderboardData = [], isLoading } = useQuery<LeaderboardWithCourse[]>({
    queryKey
  });

  const getRankIcon = (rank: number) => {
    switch (rank) {
      case 1:
        return <Trophy className="w-6 h-6 text-yellow-500" />;
      case 2:
        return <Medal className="w-6 h-6 text-gray-400" />;
      case 3:
        return <Medal className="w-6 h-6 text-amber-600" />;
      default:
        return <span className="w-6 h-6 text-center font-bold text-gray-600">{rank}</span>;
    }
  };

  const getBadgeVariant = (badge: string) => {
    switch (badge.toLowerCase()) {
      case 'distinction':
        return 'default';
      case 'merit':
        return 'secondary';
      default:
        return 'outline';
    }
  };

  return (
    <div className="min-h-screen bg-gray-50">
      <Header />

      <div className="max-w-7xl mx-auto px-6 py-12">
        {/* Header */}
        <div className="text-center mb-12">
          <div className="flex items-center justify-center gap-3 mb-4">
            <Trophy className="w-12 h-12 text-yellow-500" />
            <h1 className="text-4xl font-bold text-black">Leaderboard</h1>
          </div>
          <p className="text-lg text-gray-600 max-w-2xl mx-auto">
            See how you rank against other top performers. Practice, excel, and earn your place among the best!
          </p>
        </div>

        {/* Filter */}
        <div className="flex justify-center mb-8">
          <Select
            value={selectedCourseId?.toString() || "all"}
            onValueChange={(value) => setSelectedCourseId(value === "all" ? null : parseInt(value))}
          >
            <SelectTrigger className="w-[300px]" data-testid="select-course-filter">
              <SelectValue placeholder="All Exams" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Exams</SelectItem>
              {courses.map((course) => (
                <SelectItem key={course.id} value={course.id.toString()}>
                  {course.title}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        {/* Leaderboard */}
        <Card className="border-2">
          <CardHeader>
            <CardTitle className="text-2xl">Top Performers</CardTitle>
            <CardDescription>
              {selectedCourseId ? "Filtered by exam" : "Showing all exams"}
            </CardDescription>
          </CardHeader>
          <CardContent>
            {isLoading ? (
              <div className="text-center py-12 text-gray-600">
                Loading leaderboard...
              </div>
            ) : leaderboardData.length === 0 ? (
              <div className="text-center py-12 text-gray-600">
                <Award className="w-16 h-16 mx-auto mb-4 text-gray-400" />
                <p className="text-lg">No scores yet. Be the first to practice and get on the leaderboard!</p>
                <Link href="/exams">
                  <Button className="mt-4" data-testid="button-start-practicing">Start Practicing</Button>
                </Link>
              </div>
            ) : (
              <div className="space-y-2">
                {leaderboardData.map((entry, index) => {
                  const rank = index + 1;
                  const isTopThree = rank <= 3;
                  
                  return (
                    <div
                      key={entry.id}
                      className={`flex items-center gap-4 p-4 rounded-lg border-2 transition-colors ${
                        isTopThree
                          ? 'bg-gradient-to-r from-yellow-50 to-white border-yellow-300 hover:border-yellow-400'
                          : 'bg-white border-gray-200 hover:border-gray-300'
                      }`}
                      data-testid={`leaderboard-entry-${entry.id}`}
                    >
                      {/* Rank */}
                      <div className="flex-shrink-0 w-12 flex items-center justify-center">
                        {getRankIcon(rank)}
                      </div>

                      {/* User Info */}
                      <div className="flex-1 min-w-0">
                        <div className="font-semibold text-black truncate">
                          {entry.userName}
                        </div>
                        <div className="text-sm text-gray-600 truncate">
                          {entry.userEmail}
                        </div>
                        {entry.businessName && (
                          <div className="text-xs text-gray-500 truncate">
                            {entry.businessName}
                          </div>
                        )}
                      </div>

                      {/* Course */}
                      <div className="hidden md:block flex-1 text-sm text-gray-700 truncate">
                        {entry.courseTitle || 'Unknown Exam'}
                      </div>

                      {/* Badge */}
                      <div className="flex-shrink-0">
                        <Badge variant={getBadgeVariant(entry.badge)}>
                          {entry.badge}
                        </Badge>
                      </div>

                      {/* Score */}
                      <div className="flex-shrink-0 text-right">
                        <div className="text-2xl font-bold text-black">
                          {entry.score}%
                        </div>
                        <div className="text-xs text-gray-500">
                          {new Date(entry.achievedAt).toLocaleDateString()}
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </CardContent>
        </Card>

        {/* Call to Action */}
        <div className="mt-12 text-center">
          <Card className="border-2 border-black">
            <CardHeader>
              <CardTitle className="text-2xl">Want to see your name here?</CardTitle>
              <CardDescription>
                Practice exams and score high to climb the leaderboard rankings!
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="flex gap-4 justify-center">
                <Link href="/exams">
                  <Button size="lg" className="bg-black text-white hover:bg-gray-800" data-testid="button-start-practicing-cta">
                    Start Practicing Now
                  </Button>
                </Link>
                <Link href="/dashboard">
                  <Button size="lg" variant="outline" className="border-black" data-testid="button-view-progress">
                    View My Progress
                  </Button>
                </Link>
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}
