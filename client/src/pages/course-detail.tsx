import { useParams } from "wouter";
import { useQuery } from "@tanstack/react-query";
import { Course, Category } from "@shared/schema";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Clock, Users, Award, Star, ChevronRight } from "lucide-react";
import { useAuth } from "@/lib/auth";
import { useLocation } from "wouter";
import { useEffect, useState } from "react";

export default function CourseDetail() {
  const { slug } = useParams();
  const [, setLocation] = useLocation();
  const { user } = useAuth();
  const [referralCode, setReferralCode] = useState<string | null>(null);

  // Extract referral code from URL parameters
  useEffect(() => {
    const urlParams = new URLSearchParams(window.location.search);
    const ref = urlParams.get('ref');
    if (ref) {
      setReferralCode(ref);
      // Store in localStorage for persistence across navigation
      localStorage.setItem('referralCode', ref);
    } else {
      // Check if we have a stored referral code
      const storedRef = localStorage.getItem('referralCode');
      if (storedRef) {
        setReferralCode(storedRef);
      }
    }
  }, []);

  const { data: course, isLoading } = useQuery<Course & { category: Category }>({
    queryKey: ['/api/courses/slug', slug],
    queryFn: async () => {
      const response = await fetch(`/api/courses/slug/${slug}`);
      if (!response.ok) {
        throw new Error('Course not found');
      }
      return response.json();
    },
    enabled: !!slug,
  });

  // Set page title and meta tags for SEO
  useEffect(() => {
    if (course) {
      document.title = course.metaTitle || `${course.title} - Professional Certification | Octamy`;
      
      // Update meta description
      const metaDescription = document.querySelector('meta[name="description"]');
      if (metaDescription) {
        metaDescription.setAttribute('content', course.metaDescription || course.description);
      } else {
        const meta = document.createElement('meta');
        meta.setAttribute('name', 'description');
        meta.setAttribute('content', course.metaDescription || course.description);
        document.head.appendChild(meta);
      }

      // Add Open Graph tags
      const updateOrCreateOGTag = (property: string, content: string) => {
        let ogTag = document.querySelector(`meta[property="${property}"]`);
        if (!ogTag) {
          ogTag = document.createElement('meta');
          ogTag.setAttribute('property', property);
          document.head.appendChild(ogTag);
        }
        ogTag.setAttribute('content', content);
      };

      updateOrCreateOGTag('og:title', course.title);
      updateOrCreateOGTag('og:description', course.metaDescription || course.description);
      updateOrCreateOGTag('og:type', 'website');
      updateOrCreateOGTag('og:url', window.location.href);
    }
  }, [course]);

  const handleStartExam = () => {
    if (!user) {
      setLocation("/auth");
      return;
    }
    setLocation(`/exam/${course?.id}`);
  };

  const handleGetCertified = () => {
    setLocation(`/exam/${course?.id}`);
  };

  if (isLoading) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-blue-50 to-indigo-100 dark:from-gray-900 dark:to-gray-800">
        <div className="container mx-auto px-4 py-8">
          <div className="animate-pulse">
            <div className="h-8 bg-gray-200 dark:bg-gray-700 rounded mb-4"></div>
            <div className="h-4 bg-gray-200 dark:bg-gray-700 rounded mb-2"></div>
            <div className="h-4 bg-gray-200 dark:bg-gray-700 rounded mb-8"></div>
            <div className="h-64 bg-gray-200 dark:bg-gray-700 rounded"></div>
          </div>
        </div>
      </div>
    );
  }

  if (!course) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-blue-50 to-indigo-100 dark:from-gray-900 dark:to-gray-800">
        <div className="container mx-auto px-4 py-8">
          <div className="text-center">
            <h1 className="text-4xl font-bold text-gray-900 dark:text-white mb-4">Course Not Found</h1>
            <p className="text-gray-600 dark:text-gray-300 mb-8">The course you're looking for doesn't exist.</p>
            <Button onClick={() => setLocation("/")}>
              Back to Home
            </Button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 to-indigo-100 dark:from-gray-900 dark:to-gray-800">
      {/* Header */}
      <header className="bg-white dark:bg-gray-900 shadow-sm border-b border-gray-200 dark:border-gray-700">
        <div className="container mx-auto px-4 py-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center space-x-4">
              <Button variant="ghost" onClick={() => setLocation("/")}>
                <span className="text-2xl font-bold text-blue-600 dark:text-blue-400">Octamy</span>
              </Button>
              <ChevronRight className="h-4 w-4 text-gray-400" />
              <Badge variant="secondary">{course.category.name}</Badge>
              <ChevronRight className="h-4 w-4 text-gray-400" />
              <span className="text-sm text-gray-600 dark:text-gray-400">{course.title}</span>
            </div>
            <div className="flex items-center space-x-4">
              {user ? (
                <Button onClick={() => setLocation("/dashboard")}>
                  Dashboard
                </Button>
              ) : (
                <Button onClick={() => setLocation("/auth")}>
                  Sign In
                </Button>
              )}
            </div>
          </div>
        </div>
      </header>

      {/* Main Content */}
      <main className="container mx-auto px-4 py-8">
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
          {/* Course Details */}
          <div className="lg:col-span-2">
            <Card className="mb-6">
              <CardHeader>
                <div className="flex items-center justify-between mb-4">
                  <Badge variant="outline" className="bg-blue-50 text-blue-700 dark:bg-blue-900 dark:text-blue-300">
                    {course.category.name}
                  </Badge>
                  {course.isInternship && (
                    <Badge variant="secondary" className="bg-green-50 text-green-700 dark:bg-green-900 dark:text-green-300">
                      Virtual Internship
                    </Badge>
                  )}
                </div>
                <CardTitle className="text-3xl font-bold text-gray-900 dark:text-white mb-2">
                  {course.title}
                </CardTitle>
                <CardDescription className="text-lg text-gray-600 dark:text-gray-300">
                  {course.description}
                </CardDescription>
              </CardHeader>
              <CardContent>
                <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
                  <div className="flex items-center space-x-2">
                    <Clock className="h-5 w-5 text-blue-600" />
                    <div>
                      <p className="text-sm text-gray-600 dark:text-gray-400">Duration</p>
                      <p className="font-semibold">{course.duration} min</p>
                    </div>
                  </div>
                  <div className="flex items-center space-x-2">
                    <Users className="h-5 w-5 text-green-600" />
                    <div>
                      <p className="text-sm text-gray-600 dark:text-gray-400">Certified</p>
                      <p className="font-semibold">1,200+</p>
                    </div>
                  </div>
                  <div className="flex items-center space-x-2">
                    <Award className="h-5 w-5 text-yellow-600" />
                    <div>
                      <p className="text-sm text-gray-600 dark:text-gray-400">Pass Score</p>
                      <p className="font-semibold">{course.passingScore}%</p>
                    </div>
                  </div>
                  <div className="flex items-center space-x-2">
                    <Star className="h-5 w-5 text-yellow-500" />
                    <div>
                      <p className="text-sm text-gray-600 dark:text-gray-400">Rating</p>
                      <p className="font-semibold">4.8/5</p>
                    </div>
                  </div>
                </div>

                <div className="bg-gray-50 dark:bg-gray-800 rounded-lg p-6 mb-6">
                  <h3 className="text-lg font-semibold mb-3">What You'll Learn</h3>
                  <ul className="space-y-2 text-gray-600 dark:text-gray-300">
                    <li className="flex items-start space-x-2">
                      <ChevronRight className="h-4 w-4 mt-0.5 text-blue-600" />
                      <span>Master the fundamentals of {course.title.toLowerCase()}</span>
                    </li>
                    <li className="flex items-start space-x-2">
                      <ChevronRight className="h-4 w-4 mt-0.5 text-blue-600" />
                      <span>Gain industry-recognized certification</span>
                    </li>
                    <li className="flex items-start space-x-2">
                      <ChevronRight className="h-4 w-4 mt-0.5 text-blue-600" />
                      <span>Enhance your professional profile</span>
                    </li>
                    <li className="flex items-start space-x-2">
                      <ChevronRight className="h-4 w-4 mt-0.5 text-blue-600" />
                      <span>Access to verified digital certificate</span>
                    </li>
                  </ul>
                </div>

                {course.isInternship && (
                  <div className="bg-green-50 dark:bg-green-900 border border-green-200 dark:border-green-700 rounded-lg p-6 mb-6">
                    <h3 className="text-lg font-semibold text-green-800 dark:text-green-200 mb-3">
                      Virtual Internship Program
                    </h3>
                    <p className="text-green-700 dark:text-green-300 mb-4">
                      This is a virtual internship program where you'll receive a professional internship certificate 
                      after completing the assessment. You can customize the duration and dates for your certificate.
                    </p>
                    <ul className="space-y-2 text-green-700 dark:text-green-300">
                      <li className="flex items-start space-x-2">
                        <ChevronRight className="h-4 w-4 mt-0.5" />
                        <span>Flexible duration (1-12 months)</span>
                      </li>
                      <li className="flex items-start space-x-2">
                        <ChevronRight className="h-4 w-4 mt-0.5" />
                        <span>Customizable start and end dates</span>
                      </li>
                      <li className="flex items-start space-x-2">
                        <ChevronRight className="h-4 w-4 mt-0.5" />
                        <span>Professional internship certificate</span>
                      </li>
                      <li className="flex items-start space-x-2">
                        <ChevronRight className="h-4 w-4 mt-0.5" />
                        <span>Verifiable credentials</span>
                      </li>
                    </ul>
                  </div>
                )}
              </CardContent>
            </Card>
          </div>

          {/* Sidebar */}
          <div className="lg:col-span-1">
            <Card className="sticky top-8">
              <CardHeader>
                <CardTitle className="text-center">
                  Get Certified Today
                </CardTitle>
                <div className="text-center">
                  <span className="text-3xl font-bold text-blue-600">₹{course.price}</span>
                  <p className="text-sm text-gray-600 dark:text-gray-400">One-time payment</p>
                </div>
              </CardHeader>
              <CardContent className="space-y-4">
                <Button 
                  onClick={handleGetCertified}
                  className="w-full bg-blue-600 hover:bg-blue-700 text-white"
                  size="lg"
                >
                  {course.isInternship ? "Start Internship Assessment" : "Start Assessment"}
                </Button>
                
                <div className="text-center">
                  <p className="text-sm text-gray-600 dark:text-gray-400">
                    30-day money-back guarantee
                  </p>
                </div>

                <div className="border-t pt-4">
                  <h4 className="font-semibold mb-2">This certification includes:</h4>
                  <ul className="space-y-2 text-sm text-gray-600 dark:text-gray-400">
                    <li className="flex items-center space-x-2">
                      <Award className="h-4 w-4 text-green-600" />
                      <span>Official certificate</span>
                    </li>
                    <li className="flex items-center space-x-2">
                      <Users className="h-4 w-4 text-green-600" />
                      <span>Industry recognition</span>
                    </li>
                    <li className="flex items-center space-x-2">
                      <Star className="h-4 w-4 text-green-600" />
                      <span>2-year validity</span>
                    </li>
                    <li className="flex items-center space-x-2">
                      <Clock className="h-4 w-4 text-green-600" />
                      <span>Instant results</span>
                    </li>
                  </ul>
                </div>
              </CardContent>
            </Card>
          </div>
        </div>
      </main>
    </div>
  );
}