import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Clock, Users, Star, ChevronRight, Award } from "lucide-react";
import { Link } from "wouter";
import type { Course, Category } from "@shared/schema";

// Import category images (fallbacks)
import aiImage from "@/assets/course-images/ai-assessment.jpg";
import developmentImage from "@/assets/course-images/development-assessment.jpg";
import businessImage from "@/assets/course-images/business-assessment.jpg";
import internshipImage from "@/assets/course-images/internship-assessment.jpg";

// Import specific course images
import businessStrategyImage from "@/assets/course-images/business-strategy-fundamentals.jpg";
import financialAnalysisImage from "@/assets/course-images/financial-analysis-professional.jpg";
import leadershipImage from "@/assets/course-images/leadership-management.jpg";
import digitalMarketingImage from "@/assets/course-images/digital-marketing-fundamentals.jpg";
import businesAnalyticsInternship from "@/assets/course-images/business-analytics-internship.jpg";
import digitalMarketingInternship from "@/assets/course-images/digital-marketing-internship.jpg";
import softwareDevelopmentInternship from "@/assets/course-images/software-development-internship.png";
import cybersecurityInternship from "@/assets/course-images/cybersecurity-internship.jpg";
import dataScienceInternship from "@/assets/course-images/data-science.jpg";
import devOpsAutomationEngineer from "@/assets/course-images/DevOps-Automation-Engineer.jpg";
import CloudSecurityArchitect from "@/assets/course-images/CloudSecurityArchitect.jpg";
import SiteReliabilityEngineerPro from "@/assets/course-images/site-reliability-engineer-pro.jpg";
import AWSCloudArchitectProfessional from "@/assets/course-images/AWS.png";
import reactImage from "@/assets/course-images/react-development-mastery.jpg";
import nodejsImage from "@/assets/course-images/nodejs-backend-development.jpg";
import mlImage from "@/assets/course-images/machine-learning-fundamentals.jpg";
import dataScienceImage from "@/assets/course-images/data-science-internship.jpg";
import pythonImage from "@/assets/course-images/python-programming-mastery.jpg";
import cloudImage from "@/assets/course-images/cloud-computing-essentials.jpg";

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
  const courseSlug = course.slug || course.title.toLowerCase()
    .replace(/[^a-zA-Z0-9\s]/g, '')
    .replace(/\s+/g, '-');

  // Function to get the appropriate image based on course slug/title
  const getCourseImage = (courseSlug: string, categoryName: string) => {
    // First try to match specific course images by slug
    switch (courseSlug) {
      case 'business-strategy-fundamentals':
        return businessStrategyImage;
      case 'financial-analysis-professional':
        return financialAnalysisImage;
      case 'leadership-management':
        return leadershipImage;
      case 'digital-marketing-fundamentals':
        return digitalMarketingImage;
      case 'business-analytics-internship':
        return businesAnalyticsInternship;
      case 'digital-marketing-internship':
        return digitalMarketingInternship;
      case 'software-development-internship':
        return softwareDevelopmentInternship;
      case 'cybersecurity-internship':
        return cybersecurityInternship;
      case 'data-science-internship':
        return dataScienceInternship;
      case 'devops-automation-engineer':
        return devOpsAutomationEngineer;
      case 'cloud-security-architect':
        return CloudSecurityArchitect;
      case 'site-reliability-engineer-pro':
        return SiteReliabilityEngineerPro;
      case 'aws-cloud-architect-professional':
        return AWSCloudArchitectProfessional;
      case 'react-development-mastery':
        return reactImage;
      case 'nodejs-backend-development':
        return nodejsImage;
      case 'machine-learning-fundamentals':
        return mlImage;
      case 'python-programming-mastery':
        return pythonImage;
      case 'cloud-computing-essentials':
        return cloudImage;
      default:
        // Fall back to category-based images
        switch (categoryName.toLowerCase()) {
          case 'ai':
            return aiImage;
          case 'development':
            return developmentImage;
          case 'business':
            return businessImage;
          case 'internships':
            return internshipImage;
          default:
            return businessImage;
        }
    }
  };
  return (
    <Card
      className={`group hover:shadow-lg transition-all duration-300 border-2 hover:border-black relative ${
        viewMode === "list" ? "flex flex-row" : ""
      }`}
    >
      <div className={`${viewMode === "list" ? "w-64 flex-shrink-0" : ""}`}>
        <div className="aspect-video bg-gradient-to-br from-gray-900 to-black rounded-t-lg relative overflow-hidden">
          <img 
            src={getCourseImage(courseSlug, course.category.name)} 
            alt={`${course.title} assessment`}
            className="absolute inset-0 w-full h-full object-cover"
          />
          <div className="absolute inset-0 bg-black bg-opacity-40"></div>
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
              <Link href={`/course/${courseSlug}`}>
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
