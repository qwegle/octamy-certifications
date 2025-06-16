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