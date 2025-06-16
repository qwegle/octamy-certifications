import { useQuery } from "@tanstack/react-query";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Link } from "wouter";
import { useState } from "react";
import { Brain, Code, TrendingUp, GraduationCap, Search, Clock, Users, Star } from "lucide-react";
import Header from "@/components/header";
import Footer from "@/components/footer";
import CourseCard from "@/components/course-card";
import type { Course, Category } from "@shared/schema";

const categoryIcons = {
  'AI': Brain,
  'Development': Code,
  'Business': TrendingUp,
  'Internships': GraduationCap,
};

export default function Landing() {
  const [searchQuery, setSearchQuery] = useState("");

  const { data: categories = [] } = useQuery<Category[]>({
    queryKey: ['/api/categories'],
  });

  const { data: courses = [] } = useQuery<(Course & { category: Category })[]>({
    queryKey: ['/api/courses'],
  });

  const filteredCourses = courses.filter(course =>
    course.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
    course.description.toLowerCase().includes(searchQuery.toLowerCase()) ||
    course.category.name.toLowerCase().includes(searchQuery.toLowerCase())
  );

  const popularCourses = filteredCourses.slice(0, 6);

  return (
    <div className="min-h-screen bg-white">
      <Header />
      
      {/* Hero Section */}
      <section className="bg-octamy-gray-50 py-20">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="text-center">
            <h1 className="text-5xl md:text-6xl font-bold text-octamy-black mb-6">
              Earn Professional
              <span className="text-octamy-gray-600"> Certifications</span>
            </h1>
            <p className="text-xl text-octamy-gray-600 mb-8 max-w-2xl mx-auto">
              Take quick assessments and get verified certificates in AI, Development, Business, and Internships. 
              Boost your career with industry-recognized credentials.
            </p>
            <div className="flex flex-col sm:flex-row gap-4 justify-center">
              <a href="#courses">
                <Button className="bg-octamy-black text-white px-8 py-4 text-lg font-semibold hover:bg-octamy-gray-800">
                  Start Learning
                </Button>
              </a>
              <Link href="/verify">
                <Button variant="outline" className="border-octamy-gray-300 text-octamy-black px-8 py-4 text-lg font-semibold hover:bg-octamy-gray-50">
                  View Certificates
                </Button>
              </Link>
            </div>
          </div>
        </div>
      </section>

      {/* Course Categories */}
      <section id="courses" className="py-20">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="text-center mb-16">
            <h2 className="text-4xl font-bold text-octamy-black mb-4">Choose Your Path</h2>
            <p className="text-xl text-octamy-gray-600 max-w-2xl mx-auto">
              Select from our carefully curated certification categories and take the first step towards professional growth.
            </p>
          </div>

          {/* Search and Filter */}
          <div className="mb-12">
            <div className="max-w-xl mx-auto relative">
              <Input
                type="text"
                placeholder="Search certifications..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="w-full pl-12 pr-4 py-4 text-lg focus:ring-2 focus:ring-octamy-black focus:border-transparent"
              />
              <Search className="absolute left-4 top-1/2 transform -translate-y-1/2 text-octamy-gray-400 w-5 h-5" />
            </div>
          </div>

          {/* Category Grid */}
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-8 mb-16">
            {categories.map((category) => {
              const IconComponent = categoryIcons[category.name as keyof typeof categoryIcons] || Brain;
              const categoryCoursesCount = courses.filter(c => c.categoryId === category.id).length;
              
              return (
                <Card key={category.id} className="bg-white rounded-xl shadow-lg border border-octamy-gray-200 p-8 hover:shadow-xl transition-all duration-300 hover:-translate-y-1">
                  <CardContent className="text-center p-0">
                    <div className="w-16 h-16 bg-octamy-gray-100 rounded-full flex items-center justify-center mx-auto mb-6">
                      <IconComponent className="w-8 h-8 text-octamy-black" />
                    </div>
                    <h3 className="text-2xl font-bold text-octamy-black mb-4">{category.name}</h3>
                    <p className="text-octamy-gray-600 mb-6">{category.description}</p>
                    <div className="text-sm text-octamy-gray-500 mb-6">
                      {categoryCoursesCount} Certifications Available
                    </div>
                    <Button className="w-full bg-octamy-black text-white hover:bg-octamy-gray-800">
                      Explore {category.name} Certs
                    </Button>
                  </CardContent>
                </Card>
              );
            })}
          </div>
        </div>
      </section>

      {/* Popular Certifications */}
      <section className="bg-octamy-gray-50 py-20">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="text-center mb-16">
            <h2 className="text-4xl font-bold text-octamy-black mb-4">Popular Certifications</h2>
            <p className="text-xl text-octamy-gray-600">Most in-demand certifications this month</p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8">
            {popularCourses.map((course, index) => (
              <CourseCard
                key={course.id}
                course={course}
                certifiedCount={Math.floor(Math.random() * 3000) + 1000}
                rating={4.7 + Math.random() * 0.3}
              />
            ))}
          </div>
        </div>
      </section>

      {/* How It Works */}
      <section className="py-20">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="text-center mb-16">
            <h2 className="text-4xl font-bold text-octamy-black mb-4">How It Works</h2>
            <p className="text-xl text-octamy-gray-600">Get certified in just 3 simple steps</p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-12">
            <div className="text-center">
              <div className="w-20 h-20 bg-octamy-black text-white rounded-full flex items-center justify-center mx-auto mb-6 text-2xl font-bold">
                1
              </div>
              <h3 className="text-2xl font-bold text-octamy-black mb-4">Choose & Take Exam</h3>
              <p className="text-octamy-gray-600">
                Select your certification and take a quick 10-15 question assessment. Timer-based MCQ format ensures fair evaluation.
              </p>
            </div>

            <div className="text-center">
              <div className="w-20 h-20 bg-octamy-black text-white rounded-full flex items-center justify-center mx-auto mb-6 text-2xl font-bold">
                2
              </div>
              <h3 className="text-2xl font-bold text-octamy-black mb-4">Pass & Pay</h3>
              <p className="text-octamy-gray-600">
                Score 50% or higher to pass. Pay ₹199 to unlock your certificate with secure Razorpay payment gateway.
              </p>
            </div>

            <div className="text-center">
              <div className="w-20 h-20 bg-octamy-black text-white rounded-full flex items-center justify-center mx-auto mb-6 text-2xl font-bold">
                3
              </div>
              <h3 className="text-2xl font-bold text-octamy-black mb-4">Download & Share</h3>
              <p className="text-octamy-gray-600">
                Get your verified certificate with unique ID and QR code. Share on LinkedIn, Twitter, or download PDF instantly.
              </p>
            </div>
          </div>
        </div>
      </section>

      <Footer />
    </div>
  );
}
