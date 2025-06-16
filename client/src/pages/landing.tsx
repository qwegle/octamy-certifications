import { useQuery } from "@tanstack/react-query";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Link } from "wouter";
import { useState, useEffect } from "react";
import { Brain, Code, TrendingUp, GraduationCap, Search, Clock, Users, Star, Shield, Zap, Target, Award, CheckCircle, ArrowRight, Briefcase, Database, Palette, LineChart } from "lucide-react";
import Header from "@/components/header";
import Footer from "@/components/footer";
import CourseCard from "@/components/course-card";
import type { Course, Category } from "@shared/schema";
import { motion } from "framer-motion";

const categoryIcons = {
  'AI': Brain,
  'Development': Code,
  'Business': TrendingUp,
  'Internships': GraduationCap,
  'Data Science': Database,
  'Design': Palette,
  'Marketing': Target,
  'Cybersecurity': Shield,
  'Finance': LineChart,
  'Project Management': Briefcase,
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
      <section className="relative bg-gradient-to-br from-slate-900 via-purple-900 to-slate-800 py-20 overflow-hidden">
        {/* Animated Background */}
        <div className="absolute inset-0">
          <div className="absolute inset-0 bg-[radial-gradient(circle_at_20%_80%,rgba(120,119,198,0.3),transparent_50%)] animate-pulse"></div>
          <div className="absolute inset-0 bg-[radial-gradient(circle_at_80%_20%,rgba(255,255,255,0.1),transparent_50%)] animate-pulse delay-1000"></div>
          <div className="absolute inset-0 bg-[radial-gradient(circle_at_40%_40%,rgba(120,119,198,0.2),transparent_50%)] animate-pulse delay-500"></div>
        </div>
        
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 relative z-10">
          <motion.div 
            className="text-center"
            initial={{ opacity: 0, y: 50 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.8 }}
          >
            <motion.h1 
              className="text-5xl md:text-6xl lg:text-7xl font-bold text-white mb-6"
              initial={{ opacity: 0, scale: 0.9 }}
              animate={{ opacity: 1, scale: 1 }}
              transition={{ duration: 1, delay: 0.2 }}
            >
              Master Your
              <span className="bg-gradient-to-r from-yellow-400 to-orange-500 bg-clip-text text-transparent block">
                Professional Skills
              </span>
            </motion.h1>
            
            <motion.p 
              className="text-xl text-gray-300 mb-8 max-w-3xl mx-auto leading-relaxed"
              initial={{ opacity: 0, y: 30 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.8, delay: 0.4 }}
            >
              Earn industry-recognized certifications in AI, Development, Data Science, Cybersecurity, and more. 
              Join thousands of professionals advancing their careers with our comprehensive assessment platform.
            </motion.p>
            
            <motion.div 
              className="flex flex-col sm:flex-row gap-4 justify-center mb-12"
              initial={{ opacity: 0, y: 30 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.8, delay: 0.6 }}
            >
              <a href="#courses">
                <Button className="bg-gradient-to-r from-yellow-400 to-orange-500 text-black px-8 py-4 text-lg font-semibold hover:from-yellow-500 hover:to-orange-600 transition-all duration-300 transform hover:scale-105 shadow-lg">
                  <Zap className="w-5 h-5 mr-2" />
                  Start Learning
                </Button>
              </a>
              <Link href="/verify">
                <Button variant="outline" className="border-white text-white px-8 py-4 text-lg font-semibold hover:bg-white hover:text-black transition-all duration-300 transform hover:scale-105">
                  <Shield className="w-5 h-5 mr-2" />
                  Verify Certificates
                </Button>
              </Link>
            </motion.div>
            
            {/* Stats Section */}
            <motion.div 
              className="grid grid-cols-2 md:grid-cols-4 gap-8 max-w-4xl mx-auto"
              initial={{ opacity: 0, y: 30 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.8, delay: 0.8 }}
            >
              <div className="text-center">
                <div className="text-3xl font-bold text-yellow-400 mb-2">50+</div>
                <div className="text-gray-300 text-sm">Certifications</div>
              </div>
              <div className="text-center">
                <div className="text-3xl font-bold text-yellow-400 mb-2">10k+</div>
                <div className="text-gray-300 text-sm">Professionals</div>
              </div>
              <div className="text-center">
                <div className="text-3xl font-bold text-yellow-400 mb-2">500+</div>
                <div className="text-gray-300 text-sm">Companies</div>
              </div>
              <div className="text-center">
                <div className="text-3xl font-bold text-yellow-400 mb-2">98%</div>
                <div className="text-gray-300 text-sm">Success Rate</div>
              </div>
            </motion.div>
          </motion.div>
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
                    <Button 
                      className="w-full bg-octamy-black text-white hover:bg-octamy-gray-800"
                      onClick={() => {
                        const categoryElement = document.getElementById('popular-certifications');
                        if (categoryElement) {
                          categoryElement.scrollIntoView({ behavior: 'smooth' });
                        }
                        setSearchQuery(category.name);
                      }}
                    >
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
      <section id="popular-certifications" className="bg-octamy-gray-50 py-20">
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
