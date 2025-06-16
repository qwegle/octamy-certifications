import { useQuery } from "@tanstack/react-query";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Link } from "wouter";
import { useState } from "react";
import { 
  Brain, 
  Code, 
  TrendingUp, 
  GraduationCap, 
  Search, 
  Users, 
  Star, 
  Shield, 
  Target, 
  Award, 
  CheckCircle, 
  ArrowRight, 
  Briefcase, 
  Database, 
  Palette, 
  LineChart 
} from "lucide-react";
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
          <div className="w-full h-full bg-repeat opacity-30" style={{
            backgroundImage: `url("data:image/svg+xml,%3Csvg width='20' height='20' viewBox='0 0 20 20' xmlns='http://www.w3.org/2000/svg'%3E%3Cg fill='%23ffffff' fill-opacity='0.1'%3E%3Cpath d='M0 0h20v20H0V0zm10 10a5 5 0 1 1 0-10 5 5 0 0 1 0 10z'/%3E%3C/g%3E%3C/svg%3E")`
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
              <Button 
                size="lg" 
                className="bg-white text-black hover:bg-gray-100 px-8 py-4 text-lg font-bold border-2 border-white"
              >
                START LEARNING
                <ArrowRight className="ml-2 h-5 w-5" />
              </Button>
              <Button 
                variant="outline" 
                size="lg"
                className="text-white border-white hover:bg-white hover:text-black px-8 py-4 text-lg font-bold"
              >
                VIEW CERTIFICATES
              </Button>
            </div>

            {/* Stats Section */}
            <div className="grid grid-cols-3 gap-8 max-w-2xl mx-auto">
              <div className="text-center">
                <div className="text-3xl font-bold text-white">50+</div>
                <div className="text-gray-400 text-sm">COURSES</div>
              </div>
              <div className="text-center">
                <div className="text-3xl font-bold text-white">10</div>
                <div className="text-gray-400 text-sm">CATEGORIES</div>
              </div>
              <div className="text-center">
                <div className="text-3xl font-bold text-white">5000+</div>
                <div className="text-gray-400 text-sm">QUESTIONS</div>
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

          {/* Categories Grid */}
          <div className="grid grid-cols-2 md:grid-cols-5 gap-6 mb-16">
            {categories.map((category) => {
              const IconComponent = categoryIcons[category.name as keyof typeof categoryIcons] || Brain;
              return (
                <motion.div
                  key={category.id}
                  whileHover={{ scale: 1.05 }}
                  whileTap={{ scale: 0.95 }}
                >
                  <Card className="border-2 border-black hover:bg-black hover:text-white transition-all cursor-pointer group">
                    <CardContent className="p-6 text-center">
                      <IconComponent className="w-8 h-8 mx-auto mb-3 text-black group-hover:text-white" />
                      <h3 className="font-bold text-sm">{category.name}</h3>
                    </CardContent>
                  </Card>
                </motion.div>
              );
            })}
          </div>

          {/* Popular Courses */}
          <div className="mb-16">
            <h3 className="text-3xl font-bold text-black mb-8 text-center">POPULAR COURSES</h3>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8">
              {popularCourses.map((course) => (
                <CourseCard key={course.id} course={course} />
              ))}
            </div>
          </div>
        </div>
      </section>

      {/* Features Section */}
      <section className="py-16 bg-black text-white">
        <div className="max-w-7xl mx-auto px-6">
          <div className="text-center mb-12">
            <h2 className="text-4xl font-bold mb-6">WHY CHOOSE OCTAMY</h2>
            <p className="text-gray-300 text-lg max-w-2xl mx-auto">
              Industry-leading certification platform with comprehensive features designed for professional growth.
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
            <div className="text-center">
              <Shield className="w-12 h-12 mx-auto mb-4 text-white" />
              <h3 className="text-xl font-bold mb-3">ANTI-CHEATING SYSTEM</h3>
              <p className="text-gray-300">Advanced monitoring and randomized questions ensure certificate integrity.</p>
            </div>
            <div className="text-center">
              <Award className="w-12 h-12 mx-auto mb-4 text-white" />
              <h3 className="text-xl font-bold mb-3">INDUSTRY RECOGNIZED</h3>
              <p className="text-gray-300">Certificates valued by employers across multiple industries and domains.</p>
            </div>
            <div className="text-center">
              <Users className="w-12 h-12 mx-auto mb-4 text-white" />
              <h3 className="text-xl font-bold mb-3">EXPERT SUPPORT</h3>
              <p className="text-gray-300">24/7 support from industry experts to guide your certification journey.</p>
            </div>
          </div>
        </div>
      </section>

      {/* Footer */}
      <footer className="bg-white border-t-2 border-black py-12">
        <div className="max-w-7xl mx-auto px-6">
          <div className="grid grid-cols-1 md:grid-cols-4 gap-8">
            <div>
              <h3 className="text-2xl font-bold text-black mb-4">OCTAMY</h3>
              <p className="text-gray-600">Professional certification platform for career advancement.</p>
            </div>
            <div>
              <h4 className="font-bold text-black mb-4">COURSES</h4>
              <ul className="space-y-2 text-gray-600">
                <li><Link href="/" className="hover:text-black">All Courses</Link></li>
                <li><Link href="/" className="hover:text-black">AI & Machine Learning</Link></li>
                <li><Link href="/" className="hover:text-black">Development</Link></li>
                <li><Link href="/" className="hover:text-black">Business</Link></li>
              </ul>
            </div>
            <div>
              <h4 className="font-bold text-black mb-4">SUPPORT</h4>
              <ul className="space-y-2 text-gray-600">
                <li><Link href="/help-center" className="hover:text-black">Help Center</Link></li>
                <li><Link href="/verify" className="hover:text-black">Verify Certificate</Link></li>
                <li><Link href="/partners" className="hover:text-black">Partner Program</Link></li>
              </ul>
            </div>
            <div>
              <h4 className="font-bold text-black mb-4">LEGAL</h4>
              <ul className="space-y-2 text-gray-600">
                <li><Link href="/privacy-policy" className="hover:text-black">Privacy Policy</Link></li>
                <li><Link href="/terms-of-service" className="hover:text-black">Terms of Service</Link></li>
              </ul>
            </div>
          </div>
          <div className="border-t border-gray-200 mt-8 pt-8 text-center">
            <p className="text-gray-600">&copy; 2025 Octamy. All rights reserved.</p>
          </div>
        </div>
      </footer>
    </div>
  );
}