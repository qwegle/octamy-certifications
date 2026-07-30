import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  Atom,
  Award,
  BrainCircuit,
  BriefcaseBusiness,
  Calculator,
  ChevronRight,
  Clock,
  Cloud,
  Code2,
  GraduationCap,
  Languages,
  Landmark,
  PackageOpen,
  ShieldCheck,
  Star,
  Users,
  type LucideIcon,
} from "lucide-react";
import { Link } from "wouter";
import type { Course, Category } from "@shared/schema";
import {
  getAssessmentCardPricing,
  getAssessmentVisualIdentity,
  type AssessmentIconKey,
} from "@/lib/assessment-visual-identity";
import { publicAssessmentPath, publicPracticePath } from "@shared/public-assessment-routes";

import aiImage from "@/assets/course-images/ai-assessment.jpg";
import developmentImage from "@/assets/course-images/development-assessment.jpg";
import businessImage from "@/assets/course-images/business-assessment.jpg";
import internshipImage from "@/assets/course-images/internship-assessment.jpg";
import businessStrategyImage from "@/assets/course-images/business-strategy-fundamentals.jpg";
import financialAnalysisImage from "@/assets/course-images/financial-analysis-professional.jpg";
import leadershipImage from "@/assets/course-images/leadership-management.jpg";
import digitalMarketingImage from "@/assets/course-images/digital-marketing-fundamentals.jpg";
import businesAnalyticsInternship from "@/assets/course-images/business-analytics-internship.jpg";
import digitalMarketingInternship from "@/assets/course-images/digital-marketing-internship.jpg";
import softwareDevelopmentInternship from "@/assets/course-images/software-development-internship.webp";
import cybersecurityInternship from "@/assets/course-images/cybersecurity-internship.jpg";
import dataScienceInternship from "@/assets/course-images/data-science.jpg";
import devOpsAutomationEngineer from "@/assets/course-images/DevOps-Automation-Engineer.jpg";
import CloudSecurityArchitect from "@/assets/course-images/CloudSecurityArchitect.jpg";
import SiteReliabilityEngineerPro from "@/assets/course-images/site-reliability-engineer-pro.jpg";
import AWSCloudArchitectProfessional from "@/assets/course-images/AWS.webp";
import reactImage from "@/assets/course-images/react-development-mastery.jpg";
import nodejsImage from "@/assets/course-images/nodejs-backend-development.jpg";
import mlImage from "@/assets/course-images/machine-learning-fundamentals.jpg";
import pythonImage from "@/assets/course-images/python-programming-mastery.jpg";
import cloudImage from "@/assets/course-images/cloud-computing-essentials.jpg";

interface CourseCardProps {
  course: Course & { category: Category };
  certifiedCount?: number;
  rating?: number;
  viewMode?: "grid" | "list";
}

const topicIcons: Record<AssessmentIconKey, LucideIcon> = {
  atom: Atom,
  brain: BrainCircuit,
  briefcase: BriefcaseBusiness,
  calculator: Calculator,
  cloud: Cloud,
  code: Code2,
  containers: PackageOpen,
  graduation: GraduationCap,
  language: Languages,
  landmark: Landmark,
  security: ShieldCheck,
};

const courseImages: Record<string, string> = {
  "business-strategy-fundamentals": businessStrategyImage,
  "financial-analysis-professional": financialAnalysisImage,
  "leadership-management": leadershipImage,
  "digital-marketing-fundamentals": digitalMarketingImage,
  "business-analytics-internship": businesAnalyticsInternship,
  "digital-marketing-internship": digitalMarketingInternship,
  "software-development-internship": softwareDevelopmentInternship,
  "cybersecurity-internship": cybersecurityInternship,
  "data-science-internship": dataScienceInternship,
  "devops-automation-engineer": devOpsAutomationEngineer,
  "cloud-security-architect": CloudSecurityArchitect,
  "site-reliability-engineer-pro": SiteReliabilityEngineerPro,
  "aws-cloud-architect-professional": AWSCloudArchitectProfessional,
  "react-development-mastery": reactImage,
  "nodejs-backend-development": nodejsImage,
  "machine-learning-fundamentals": mlImage,
  "python-programming-mastery": pythonImage,
  "cloud-computing-essentials": cloudImage,
};

function fallbackCourseImage(categoryName: string): string {
  const fallbacks: Record<string, string> = {
    ai: aiImage,
    development: developmentImage,
    business: businessImage,
    internships: internshipImage,
  };
  return fallbacks[categoryName.toLowerCase()] || businessImage;
}

export default function CourseCard({ course, certifiedCount, rating, viewMode = "grid" }: CourseCardProps) {
  const isAssessment = course.productType === "assessment";
  const isPractice = isAssessment && course.assessmentPurpose === "practice";
  const courseSlug = course.slug || course.title.toLowerCase().replace(/[^a-zA-Z0-9\s]/g, "").replace(/\s+/g, "-");
  const identity = getAssessmentVisualIdentity({ slug: courseSlug, title: course.title, category: course.category.name });
  const pricing = getAssessmentCardPricing({
    variant: isPractice ? "practice" : "certification",
    price: course.price,
    originalPrice: course.originalPrice,
    isOnSale: course.isOnSale,
  });
  const TopicIcon = topicIcons[identity.iconKey];
  const href = isAssessment
    ? (isPractice ? publicPracticePath(courseSlug) : publicAssessmentPath(courseSlug))
    : `/learn/${courseSlug}`;

  return (
    <Card
      data-card-kind={isAssessment ? (isPractice ? "practice" : "certification") : "course"}
      className={`group relative overflow-hidden transition-all duration-300 hover:-translate-y-0.5 hover:shadow-xl ${
        isPractice ? "border-2 border-slate-200 bg-slate-50/30 hover:border-slate-400" : "border border-slate-200 hover:border-slate-400"
      } ${viewMode === "list" ? "flex flex-col sm:flex-row" : ""}`}
    >
      <div className={viewMode === "list" ? "w-full flex-shrink-0 sm:w-64" : ""}>
        <div className={`relative aspect-video overflow-hidden ${isAssessment ? `bg-gradient-to-br ${identity.headerClass}` : "bg-slate-950"}`}>
          {isAssessment ? (
            <div className="absolute inset-0 flex flex-col justify-between p-5 text-white">
              <div className="flex items-start justify-between gap-2">
                <Badge className="border border-white/20 bg-black/20 text-white hover:bg-black/20">{isPractice ? "Practice exam" : "Certification exam"}</Badge>
                <TopicIcon className="h-7 w-7" aria-hidden="true" />
              </div>
              <p className="flex items-center gap-2 text-sm font-bold"><TopicIcon className="h-4 w-4" aria-hidden="true" />{identity.topicLabel}</p>
            </div>
          ) : (
            <>
              <img src={course.thumbnailUrl || courseImages[courseSlug] || fallbackCourseImage(course.category.name)} alt={`${course.title} course`} className="absolute inset-0 h-full w-full object-cover" />
              <div className="absolute inset-0 bg-black/40" />
              <Badge variant="secondary" className="absolute left-4 top-4 bg-white font-bold text-black">{course.category.name}</Badge>
            </>
          )}
          {course.duration != null && <Badge variant="outline" className="absolute right-4 top-4 border-white bg-black/60 text-white">{course.duration} mins</Badge>}
        </div>
      </div>

      <div className={viewMode === "list" ? "flex-1" : ""}>
        <CardHeader className="pb-3">
          <div className="flex items-start justify-between gap-2">
            <CardTitle className="text-lg transition-colors group-hover:text-slate-700">{course.title}</CardTitle>
            {typeof rating === "number" && rating > 0 && <div className="flex items-center gap-1 text-slate-500" aria-label={`${rating} out of 5 rating`}><Star className="h-4 w-4 fill-current" /><span className="text-sm font-medium">{rating.toFixed(1)}</span></div>}
          </div>
          <p className="line-clamp-2 text-sm text-slate-600">{course.description}</p>
        </CardHeader>

        <CardContent className="pt-0">
          <div className="flex flex-wrap items-center gap-4 text-sm text-slate-600">
            {course.duration != null && <span className="flex items-center gap-1"><Clock className="h-4 w-4" />{course.duration} mins</span>}
            {typeof certifiedCount === "number" && certifiedCount > 0 && <span className="flex items-center gap-1"><Users className="h-4 w-4" />{certifiedCount.toLocaleString()} certified</span>}
            {course.level && <span className="flex items-center gap-1"><Award className="h-4 w-4" />{course.level}</span>}
          </div>

          <div className={`mt-4 rounded-2xl p-3 ${isPractice ? "border border-dashed border-slate-300 bg-slate-50" : isAssessment ? "border border-slate-200 bg-slate-50" : "bg-slate-50"}`}>
            {isAssessment ? (
              <>
                <p className={`font-black ${isPractice ? "text-slate-900" : "text-slate-800"}`}>{pricing.primaryLabel}</p>
                <p className="mt-1 text-xs leading-5 text-slate-600">{pricing.supportingLabel}</p>
                {!isPractice && <p className="mt-2 text-xs font-bold text-slate-800">Account required to start · no charge for the attempt</p>}
                {!isPractice && pricing.credentialPrice && <div className="mt-2 flex items-baseline gap-2"><span className="text-xs font-bold text-slate-500">Verified credential</span><span className="text-xl font-black">{pricing.credentialPrice}</span>{pricing.originalCredentialPrice && <span className="text-sm text-slate-500 line-through">{pricing.originalCredentialPrice}</span>}</div>}
              </>
            ) : (
              <><p className="text-2xl font-black">{Number(course.contentPrice || 0) === 0 ? "Free" : `₹${course.contentPrice}`}</p><p className="text-xs font-medium text-slate-500">Course access</p></>
            )}
          </div>

          <Button asChild className={`mt-4 w-full ${isPractice ? "bg-slate-700 hover:bg-slate-800" : "bg-slate-950 hover:bg-slate-800"}`}>
            <Link href={href}>{isAssessment ? (isPractice ? "View practice exam" : "View free exam · account required") : "View course"}<ChevronRight className="ml-2 h-4 w-4 transition-transform group-hover:translate-x-1" /></Link>
          </Button>
        </CardContent>
      </div>
    </Card>
  );
}
