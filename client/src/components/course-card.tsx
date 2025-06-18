import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Clock, Users, Star, ChevronRight, Award } from "lucide-react";
import { Link } from "wouter";
import type { Course, Category } from "@shared/schema";

interface CourseCardProps {
  course: Course & { category: Category };
  certifiedCount?: number;
  rating?: number;
  viewMode?: "grid" | "list";
}

export default function CourseCard({
  course,
  certifiedCount = 10,
  rating = 4.8,
  viewMode = "grid",
}: CourseCardProps) {
  return (
    <Card
      className={`group hover:shadow-lg transition-all duration-300 border-2 hover:border-black relative ${
        viewMode === "list" ? "flex flex-row" : ""
      }`}
    >
      <div className={`${viewMode === "list" ? "w-64 flex-shrink-0" : ""}`}>
        <div className="aspect-video bg-gradient-to-br from-gray-900 to-black rounded-t-lg relative overflow-hidden">
          <div className="absolute inset-0 bg-black bg-opacity-60 flex items-center justify-center">
            <Award className="h-12 w-12 text-white" />
          </div>
          <div className="absolute top-4 left-4">
            <Badge
              variant="secondary"
              className="bg-white text-black font-bold"
            >
              {course.category.name}
            </Badge>
          </div>
          <div className="absolute top-4 right-4 flex gap-2">
            <Badge
              variant="outline"
              className="bg-black text-white border-white"
            >
              {course.duration} mins
            </Badge>
            {course.isOnSale && (
              <Badge className="bg-red-600 text-white font-bold shadow-lg">
                SALE
              </Badge>
            )}
          </div>
        </div>
      </div>

      <div className={`${viewMode === "list" ? "flex-1" : ""}`}>
        <CardHeader className="pb-3">
          <div className="flex items-start justify-between gap-2">
            <CardTitle className="text-lg group-hover:text-blue-600 transition-colors">
              {course.title}
            </CardTitle>
            <div className="flex items-center gap-1 text-yellow-500">
              <Star className="h-4 w-4 fill-current" />
              <span className="text-sm font-medium">{rating}</span>
            </div>
          </div>
          <p className="text-sm text-gray-600 line-clamp-2">
            {course.description}
          </p>
        </CardHeader>

        <CardContent className="pt-0">
          <div className="space-y-3">
            <div className="flex items-center gap-4 text-sm text-gray-600">
              <div className="flex items-center gap-1">
                <Clock className="h-4 w-4" />
                {course.duration} mins
              </div>
              <div className="flex items-center gap-1">
                <Users className="h-4 w-4" />
                {certifiedCount}+ certified
              </div>
              <div className="flex items-center gap-1">
                <Award className="h-4 w-4" />
                {course.level || "All Levels"}
              </div>
            </div>

            <div className="flex items-center justify-between">
              <div className="space-y-1">
                {course.isOnSale && course.originalPrice ? (
                  <div className="space-y-1">
                    <div className="flex items-center gap-2">
                      <span className="text-2xl font-bold text-red-600">
                        ₹{course.price}
                      </span>
                      <span className="text-lg text-gray-500 line-through">
                        ₹{course.originalPrice}
                      </span>
                    </div>
                    <div className="flex items-center gap-2">
                      <div className="text-sm text-green-600 font-medium">
                        Save ₹
                        {(
                          parseFloat(course.originalPrice) -
                          parseFloat(course.price)
                        ).toFixed(0)}
                      </div>
                      <div className="bg-red-100 text-red-800 px-2 py-0.5 rounded text-xs font-semibold">
                        {Math.round(
                          ((parseFloat(course.originalPrice) -
                            parseFloat(course.price)) /
                            parseFloat(course.originalPrice)) *
                            100
                        )}
                        % OFF
                      </div>
                    </div>
                  </div>
                ) : (
                  <div className="text-2xl font-bold text-black">
                    ₹{course.price}
                  </div>
                )}
              </div>
              <Link href={`/course/${course.id}`}>
                <Button className="bg-black hover:bg-gray-800 text-white group">
                  Learn More
                  <ChevronRight className="ml-2 h-4 w-4 group-hover:translate-x-1 transition-transform" />
                </Button>
              </Link>
            </div>
          </div>
        </CardContent>
      </div>
    </Card>
  );
}
