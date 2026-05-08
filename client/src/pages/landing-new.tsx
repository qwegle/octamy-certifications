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
import Header from "@/components/header";
import Footer from "@/components/footer";
import type { Category, Course } from "@shared/schema";
import bg2 from "@/assets/octamy-bg-2.png";
import bg1 from "@/assets/octamy-bg-3.png";
import bg3 from "@/assets/octamy-bg-4.png";
import bg4 from "@/assets/octamy-bg-5.png";
import { SEO } from "@/components/seo";
// Certificate Slider Component with infinite auto-scroll
function CertificateSlider() {
  const { data: certificates = [] } = useQuery<any[]>({
    queryKey: ["/api/recent-certificates"],
  });

  // Duplicate certificates for seamless infinite scroll
  const duplicatedCertificates =
    certificates.length > 0 ? [...certificates, ...certificates] : [];
  return (
    <div className="bg-black text-white py-8">
      <div className="max-w-7xl mx-auto px-6">
        <div className="text-center mb-8">
          <h3 className="text-2xl font-bold">Recent Certifications</h3>
          <p className="text-gray-400 mt-2">
            Join thousands of professionals who have earned their certificates
          </p>
        </div>

        {certificates.length > 0 ? (
          <div className="relative overflow-hidden">
            <div className="flex space-x-6 animate-scroll-left">
              {duplicatedCertificates.map((cert, index) => (
                <div
                  key={`${cert.name}-${cert.course}-${index}`}
                  className="flex-shrink-0 bg-gray-900 rounded-lg p-6 min-w-[300px]"
                >
                  <div className="flex items-center space-x-3 mb-3">
                    <div className="w-12 h-12 bg-white rounded-full flex items-center justify-center">
                      <Award className="w-6 h-6 text-black" />
                    </div>
                    <div>
                      <h4 className="font-semibold">{cert.name}</h4>
                      <p className="text-sm text-gray-400">{cert.company}</p>
                    </div>
                  </div>
                  <p className="text-sm mb-2">
                    Certified in{" "}
                    <span className="font-semibold">{cert.course}</span>
                  </p>
                  <div className="flex items-center justify-between">
                    <Badge
                      variant="outline"
                      className="border-white text-white"
                    >
                      {cert.badge} Badge
                    </Badge>
                    <span className="text-xs text-gray-400">Score: ••%</span>
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
                className="flex-shrink-0 bg-gray-900 rounded-lg p-6 min-w-[300px] animate-pulse"
              >
                <div className="flex items-center space-x-3 mb-3">
                  <div className="w-12 h-12 bg-gray-700 rounded-full"></div>
                  <div>
                    <div className="h-4 bg-gray-700 rounded w-24 mb-2"></div>
                    <div className="h-3 bg-gray-700 rounded w-16"></div>
                  </div>
                </div>
                <div className="h-3 bg-gray-700 rounded w-32 mb-2"></div>
                <div className="h-6 bg-gray-700 rounded w-20"></div>
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
      title: "Meet your new AI conversation coach",
      subtitle:
        "Role Play is the interactive way to practice your business and communication skills.",
      description: "Build full-stack applications with modern technologies",
      buttonText: "Get Certificate Now !",
      gradient: "from-blue-600 to-purple-600",
    },
    {
      id: 2,
      image: bg2,
      title: "Data Science Bootcamp",
      subtitle: "Python, Machine Learning & AI",
      description: "Transform your career with data science skills",
      buttonText: "Get Certificate Now !",
      gradient: "from-green-600 to-teal-600",
    },
    {
      id: 3,
      image:bg3,
      title: "Digital Marketing Mastery",
      subtitle: "SEO, Social Media & Analytics",
      description: "Grow your business with proven marketing strategies",
      buttonText: "Get Certificate Now !",
      gradient: "from-orange-600 to-red-600",
    },
    {
      id: 4,
      image: bg4,
      title: "UI/UX Design Complete",
      subtitle: "Figma, Adobe XD & Prototyping",
      description: "Create stunning user experiences and interfaces",
      buttonText: "Get Certificate Now !",
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
                  className={`absolute inset-0 bg-gradient-to-r ${banner.gradient} opacity-60`}
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

  const { data: courses = [] } = useQuery<(Course & { category: Category })[]>({
    queryKey: ["/api/courses"],
  });

  const filteredCourses = courses.filter((course) => {
    const matchesSearch =
      !searchQuery ||
      course.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
      course.description.toLowerCase().includes(searchQuery.toLowerCase());
    const matchesCategory =
      !selectedCategory || course.categoryId === selectedCategory;
    return matchesSearch && matchesCategory;
  });

  return (
    <div className="min-h-screen bg-white">
      <SEO
        title="Octamy — Skill Verification & Certification Platform"
        description="Take free skill-verification assessments in AI, Development, Cloud, Cybersecurity and more. Pay only for verified certificates. Industry-recognized credentials trusted by recruiters across India."
        path="/"
        jsonLd={{
          "@context": "https://schema.org",
          "@type": "WebSite",
          name: "Octamy",
          url: "https://octamy.com/",
          potentialAction: {
            "@type": "SearchAction",
            target: "https://octamy.com/exams?q={search_term_string}",
            "query-input": "required name=search_term_string",
          },
        }}
      />
      {/* Navigation */}
      <Header />

      <BannerSlider />

      {/* Certificate Slider */}
      <CertificateSlider />
      {/* Hero Section */}
      <section className="py-20 bg-white">
        <div className="max-w-7xl mx-auto px-6 text-center">
          <h1 className="text-3xl sm:text-5xl md:text-6xl font-bold text-black mb-6">
            PROFESSIONAL
            <br />
            <span className="bg-black text-white px-4 py-2 inline-block mt-2">
              CERTIFICATION
            </span>
          </h1>
          <p className="text-xl text-gray-600 mb-8 max-w-2xl mx-auto">
            Earn verified certificates from industry experts. Build your
            credibility with performance-based badges and join our global
            leaderboard.
          </p>
          <div className="flex md:flex-row flex-col space-y-4 justify-center md:space-x-4 md:space-y-0">
            <Link href={isAuthenticated ? "/exams" : "/auth"}>
              <Button
                size="lg"
                className="bg-black text-white hover:bg-gray-800 px-8 py-4 text-lg"
              >
                Get Started <ArrowRight className="ml-2 w-5 h-5" />
              </Button>
            </Link>
            <Link href="/partners">
              <Button
                variant="outline"
                size="lg"
                className="border-black text-black hover:bg-black hover:text-white px-8 py-4 text-lg"
              >
                Become a Partner
              </Button>
            </Link>
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
              <h3 className="text-3xl font-bold text-black mb-2">{(courses?.length ?? 0)}+</h3>
              <p className="text-gray-600">Skill assessments live</p>
            </div>
            <div>
              <div className="bg-black text-white w-16 h-16 rounded-full flex items-center justify-center mx-auto mb-4">
                <Award className="w-8 h-8" />
              </div>
              <h3 className="text-3xl font-bold text-black mb-2">{(categories?.length ?? 0)}</h3>
              <p className="text-gray-600">Career tracks</p>
            </div>
            <div>
              <div className="bg-black text-white w-16 h-16 rounded-full flex items-center justify-center mx-auto mb-4">
                <TrendingUp className="w-8 h-8" />
              </div>
              <h3 className="text-3xl font-bold text-black mb-2">100%</h3>
              <p className="text-gray-600">Verified credentials — pay only after passing</p>
            </div>
          </div>
        </div>
      </section>
      {/* Course Discovery Section */}
      <section className="py-16 bg-white pt-[25px] pb-[25px]">
        <div className="max-w-7xl mx-auto px-6">
          <div className="text-center mb-12">
            <h2 className="text-4xl font-bold text-black mb-6">
              Choose Your Assessment
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
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8">
            {filteredCourses.map((course) => (
              <CourseCard key={course.id} course={course} />
            ))}
          </div>

          {filteredCourses.length === 0 && (
            <div className="text-center py-12">
              <p className="text-gray-600 text-lg">
                No courses found matching your criteria.
              </p>
            </div>
          )}
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
      <Footer />
    </div>
  );
}
