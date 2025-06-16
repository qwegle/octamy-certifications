import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Clock, Users, Star } from "lucide-react";
import { Link } from "wouter";
import type { Course, Category } from "@shared/schema";

interface CourseCardProps {
  course: Course & { category: Category };
  certifiedCount?: number;
  rating?: number;
}

export default function CourseCard({ course, certifiedCount = 0, rating = 4.8 }: CourseCardProps) {
  return (
    <Card className="bg-white rounded-xl shadow-lg border border-octamy-gray-200 overflow-hidden hover:shadow-xl transition-all duration-300">
      <CardContent className="p-8">
        <div className="flex items-center justify-between mb-4">
          <Badge variant="secondary" className="bg-octamy-gray-100 text-octamy-black">
            {course.category.name}
          </Badge>
          <div className="flex items-center text-octamy-gray-500 text-sm">
            <Clock className="w-4 h-4 mr-1" />
            <span>{course.duration} mins</span>
          </div>
        </div>
        
        <h3 className="text-xl font-bold text-octamy-black mb-3">{course.title}</h3>
        <p className="text-octamy-gray-600 mb-6">{course.description}</p>
        
        <div className="flex items-center justify-between mb-6">
          <div className="flex items-center text-sm text-octamy-gray-500">
            <Users className="w-4 h-4 mr-2" />
            <span>{certifiedCount} certified</span>
          </div>
          <div className="flex items-center text-sm text-octamy-gray-500">
            <Star className="w-4 h-4 mr-1 text-yellow-400 fill-current" />
            <span>{rating}</span>
          </div>
        </div>
        
        <Link href={`/exam/${course.id}`}>
          <Button className="w-full bg-octamy-black text-white hover:bg-octamy-gray-800">
            Attempt Now - ₹{course.price}
          </Button>
        </Link>
      </CardContent>
    </Card>
  );
}
