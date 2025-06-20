import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Clock, Star, Brain, Users } from "lucide-react";
import { Link } from "wouter";

interface Course {
  id: number;
  title: string;
  description: string;
  slug: string;
  duration: number;
  price: string;
  level: string;
  courseType?: string;
  isPreferred?: boolean;
}

interface CourseCardProps {
  course: Course;
}

export default function CourseCard({ course }: CourseCardProps) {
  const isAiInteractive = course.courseType === "ai_interactive";
  const isPreferred = course.isPreferred;

  return (
    <Card className="bg-white hover:shadow-lg transition-shadow border border-gray-200">
      <CardHeader>
        <div className="flex justify-between items-start">
          <div className="flex-1">
            <CardTitle className="text-xl text-gray-900 line-clamp-2">
              {course.title}
            </CardTitle>
            <CardDescription className="text-gray-600 mt-2 line-clamp-3">
              {course.description}
            </CardDescription>
          </div>
          <div className="flex flex-col gap-2 ml-4">
            {isPreferred && (
              <Badge className="bg-yellow-100 text-yellow-800 border-yellow-200">
                <Star className="w-3 h-3 mr-1" />
                Preferred
              </Badge>
            )}
            {isAiInteractive && (
              <Badge className="bg-purple-100 text-purple-800 border-purple-200">
                <Brain className="w-3 h-3 mr-1" />
                AI Interactive
              </Badge>
            )}
          </div>
        </div>
      </CardHeader>
      <CardContent>
        <div className="flex items-center justify-between text-sm text-gray-600 mb-4">
          <div className="flex items-center gap-4">
            <div className="flex items-center gap-1">
              <Clock className="w-4 h-4" />
              <span>{course.duration} min</span>
            </div>
            <Badge variant="outline" className="text-xs">
              {course.level}
            </Badge>
          </div>
          <div className="text-lg font-bold text-gray-900">
            ₹{course.price}
          </div>
        </div>

        {isAiInteractive ? (
          <div className="space-y-3">
            <div className="bg-purple-50 p-3 rounded-lg">
              <div className="flex items-center gap-2 mb-1">
                <Brain className="w-4 h-4 text-purple-600" />
                <span className="text-sm font-semibold text-purple-800">AI-Powered Assessment</span>
              </div>
              <p className="text-xs text-purple-700">
                Interactive conversation-based evaluation with our AI interviewer
              </p>
            </div>
            <Link href={`/ai-exam/${course.id}`}>
              <Button className="w-full bg-purple-600 hover:bg-purple-700 text-white">
                Start AI Interview
              </Button>
            </Link>
          </div>
        ) : (
          <Link href={`/course/${course.id}`}>
            <Button className="w-full bg-black hover:bg-gray-800 text-white">
              Take Assessment
            </Button>
          </Link>
        )}

        {isPreferred && (
          <div className="mt-3 bg-yellow-50 p-2 rounded text-xs text-yellow-800">
            <div className="flex items-center gap-1">
              <Users className="w-3 h-3" />
              <span className="font-semibold">Recruiter Favorite</span>
            </div>
            <p>Highly valued by hiring managers for candidate assessment</p>
          </div>
        )}
      </CardContent>
    </Card>
  );
}