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
import { useLocation } from "wouter";

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
  const [, navigate] = useLocation();

  const { data: categories = [] } = useQuery<Category[]>({
    queryKey: ['/api/categories'],
  });

  const { data: courses = [] } = useQuery<(Course & { category: Category })[]>({
    queryKey: ['/api/courses'],
  });

  // Fetch certificate count for stats
  const { data: certificateCount = { count: 0 } } = useQuery<{ count: number }>({
    queryKey: ['/api/user/certificates/count'],
    retry: false,
  });

  const filteredCourses = courses.filter(course =>
    course.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
    course.description.toLowerCase().includes(searchQuery.toLowerCase()) ||
    course.category.name.toLowerCase().includes(searchQuery.toLowerCase())
  );

  const popularCourses = filteredCourses.slice(0, 6);

  return (
    <div className="min-h-screen bg-white">
      {/* Black and White Cred-style Header */}
      <header className="bg-black text-white">
        <div className="max-w-7xl mx-auto px-6 py-4">
          <div className="flex justify-between items-center">
            <div className="flex items-center space-x-8">
              <Link href="/">
                <h1 className="text-3xl font-bold tracking-tight">OCTAMY</h1>
              </Link>
              <nav className="hidden md:flex space-x-8">
                <Link href="/" className="hover:text-gray-300 transition-colors">Courses</Link>
                <Link href="/verify" className="hover:text-gray-300 transition-colors">Verify</Link>
                <Link href="/help-center" className="hover:text-gray-300 transition-colors">Help</Link>
              </nav>
            </div>
            <div className="flex items-center space-x-4">
              <Link href="/partners">
                <Button variant="outline" className="text-white border-white hover:bg-white hover:text-black">
                  Become Partner
                </Button>
              </Link>
              <Link href="/auth">
                <Button className="bg-white text-black hover:bg-gray-100">
                  Login
                </Button>
              </Link>
            </div>
          </div>
        </div>
      </header>
      
      {/* Black and White Cred-style Hero Section */}
      <section className="relative bg-black text-white py-20 overflow-hidden">
        <div className="absolute inset-0 opacity-10">
          <div className="absolute inset-0 bg-repeat" style={{
            backgroundImage: `url("data:image/svg+xml,%3Csvg width='60' height='60' viewBox='0 0 60 60' xmlns='http://www.w3.org/2000/svg'%3E%3Cg fill='none' fill-rule='evenodd'%3E%3Cg fill='%23ffffff' fill-opacity='0.03'%3E%3Cpath d='m36 34v-4h-2v4h-4v2h4v4h2v-4h4v-2h-4zm0-30V0h-2v4h-4v2h4v4h2V6h4V4h-4zM6 34v-4H4v4H0v2h4v4h2v-4h4v-2H6zM6 4V0H4v4H0v2h4v4h2V6h4V4H6z'/%3E%3C/g%3E%3C/g%3E%3C/svg%3E")`
          }}></div>
        </div>
        
        <div className="relative max-w-7xl mx-auto px-6 text-center">
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.8 }}
          >
            <h1 className="text-6xl md:text-8xl font-bold mb-6 tracking-tight">
              GET
              <br />
              <span className="text-white">CERTIFIED</span>
            </h1>
            <p className="text-xl md:text-2xl text-gray-300 mb-8 max-w-3xl mx-auto leading-relaxed">
              Professional certifications that matter. Build your career with industry-recognized credentials.
            </p>
            
            <div className="flex flex-col sm:flex-row gap-4 justify-center items-center mb-12">
              <a href="#courses">
                <Button 
                  size="lg" 
                  className="bg-white text-black hover:bg-gray-100 px-8 py-4 text-lg font-bold border-2 border-white"
                >
                  START LEARNING
                  <ArrowRight className="ml-2 h-5 w-5" />
                </Button>
              </a>
              <Link href="/demo-certificate">
                <Button 
                  variant="outline" 
                  size="lg"
                  className="text-white border-white hover:bg-white hover:text-black px-8 py-4 text-lg font-bold"
                >
                  VIEW CERTIFICATES
                </Button>
              </Link>
            </div>

            {/* Stats Section */}
            <div className="grid grid-cols-3 gap-8 max-w-2xl mx-auto">
              <div className="text-center">
                <div className="text-3xl font-bold text-white">{courses.length}+</div>
                <div className="text-gray-400 text-sm">COURSES</div>
              </div>
              <div className="text-center">
                <div className="text-3xl font-bold text-white">{categories.length}</div>
                <div className="text-gray-400 text-sm">CATEGORIES</div>
              </div>
              <div className="text-center">
                <div className="text-3xl font-bold text-white">{certificateCount.count}</div>
                <div className="text-gray-400 text-sm">CERTIFIED</div>
              </div>
            </div>
          </motion.div>
        </div>
      </section>

      {/* Partner Program Section */}
      <section className="py-16 bg-white border-b-2 border-black">
        <div className="max-w-7xl mx-auto px-6">
          <div className="grid md:grid-cols-2 gap-12 items-center">
            <div>
              <h2 className="text-4xl font-bold text-black mb-6">EARN 10% COMMISSION</h2>
              <p className="text-gray-600 text-lg mb-6 leading-relaxed">
                Join our partner program and earn money by sharing professional certification courses. 
                Get instant payouts and real-time analytics.
              </p>
              <div className="space-y-4 mb-8">
                <div className="flex items-center">
                  <CheckCircle className="h-5 w-5 text-black mr-3" />
                  <span className="text-gray-700">10% commission on every sale</span>
                </div>
                <div className="flex items-center">
                  <CheckCircle className="h-5 w-5 text-black mr-3" />
                  <span className="text-gray-700">Real-time dashboard and analytics</span>
                </div>
                <div className="flex items-center">
                  <CheckCircle className="h-5 w-5 text-black mr-3" />
                  <span className="text-gray-700">UPI and bank withdrawal options</span>
                </div>
                <div className="flex items-center">
                  <CheckCircle className="h-5 w-5 text-black mr-3" />
                  <span className="text-gray-700">Dedicated partner support</span>
                </div>
              </div>
              <Link href="/partners">
                <Button className="bg-black text-white hover:bg-gray-800 px-8 py-4 text-lg font-bold">
                  BECOME A PARTNER
                </Button>
              </Link>
            </div>
            <div className="bg-black p-8 text-white">
              <h3 className="text-2xl font-bold mb-6">PARTNER BENEFITS</h3>
              <div className="space-y-6">
                <div className="border-b border-gray-700 pb-4">
                  <div className="text-3xl font-bold">₹19.90</div>
                  <div className="text-gray-300">Commission per ₹199 course</div>
                </div>
                <div className="border-b border-gray-700 pb-4">
                  <div className="text-3xl font-bold">5-7 days</div>
                  <div className="text-gray-300">Withdrawal processing time</div>
                </div>
                <div>
                  <div className="text-3xl font-bold">₹500</div>
                  <div className="text-gray-300">Minimum withdrawal amount</div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Search and Categories Section */}
      <section className="py-16 bg-white">
        <div className="max-w-7xl mx-auto px-6">
          <div className="text-center mb-12">
            <h2 className="text-4xl font-bold text-black mb-6">EXPLORE COURSES</h2>
            <div className="max-w-md mx-auto">
              <div className="relative">
                <Search className="absolute left-3 top-3 h-5 w-5 text-gray-400" />
                <Input
                  type="text"
                  placeholder="Search courses..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="pl-10 pr-4 py-3 border-2 border-black focus:border-black"
                />
              </div>
            </div>
          </div>
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

          {/* Category Grid with Animations */}
          <motion.div 
            className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-5 gap-6 mb-16"
            initial={{ opacity: 0, y: 50 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.8, staggerChildren: 0.1 }}
          >
            {categories.map((category, index) => {
              const IconComponent = categoryIcons[category.name as keyof typeof categoryIcons] || Brain;
              const categoryCoursesCount = courses.filter(c => c.categoryId === category.id).length;
              
              return (
                <motion.div
                  key={category.id}
                  initial={{ opacity: 0, y: 50 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ duration: 0.6, delay: index * 0.1 }}
                  whileHover={{ y: -10, scale: 1.02 }}
                  whileTap={{ scale: 0.98 }}
                >
                  <Card className="relative bg-gradient-to-br from-white to-gray-50 rounded-2xl shadow-lg border border-gray-200 p-6 hover:shadow-2xl transition-all duration-500 group overflow-hidden">
                    {/* Background decoration */}
                    <div className="absolute top-0 right-0 w-20 h-20 bg-gradient-to-br from-yellow-100 to-orange-100 rounded-full -translate-y-10 translate-x-10 group-hover:scale-150 transition-transform duration-500"></div>
                    
                    <CardContent className="relative text-center p-0">
                      <div className="w-14 h-14 bg-gradient-to-br from-slate-800 to-slate-900 rounded-2xl flex items-center justify-center mx-auto mb-4 group-hover:rotate-12 transition-transform duration-300">
                        <IconComponent className="w-7 h-7 text-white" />
                      </div>
                      <h3 className="text-lg font-bold text-slate-800 mb-2 group-hover:text-slate-900">{category.name}</h3>
                      <p className="text-sm text-slate-600 mb-3 line-clamp-2">{category.description}</p>
                      <div className="flex items-center justify-center gap-2 text-xs text-slate-500 mb-4">
                        <Award className="w-3 h-3" />
                        <span>{categoryCoursesCount} Courses</span>
                      </div>
                      <Button 
                        size="sm"
                        className="w-full bg-gradient-to-r from-slate-800 to-slate-900 text-white hover:from-slate-900 hover:to-black transition-all duration-300 group-hover:shadow-lg"
                        onClick={() => {
                          const categoryElement = document.getElementById('popular-certifications');
                          if (categoryElement) {
                            categoryElement.scrollIntoView({ behavior: 'smooth' });
                          }
                          setSearchQuery(category.name);
                        }}
                      >
                        Explore {category.name}
                      </Button>
                    </CardContent>
                  </Card>
                </motion.div>
              );
            })}
          </motion.div>
        </div>
      </section>

      {/* Popular Certifications */}
      <section id="popular-certifications" className="bg-octamy-gray-50 py-20">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="text-center mb-16">
            <h2 className="text-4xl font-bold text-octamy-black mb-4">Popular Certifications</h2>
            <p className="text-xl text-octamy-gray-600 max-w-2xl mx-auto">
              Start with our most popular certifications across different skill levels and advance your career today.
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8">
            {popularCourses.map((course) => (
              <CourseCard key={course.id} course={course} />
            ))}
          </div>

          {filteredCourses.length > 6 && (
            <div className="text-center mt-12">
              <Button variant="outline" className="border-octamy-black text-octamy-black px-8 py-3 text-lg font-semibold hover:bg-octamy-black hover:text-white">
                View All {filteredCourses.length} Certifications
                <ArrowRight className="w-5 h-5 ml-2" />
              </Button>
            </div>
          )}
        </div>
      </section>

      {/* Features Section */}
      <section className="py-20">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-12">
            <div className="text-center">
              <div className="w-16 h-16 bg-octamy-black rounded-full flex items-center justify-center mx-auto mb-6">
                <CheckCircle className="w-8 h-8 text-white" />
              </div>
              <h3 className="text-2xl font-bold text-octamy-black mb-4">Industry Recognized</h3>
              <p className="text-octamy-gray-600">
                Our certificates are recognized by leading companies and help advance your career.
              </p>
            </div>
            
            <div className="text-center">
              <div className="w-16 h-16 bg-octamy-black rounded-full flex items-center justify-center mx-auto mb-6">
                <Clock className="w-8 h-8 text-white" />
              </div>
              <h3 className="text-2xl font-bold text-octamy-black mb-4">Quick Assessment</h3>
              <p className="text-octamy-gray-600">
                Complete your certification in 15-45 minutes with our efficient assessment system.
              </p>
            </div>
            
            <div className="text-center">
              <div className="w-16 h-16 bg-octamy-black rounded-full flex items-center justify-center mx-auto mb-6">
                <Users className="w-8 h-8 text-white" />
              </div>
              <h3 className="text-2xl font-bold text-octamy-black mb-4">Trusted by 10k+</h3>
              <p className="text-octamy-gray-600">
                Join thousands of professionals who have advanced their careers with Octamy.
              </p>
            </div>
          </div>
        </div>
      </section>

      <Footer />
    </div>
  );
}