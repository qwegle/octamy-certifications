import { useEffect, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Link } from "wouter";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import {
  Search,
  Award,
  Users,
  TrendingUp,
  ChevronRight,
  Star,
  CheckCircle,
  ArrowRight,
  Monitor,
  Video,
  Brain,
  Handshake,
  Play,
  ChevronLeft,
} from "lucide-react";
import CourseCard from "@/components/course-card";
import { useAuth } from "@/hooks/useAuth";
import type { Category, Course } from "@shared/schema";
import bg2 from "@/assets/octamy-bg-2.png";
import bg1 from "@/assets/octamy-bg-3.png";
import bg3 from "@/assets/octamy-bg-4.png";
import bg4 from "@/assets/octamy-bg-5.png";
import premCQLogoLight from "@/assets/image_1750054465427.png";
import premCQLogoDark from "@/assets/image_1750054456482.png";
// Certificate Slider Component with infinite auto-scroll
function CertificateSlider() {
  const { data: certificates = [] } = useQuery<any[]>({
    queryKey: ["/api/recent-certificates"],
  });

  // Duplicate certificates for seamless infinite scroll
  const duplicatedCertificates =
    certificates.length > 0 ? [...certificates, ...certificates] : [];
  console.log(duplicatedCertificates);
  return (
    <div className="bg-gray-50 py-8">
      <div className="max-w-7xl mx-auto px-6">
        <div className="text-center mb-8">
          <h3 className="text-2xl font-bold text-black">Recent Top Scorers</h3>
          <p className="text-gray-600 mt-2">
            Join thousands who have excelled in their practice exams
          </p>
        </div>

        {certificates.length > 0 ? (
          <div className="relative overflow-hidden">
            <div className="flex space-x-6 animate-scroll-left">
              {duplicatedCertificates.map((cert, index) => (
                <div
                  key={`${cert.name}-${cert.course}-${index}`}
                  className="flex-shrink-0 bg-white border-2 border-gray-200 rounded-lg p-6 min-w-[300px] hover:border-black transition-colors"
                >
                  <div className="flex items-center space-x-3 mb-3">
                    <div className="w-12 h-12 bg-black rounded-full flex items-center justify-center">
                      <Award className="w-6 h-6 text-white" />
                    </div>
                    <div>
                      <h4 className="font-semibold text-black">{cert.name}</h4>
                      <p className="text-sm text-gray-600">{cert.company}</p>
                    </div>
                  </div>
                  <p className="text-sm text-gray-700 mb-2">
                    Practiced{" "}
                    <span className="font-semibold text-black">{cert.course}</span>
                  </p>
                  <div className="flex items-center justify-between">
                    <Badge
                      variant="outline"
                      className="border-black text-black"
                    >
                      {cert.badge} Badge
                    </Badge>
                    <span className="text-xs text-gray-600">Score: ••%</span>
                  </div>
                </div>
              ))}
            </div>
          </div>
        ) : (
          // Loading placeholder
          <div className="flex overflow-x-auto space-x-6 pb-4">
            {Array.from({ length: 3 }).map((_, index) => (
              <div
                key={index}
                className="flex-shrink-0 bg-white border-2 border-gray-200 rounded-lg p-6 min-w-[300px] animate-pulse"
              >
                <div className="flex items-center space-x-3 mb-3">
                  <div className="w-12 h-12 bg-gray-300 rounded-full"></div>
                  <div>
                    <div className="h-4 bg-gray-300 rounded w-24 mb-2"></div>
                    <div className="h-3 bg-gray-300 rounded w-16"></div>
                  </div>
                </div>
                <div className="h-3 bg-gray-300 rounded w-32 mb-2"></div>
                <div className="h-6 bg-gray-300 rounded w-20"></div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

const BannerSlider = () => {
  const [currentSlide, setCurrentSlide] = useState(0);
  const [isAutoPlaying, setIsAutoPlaying] = useState(true);

  // Sample banner data (you can replace with your own images)
  const banners = [
    {
      id: 1,
      image:  bg1 ,
      title: "Practice for Your Entrance Exams",
      subtitle:
        "Real MCQ tests to prepare for technology certifications and competitive exams",
      description: "Build full-stack applications with modern technologies",
      buttonText: "Start Practicing Now",
      gradient: "from-blue-600 to-purple-600",
    },
    {
      id: 2,
      image: bg2,
      title: "Master Data Science & AI",
      subtitle: "Practice MCQs in Python, Machine Learning & AI",
      description: "Transform your career with data science skills",
      buttonText: "Begin Practice Tests",
      gradient: "from-green-600 to-teal-600",
    },
    {
      id: 3,
      image:bg3,
      title: "Digital Marketing Prep",
      subtitle: "Practice SEO, Social Media & Analytics MCQs",
      description: "Grow your business with proven marketing strategies",
      buttonText: "Practice Now",
      gradient: "from-orange-600 to-red-600",
    },
    {
      id: 4,
      image: bg4,
      title: "UI/UX Design Practice",
      subtitle: "Prepare with Figma, Adobe XD & Prototyping MCQs",
      description: "Create stunning user experiences and interfaces",
      buttonText: "Start Practice Tests",
      gradient: "from-pink-600 to-purple-600",
    },
  ];

  // Auto-play functionality
  // useEffect(() => {
  //   if (!isAutoPlaying) return;

  //   const interval = setInterval(() => {
  //     setCurrentSlide((prev) => (prev + 1) % banners.length);
  //   }, 5000);

  //   return () => clearInterval(interval);
  // }, [isAutoPlaying, banners.length]);

  const nextSlide = () => {
    setCurrentSlide((prev) => (prev + 1) % banners.length);
  };

  const prevSlide = () => {
    setCurrentSlide((prev) => (prev - 1 + banners.length) % banners.length);
  };

  const goToSlide = (index: any) => {
    setCurrentSlide(index);
  };

  const handleMouseEnter = () => {
    setIsAutoPlaying(false);
  };

  const handleMouseLeave = () => {
    setIsAutoPlaying(true);
  };

  return (
    <div className="relative w-full p-4 mx-auto">
      {/* Main Slider Container */}
      <div
        className="relative overflow-hidden rounded-lg shadow-2xl bg-gray-900"
        onMouseEnter={handleMouseEnter}
        onMouseLeave={handleMouseLeave}
      >
        {/* Slides */}
        <div
          className="flex transition-transform duration-500 ease-in-out"
          style={{ transform: `translateX(-${currentSlide * 100}%)` }}
        >
          {banners.map((banner) => (
            <div key={banner.id} className="min-w-full relative">
              {/* Background Image */}
              <div className="relative h-96 ">
                <img
                  src={banner.image}
                  alt={banner.title}
                  className="w-full h-full object-cover"
                />
                {/* Gradient Overlay */}
                <div
                  className={`absolute inset-0 bg-gradient-to-r opacity-80`}
                ></div>

                {/* Content */}
                <div className="absolute inset-0 flex items-center">
                  <div className=" ml-20 bg-white rounded-md max-w-md px-6">
                    <div className="max-w-md text-black py-4">
                      {/* Badge */}
                      {/* <div className="inline-flex items-center px-3 py-1 rounded-full bg-white/20 backdrop-blur-sm text-sm font-medium mb-4">
                          <Play className="w-4 h-4 mr-2" />
                          Featured Course
                        </div> */}

                      {/* Title */}
                      <h1 className="text-3xl font-bold mb-2 leading-tight">
                        {banner.title}
                      </h1>

                      {/* Subtitle */}
                      <h2 className="text-lg  mb-2 ">{banner.subtitle}</h2>

                      {/* Description */}
                      {/* <p className="text-lg mb-6 text-gray-300 leading-relaxed">
                          {banner.description}
                        </p> */}

                      {/* Course Stats */}
                      {/* <div className="flex items-center gap-6 mb-8">
                          <div className="flex items-center">
                            <Star className="w-5 h-5 text-yellow-400 fill-current" />
                            <span className="ml-1 font-semibold">
                              {banner.rating}
                            </span>
                          </div>
                          <div className="text-gray-300">
                            {banner.students} students
                          </div>
                          <div className="text-gray-300">
                            By {banner.instructor}
                          </div>
                        </div> */}

                      {/* CTA Button */}
                      <button className="bg-black text-white px-8 py-2 rounded-lg font-semibold text-md hover:bg-gray-900 transform transition duration-300 hover:scale-105 shadow-lg">
                        {banner.buttonText}
                      </button>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          ))}
        </div>

        {/* Navigation Arrows */}
        <button
          onClick={prevSlide}
          className="absolute left-4 top-1/2 -translate-y-1/2 bg-white backdrop-blur-sm rounded-full p-3 transition-all"
        >
          <ChevronLeft className="w-6 h-6 text-black" />
        </button>

        <button
          onClick={nextSlide}
          className="absolute right-4 top-1/2 -translate-y-1/2 bg-white backdrop-blur-sm rounded-full p-3 transition-all"
        >
          <ChevronRight className="w-6 h-6 text-black" />
        </button>
      </div>

      {/* Dots Indicator */}
      {/* <div className="flex justify-center mt-6 space-x-2">
          {banners.map((_, index) => (
            <button
              key={index}
              onClick={() => goToSlide(index)}
              className={`w-3 h-3 rounded-full transition-all ${
                index === currentSlide
                  ? "bg-blue-600 w-8"
                  : "bg-gray-300 hover:bg-gray-400"
              }`}
            />
          ))}
        </div> */}

      {/* Progress Bar */}
      {/* <div className=" bg-gray-200 rounded-full h-1 overflow-hidden">
          <div
            className="h-full bg-blue-600 transition-all duration-500 ease-out"
            style={{ width: `${((currentSlide + 1) / banners.length) * 100}%` }}
          />
        </div> */}
    </div>
  );
};

export default function Landing() {
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedCategory, setSelectedCategory] = useState<number | null>(null);
  const { user, isAuthenticated, isLoading } = useAuth();

  const { data: categories = [] } = useQuery<Category[]>({
    queryKey: ["/api/categories"],
  });

  // Fetch limited courses for landing page (10 courses)
  const { data: coursesResponse } = useQuery<{ data: (Course & { category: Category })[]; total: number }>({
    queryKey: ["/api/courses", selectedCategory, searchQuery],
    queryFn: async () => {
      const queryParams = new URLSearchParams();
      queryParams.append('limit', '10');
      queryParams.append('offset', '0');
      if (selectedCategory) queryParams.append('categoryId', selectedCategory.toString());
      if (searchQuery) queryParams.append('search', searchQuery);
      
      const response = await fetch(`/api/courses?${queryParams}`);
      if (!response.ok) throw new Error('Failed to fetch courses');
      return response.json();
    }
  });

  // Use paginated response
  const courses = coursesResponse?.data || [];
  const totalCourses = coursesResponse?.total || 0;

  return (
    <div className="min-h-screen bg-white">
      {/* Navigation */}
      <nav className="bg-white border-b-2 border-gray-200 px-6 py-4">
        <div className="max-w-7xl mx-auto flex items-center justify-between">
          <div className="flex items-center space-x-8">
            <Link href="/" className="text-2xl font-bold">
              <img
                src={premCQLogoDark}
                alt="PremCQ"
                className="h-8"
              />
            </Link>
            <div className="hidden md:flex space-x-6">
              <Link href="/exams" className="text-black hover:text-gray-600">
                Practice Exams
              </Link>
              <Link href="/leaderboard" className="text-black hover:text-gray-600">
                Leaderboard
              </Link>
              <Link href="/virtual-internships" className="text-black hover:text-gray-600">
                Internships
              </Link>
              <Link href="/sponsor" className="text-black hover:text-gray-600">
                Sponsors
              </Link>
              <Link
                href="/business-certifications"
                className="text-black hover:text-gray-600"
              >
                Business
              </Link>
              <Link href="/help-center" className="text-black hover:text-gray-600">
                Help
              </Link>
            </div>
          </div>
          <div className="flex items-center space-x-4">
            {!isLoading && !isAuthenticated ? (
              <>
                <Link href="/auth">
                  <Button
                    variant="outline"
                    className="border-black text-black hover:bg-black hover:text-white"
                  >
                    Login
                  </Button>
                </Link>
                <Link href="/seller-auth">
                  <Button className="bg-black text-white hover:bg-gray-800">
                    Become a Reseller
                  </Button>
                </Link>
              </>
            ) : (
              <>
                <Link href="/dashboard">
                  <Button
                    variant="outline"
                    className="border-black text-black hover:bg-black hover:text-white"
                  >
                    Dashboard
                  </Button>
                </Link>
                <Link href="/logout">
                  <Button className="bg-black text-white hover:bg-gray-800">
                    Logout
                  </Button>
                </Link>
              </>
            )}
          </div>
        </div>
      </nav>

      <BannerSlider />

      {/* Certificate Slider */}
      <CertificateSlider />
      {/* Hero Section */}
      <section className="py-20 bg-gradient-to-br from-gray-50 via-white to-gray-50">
        <div className="max-w-7xl mx-auto px-6">
          <div className="grid lg:grid-cols-2 gap-12 items-center">
            <div className="text-left">
              <h1 className="text-4xl sm:text-5xl lg:text-6xl font-bold text-black mb-6 leading-tight">
                <span className="block">PRE MCQ:</span>
                <span className="block mt-2 mb-2">
                  Practice Before
                </span>
                <span className="block">Your Entrance Exams</span>
              </h1>
              <p className="text-lg text-gray-600 mb-8 max-w-xl">
                Master entrance exams through comprehensive MCQ practice. Prepare for Technology, Public Sector, and Professional exams - and earn real certifications as you excel.
              </p>
              <div className="flex flex-col sm:flex-row gap-4 mb-8">
                <Link href="/tech-exams">
                  <Button
                    size="lg"
                    className="bg-black text-white hover:bg-gray-800 px-8 py-4 text-lg w-full sm:w-auto"
                  >
                    Practice Tech Exams <ArrowRight className="ml-2 w-5 h-5" />
                  </Button>
                </Link>
                <Link href="/public-sector-exams">
                  <Button
                    variant="outline"
                    size="lg"
                    className="border-black text-black hover:bg-black hover:text-white px-8 py-4 text-lg w-full sm:w-auto"
                  >
                    Practice Public Sector
                  </Button>
                </Link>
              </div>
              <div className="flex items-center gap-6 text-sm text-gray-600">
                <div className="flex items-center gap-2">
                  <CheckCircle className="w-5 h-5 text-green-600" />
                  <span>Real Practice Tests</span>
                </div>
                <div className="flex items-center gap-2">
                  <CheckCircle className="w-5 h-5 text-green-600" />
                  <span>Earn Certificates</span>
                </div>
                <div className="flex items-center gap-2">
                  <CheckCircle className="w-5 h-5 text-green-600" />
                  <span>Verified Results</span>
                </div>
              </div>
            </div>
            <div className="hidden lg:block">
              <div className="grid grid-cols-2 gap-4">
                <Card className="border-2 border-black hover:shadow-lg transition-shadow">
                  <CardHeader className="pb-3">
                    <div className="w-12 h-12 bg-black rounded-lg flex items-center justify-center mb-2">
                      <Monitor className="w-6 h-6 text-white" />
                    </div>
                    <CardTitle className="text-lg">Technology</CardTitle>
                  </CardHeader>
                  <CardContent>
                    <p className="text-sm text-gray-600">Web Dev, AI/ML, Data Science & More</p>
                  </CardContent>
                </Card>
                <Card className="border-2 border-black hover:shadow-lg transition-shadow mt-8">
                  <CardHeader className="pb-3">
                    <div className="w-12 h-12 bg-black rounded-lg flex items-center justify-center mb-2">
                      <Award className="w-6 h-6 text-white" />
                    </div>
                    <CardTitle className="text-lg">Public Sector</CardTitle>
                  </CardHeader>
                  <CardContent>
                    <p className="text-sm text-gray-600">UPSC, SSC, Railway, Banking</p>
                  </CardContent>
                </Card>
                <Card className="border-2 border-black hover:shadow-lg transition-shadow">
                  <CardHeader className="pb-3">
                    <div className="w-12 h-12 bg-black rounded-lg flex items-center justify-center mb-2">
                      <Brain className="w-6 h-6 text-white" />
                    </div>
                    <CardTitle className="text-lg">AI Powered</CardTitle>
                  </CardHeader>
                  <CardContent>
                    <p className="text-sm text-gray-600">Intelligent Question Selection</p>
                  </CardContent>
                </Card>
                <Card className="border-2 border-black hover:shadow-lg transition-shadow mt-8">
                  <CardHeader className="pb-3">
                    <div className="w-12 h-12 bg-black rounded-lg flex items-center justify-center mb-2">
                      <Users className="w-6 h-6 text-white" />
                    </div>
                    <CardTitle className="text-lg">50K+ Users</CardTitle>
                  </CardHeader>
                  <CardContent>
                    <p className="text-sm text-gray-600">Join Our Learning Community</p>
                  </CardContent>
                </Card>
              </div>
            </div>
          </div>
        </div>
      </section>
      {/* Stats Section */}
      <section className="py-16 bg-gray-50 pt-[25px] pb-[25px]">
        <div className="max-w-7xl mx-auto px-6">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-8 text-center">
            <div>
              <div className="bg-black text-white w-16 h-16 rounded-full flex items-center justify-center mx-auto mb-4">
                <Users className="w-8 h-8" />
              </div>
              <h3 className="text-3xl font-bold text-black mb-2">50K+</h3>
              <p className="text-gray-600">Certified Professionals</p>
            </div>
            <div>
              <div className="bg-black text-white w-16 h-16 rounded-full flex items-center justify-center mx-auto mb-4">
                <Award className="w-8 h-8" />
              </div>
              <h3 className="text-3xl font-bold text-black mb-2">200+</h3>
              <p className="text-gray-600">Professional Courses</p>
            </div>
            <div>
              <div className="bg-black text-white w-16 h-16 rounded-full flex items-center justify-center mx-auto mb-4">
                <TrendingUp className="w-8 h-8" />
              </div>
              <h3 className="text-3xl font-bold text-black mb-2">98%</h3>
              <p className="text-gray-600">Success Rate</p>
            </div>
          </div>
        </div>
      </section>
      {/* Course Discovery Section */}
      <section className="py-16 bg-white pt-[25px] pb-[25px]">
        <div className="max-w-7xl mx-auto px-6">
          <div className="text-center mb-12">
            <h2 className="text-4xl font-bold text-black mb-6">
              Choose Your Certification
            </h2>
            <div className="max-w-md mx-auto">
              <div className="relative">
                <Search className="absolute left-3 top-3 h-5 w-5 text-gray-400" />
                <Input
                  type="text"
                  placeholder="Search exams..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="pl-10 pr-4 py-3 border-2 border-black focus:border-black"
                />
              </div>
            </div>
          </div>

          {/* Categories */}
          <div className="flex flex-wrap justify-center gap-4 mb-12">
            <Button
              variant={selectedCategory === null ? "default" : "outline"}
              onClick={() => setSelectedCategory(null)}
              className={
                selectedCategory === null
                  ? "bg-black text-white"
                  : "border-black text-black hover:bg-black hover:text-white"
              }
            >
              All Categories
            </Button>
            {categories.map((category) => (
              <Button
                key={category.id}
                variant={
                  selectedCategory === category.id ? "default" : "outline"
                }
                onClick={() => setSelectedCategory(category.id)}
                className={
                  selectedCategory === category.id
                    ? "bg-black text-white"
                    : "border-black text-black hover:bg-black hover:text-white"
                }
              >
                {category.name}
              </Button>
            ))}
          </div>

          {/* Courses Grid */}
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8 mb-8">
            {courses.map((course) => (
              <CourseCard key={course.id} course={course} />
            ))}
          </div>

          {courses.length === 0 && (
            <div className="text-center py-12">
              <p className="text-gray-600 text-lg">
                No courses found matching your criteria.
              </p>
            </div>
          )}

          {courses.length > 0 && (
            <div className="text-center mt-8">
              <Link href="/exams">
                <Button
                  size="lg"
                  variant="outline"
                  className="border-2 border-black text-black hover:bg-black hover:text-white px-8 py-4 text-lg"
                  data-testid="button-show-all-courses"
                >
                  Show All {totalCourses} Courses <ArrowRight className="ml-2 w-5 h-5" />
                </Button>
              </Link>
            </div>
          )}
        </div>
      </section>

      {/* AI-Powered Technical Assessment Section */}
      <section className="py-16 bg-white">
        <div className="max-w-7xl mx-auto px-6 text-center">
          <h2 className="text-4xl font-bold text-black mb-6">
            AI-Powered Technical Interview
          </h2>
          <p className="text-xl text-gray-600 mb-12 max-w-3xl mx-auto">
            Professional technical interviews with AI evaluation - 44+
            technologies, instant scoring, recruiter-ready certificates
          </p>

          {/* How It Works - 4 Steps */}
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-8 mb-16">
            <div className="text-center">
              <div className="w-20 h-20 bg-black rounded-full flex items-center justify-center mx-auto mb-4">
                <Monitor className="w-10 h-10 text-white" />
              </div>
              <h3 className="text-xl font-bold text-black mb-3">
                Choose Your Technology
              </h3>
              <p className="text-gray-600 text-sm">
                Select from 44+ professional technologies: React, Python, Data
                Science, Machine Learning, Java, JavaScript, and more
              </p>
            </div>
            <div className="text-center">
              <div className="w-20 h-20 bg-black rounded-full flex items-center justify-center mx-auto mb-4">
                <Video className="w-10 h-10 text-white" />
              </div>
              <h3 className="text-xl font-bold text-black mb-3">
                Professional Interview Session
              </h3>
              <p className="text-gray-600 text-sm">
                Complete comprehensive video-recorded technical interviews with
                live coding, system design, and behavioral assessment
              </p>
            </div>
            <div className="text-center">
              <div className="w-20 h-20 bg-black rounded-full flex items-center justify-center mx-auto mb-4">
                <Brain className="w-10 h-10 text-white" />
              </div>
              <h3 className="text-xl font-bold text-black mb-3">
                AI-Powered Performance Analysis
              </h3>
              <p className="text-gray-600 text-sm">
                Receive instant AI scoring, detailed technical feedback,
                competency analysis, and professional performance report
              </p>
            </div>
            <div className="text-center">
              <div className="w-20 h-20 bg-black rounded-full flex items-center justify-center mx-auto mb-4">
                <Handshake className="w-10 h-10 text-white" />
              </div>
              <h3 className="text-xl font-bold text-black mb-3">
                Get Hired by Top Recruiters
              </h3>
              <p className="text-gray-600 text-sm">
                Share verified assessment certificates with employers and
                demonstrate your technical competency to hiring managers
              </p>
            </div>
          </div>

          {/* Key Benefits - 3 Cards */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-8 mb-12">
            <Card className="border-2 border-gray-200 hover:border-black transition-colors">
              <CardHeader>
                <CardTitle className="text-black">
                  Industry-Standard Assessment Experience
                </CardTitle>
                <CardDescription className="text-gray-600">
                  Professional video evaluation with integrity monitoring for
                  authentic technical assessment
                </CardDescription>
              </CardHeader>
              <CardContent>
                <CheckCircle className="w-12 h-12 text-green-500 mb-4" />
                <p className="text-sm text-gray-600">
                  Real-time monitoring and professional evaluation standards
                </p>
              </CardContent>
            </Card>
            <Card className="border-2 border-gray-200 hover:border-black transition-colors">
              <CardHeader>
                <CardTitle className="text-black">
                  Advanced AI Evaluation Engine
                </CardTitle>
                <CardDescription className="text-gray-600">
                  Machine learning algorithms analyze coding proficiency,
                  problem-solving methodology, and communication skills
                </CardDescription>
              </CardHeader>
              <CardContent>
                <Brain className="w-12 h-12 text-blue-500 mb-4" />
                <p className="text-sm text-gray-600">
                  Comprehensive AI analysis with detailed performance insights
                </p>
              </CardContent>
            </Card>
            <Card className="border-2 border-gray-200 hover:border-black transition-colors">
              <CardHeader>
                <CardTitle className="text-black">
                  Recruiter-Ready Certification
                </CardTitle>
                <CardDescription className="text-gray-600">
                  Industry-recognized professional certificates at ₹99 per
                  session - trusted by hiring managers and tech recruiters
                </CardDescription>
              </CardHeader>
              <CardContent>
                <Award className="w-12 h-12 text-purple-500 mb-4" />
                <p className="text-sm text-gray-600">
                  Professional validation that employers trust and value
                </p>
              </CardContent>
            </Card>
          </div>

          {/* Call to Action */}
          <div className="text-center">
            {!isLoading && !isAuthenticated ? (
              <Link href="/auth">
                <Button
                  size="lg"
                  className="bg-black text-white hover:bg-gray-800 px-8 py-4 text-lg"
                  aria-label="Begin AI-powered technical interview assessment"
                >
                  Start Professional Interview{" "}
                  <ArrowRight className="ml-2 w-5 h-5" />
                </Button>
              </Link>
            ) : (
              <Link href="/ai-interviews">
                <Button
                  size="lg"
                  className="bg-black text-white hover:bg-gray-800 px-8 py-4 text-lg"
                  aria-label="Begin AI-powered technical interview assessment"
                >
                  Start Professional Interview{" "}
                  <ArrowRight className="ml-2 w-5 h-5" />
                </Button>
              </Link>
            )}
          </div>
        </div>
      </section>

      {/* Business Certification Section */}
      <section className="py-16 bg-black text-white">
        <div className="max-w-7xl mx-auto px-6 text-center">
          <h2 className="text-4xl font-bold mb-6">Business Certifications</h2>
          <p className="text-xl text-gray-300 mb-8 max-w-2xl mx-auto">
            Get your entire team certified. Business certificates include
            company branding and bulk pricing.
          </p>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 mb-8">
            <Card className="bg-gray-900 border-gray-700 text-white">
              <CardHeader>
                <CardTitle className="text-white">
                  Team Certifications
                </CardTitle>
                <CardDescription className="text-gray-300">
                  Certify your entire team under your company name
                </CardDescription>
              </CardHeader>
              <CardContent>
                <CheckCircle className="w-12 h-12 text-green-400 mb-4" />
                <p className="text-sm">
                  Company-branded certificates with business validation
                </p>
              </CardContent>
            </Card>
            <Card className="bg-gray-900 border-gray-700 text-white">
              <CardHeader>
                <CardTitle className="text-white">Bulk Pricing</CardTitle>
                <CardDescription className="text-gray-300">
                  Special rates for organizations
                </CardDescription>
              </CardHeader>
              <CardContent>
                <TrendingUp className="w-12 h-12 text-blue-400 mb-4" />
                <p className="text-sm">
                  Volume discounts for teams of 10+ employees
                </p>
              </CardContent>
            </Card>
            <Card className="bg-gray-900 border-gray-700 text-white">
              <CardHeader>
                <CardTitle className="text-white">
                  Analytics Dashboard
                </CardTitle>
                <CardDescription className="text-gray-300">
                  Track team progress and performance
                </CardDescription>
              </CardHeader>
              <CardContent>
                <Users className="w-12 h-12 text-purple-400 mb-4" />
                <p className="text-sm">
                  Real-time insights into team certification progress
                </p>
              </CardContent>
            </Card>
          </div>
          <Link href="/sponsor">
            <Button size="lg" className="bg-white text-black hover:bg-gray-200">
              Support Our Project
            </Button>
          </Link>
        </div>
      </section>
      {/* Badge System Section */}
      <section className="py-16 bg-gray-50">
        <div className="max-w-7xl mx-auto px-6 text-center">
          <h2 className="text-4xl font-bold text-black mb-6">
            Performance-Based Badges
          </h2>
          <p className="text-xl text-gray-600 mb-12 max-w-2xl mx-auto">
            Earn badges based on your exam performance. Show your expertise
            level to employers.
          </p>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-6">
            <div className="text-center">
              <div className="w-20 h-20 bg-orange-100 rounded-full flex items-center justify-center mx-auto mb-4">
                <span className="text-3xl">🥉</span>
              </div>
              <h3 className="font-bold text-lg mb-2">Bronze</h3>
              <p className="text-sm text-gray-600">50-70% Score</p>
            </div>
            <div className="text-center">
              <div className="w-20 h-20 bg-gray-100 rounded-full flex items-center justify-center mx-auto mb-4">
                <span className="text-3xl">🥈</span>
              </div>
              <h3 className="font-bold text-lg mb-2">Silver</h3>
              <p className="text-sm text-gray-600">70-80% Score</p>
            </div>
            <div className="text-center">
              <div className="w-20 h-20 bg-yellow-100 rounded-full flex items-center justify-center mx-auto mb-4">
                <span className="text-3xl">🥇</span>
              </div>
              <h3 className="font-bold text-lg mb-2">Gold</h3>
              <p className="text-sm text-gray-600">80-90% Score</p>
            </div>
            <div className="text-center">
              <div className="w-20 h-20 bg-blue-100 rounded-full flex items-center justify-center mx-auto mb-4">
                <span className="text-3xl">💎</span>
              </div>
              <h3 className="font-bold text-lg mb-2">Platinum</h3>
              <p className="text-sm text-gray-600">90-100% Score</p>
            </div>
          </div>
        </div>
      </section>
      {/* Footer */}
      <footer className="bg-black text-white py-12">
        <div className="max-w-7xl mx-auto px-6">
          <div className="grid grid-cols-1 md:grid-cols-4 gap-8">
            <div>
              <h3 className="text-2xl font-bold mb-4">PREMCQ</h3>
              <p className="text-gray-400">
                Professional certification platform for the modern workforce.
              </p>
            </div>
            <div>
              <h4 className="font-semibold mb-4">Exams</h4>
              <ul className="space-y-2 text-gray-400">
                <li>
                  <Link href="/" className="hover:text-white">
                    AI & Machine Learning
                  </Link>
                </li>
                <li>
                  <Link href="/" className="hover:text-white">
                    Development
                  </Link>
                </li>
                <li>
                  <Link href="/" className="hover:text-white">
                    Business
                  </Link>
                </li>
                <li>
                  <Link href="/" className="hover:text-white">
                    Data Science
                  </Link>
                </li>
              </ul>
            </div>
            <div>
              <h4 className="font-semibold mb-4">Company</h4>
              <ul className="space-y-2 text-gray-400">
                <li>
                  <Link href="/help-center" className="hover:text-white">
                    Help Center
                  </Link>
                </li>
                <li>
                  <Link href="/partners" className="hover:text-white">
                    Partners
                  </Link>
                </li>
                <li>
                  <Link href="/privacy-policy" className="hover:text-white">
                    Privacy Policy
                  </Link>
                </li>
                <li>
                  <Link href="/terms-of-service" className="hover:text-white">
                    Terms of Service
                  </Link>
                </li>
              </ul>
            </div>
            <div>
              <h4 className="font-semibold mb-4">Connect</h4>
              <p className="text-gray-400 mb-4">
                ISO Certified by PremCQ Solutions Private Limited
              </p>
              <div className="flex space-x-4">
                ⭐⭐⭐⭐⭐
                {/* <Star className="w-5 h-5 text-yellow-400" />
                <Star className="w-5 h-5 text-yellow-400" />
                <Star className="w-5 h-5 text-yellow-400" />
                <Star className="w-5 h-5 text-yellow-400" />
                <Star className="w-5 h-5 text-yellow-400" /> */}
              </div>
            </div>
          </div>
          <div className="border-t border-gray-800 mt-8 pt-8 text-center text-gray-400">
            <p>
              &copy; 2025 PremCQ Solutions Private Limited. All rights reserved.
            </p>
          </div>
        </div>
      </footer>
    </div>
  );
}
