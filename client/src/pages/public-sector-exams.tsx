import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Link } from "wouter";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Search, Award, Building2, GraduationCap, Train, Landmark, ArrowRight, CheckCircle, TrendingUp, Users } from "lucide-react";
import CourseCard from "@/components/course-card";
import Header from "@/components/header";
import Footer from "@/components/footer";
import { useAuth } from "@/hooks/useAuth";
import type { Category, Course } from "@shared/schema";
import { Helmet } from "react-helmet-async";

export default function PublicSectorExams() {
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedCategory, setSelectedCategory] = useState<number | null>(null);
  const [selectedYear, setSelectedYear] = useState<string | null>(null);
  const { user, isLoading } = useAuth();
  const isAuthenticated = !isLoading && user !== null;

  const { data: categories = [] } = useQuery<Category[]>({
    queryKey: ["/api/categories"],
  });

  const { data: allCourses = [] } = useQuery<(Course & { category: Category })[]>({
    queryKey: ["/api/courses"],
  });

  const publicSectorCategoryIds = categories
    .filter(cat => 
      cat.name.toLowerCase().includes('upsc') ||
      cat.name.toLowerCase().includes('ssc') ||
      cat.name.toLowerCase().includes('railway') ||
      cat.name.toLowerCase().includes('banking') ||
      cat.name.toLowerCase().includes('ias') ||
      cat.name.toLowerCase().includes('ips') ||
      cat.name.toLowerCase().includes('public') ||
      cat.name.toLowerCase().includes('government')
    )
    .map(cat => cat.id);

  const publicSectorCategories = categories.filter(cat => publicSectorCategoryIds.includes(cat.id));

  // Extract unique years from course titles
  const availableYears = Array.from(
    new Set(
      allCourses
        .filter(course => publicSectorCategoryIds.includes(course.categoryId))
        .map(course => {
          const yearMatch = course.title.match(/\b(20\d{2})\b/);
          return yearMatch ? yearMatch[1] : null;
        })
        .filter(Boolean)
    )
  ).sort().reverse();

  const filteredCourses = allCourses.filter((course) => {
    const matchesSearch = course.title
      .toLowerCase()
      .includes(searchQuery.toLowerCase()) ||
      course.description?.toLowerCase().includes(searchQuery.toLowerCase());
    
    const matchesCategory =
      selectedCategory === null || course.categoryId === selectedCategory;
    
    const matchesYear =
      selectedYear === null || course.title.includes(selectedYear);
    
    const isPublicSectorCourse = publicSectorCategoryIds.includes(course.categoryId);

    return matchesSearch && matchesCategory && matchesYear && isPublicSectorCourse;
  });

  return (
    <>
      <Helmet>
        <title>Public Sector Exam Preparation - UPSC, SSC, Railway, Banking - PremCQ</title>
        <meta
          name="description"
          content="Prepare for UPSC, IAS, IPS, SSC, Railway, and Banking exams with comprehensive MCQ practice tests. Get instant results and track your preparation progress."
        />
      </Helmet>

      <div className="min-h-screen bg-background">
        <Header />

        <section className="bg-gradient-to-br from-gray-50 via-white to-gray-50 py-16 border-b">
          <div className="max-w-7xl mx-auto px-6">
            <div className="text-center max-w-4xl mx-auto">
              <Badge className="mb-4 bg-black text-white">Public Sector Exam Preparation</Badge>
              <h1 className="text-4xl lg:text-5xl font-bold text-foreground mb-6">
                Ace Government Exams with Comprehensive MCQ Practice
              </h1>
              <p className="text-lg text-muted-foreground mb-8">
                Prepare for UPSC, IAS, IPS, SSC, Railway, Banking and other competitive exams. Practice with expert-curated questions and track your progress with performance analytics.
              </p>

              <div className="grid md:grid-cols-4 gap-6 mt-12">
                <div className="text-center" data-testid="stat-exams">
                  <div className="w-16 h-16 bg-primary/10 rounded-full flex items-center justify-center mx-auto mb-3">
                    <Building2 className="w-8 h-8 text-primary" />
                  </div>
                  <div className="text-3xl font-bold text-foreground">{filteredCourses.length}+</div>
                  <div className="text-sm text-muted-foreground">Exam Courses</div>
                </div>
                <div className="text-center" data-testid="stat-questions">
                  <div className="w-16 h-16 bg-primary/10 rounded-full flex items-center justify-center mx-auto mb-3">
                    <GraduationCap className="w-8 h-8 text-primary" />
                  </div>
                  <div className="text-3xl font-bold text-foreground">10K+</div>
                  <div className="text-sm text-muted-foreground">Practice Questions</div>
                </div>
                <div className="text-center" data-testid="stat-aspirants">
                  <div className="w-16 h-16 bg-primary/10 rounded-full flex items-center justify-center mx-auto mb-3">
                    <Users className="w-8 h-8 text-primary" />
                  </div>
                  <div className="text-3xl font-bold text-foreground">15K+</div>
                  <div className="text-sm text-muted-foreground">Aspirants</div>
                </div>
                <div className="text-center" data-testid="stat-selection">
                  <div className="w-16 h-16 bg-primary/10 rounded-full flex items-center justify-center mx-auto mb-3">
                    <TrendingUp className="w-8 h-8 text-primary" />
                  </div>
                  <div className="text-3xl font-bold text-foreground">95%</div>
                  <div className="text-sm text-muted-foreground">Accuracy Rate</div>
                </div>
              </div>
            </div>
          </div>
        </section>

        <section className="py-16">
          <div className="max-w-7xl mx-auto px-6">
            <div className="mb-12">
              <div className="max-w-2xl mx-auto">
                <div className="relative">
                  <Search className="absolute left-3 top-3 h-5 w-5 text-muted-foreground" />
                  <Input
                    type="text"
                    placeholder="Search public sector exams..."
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    className="pl-10"
                    data-testid="input-search"
                  />
                </div>
              </div>
            </div>

            {/* Category Filter */}
            <div className="mb-6">
              <h3 className="text-sm font-semibold text-foreground mb-3 text-center">Filter by Category</h3>
              <div className="flex flex-wrap justify-center gap-3">
                <Button
                  variant={selectedCategory === null ? "default" : "outline"}
                  onClick={() => setSelectedCategory(null)}
                  className={selectedCategory === null ? "bg-black text-white" : "border-black text-black hover:bg-black hover:text-white"}
                  data-testid="button-all-categories"
                >
                  All Categories
                </Button>
                {publicSectorCategories.map((category) => (
                  <Button
                    key={category.id}
                    variant={selectedCategory === category.id ? "default" : "outline"}
                    onClick={() => setSelectedCategory(category.id)}
                    className={selectedCategory === category.id ? "bg-black text-white" : "border-black text-black hover:bg-black hover:text-white"}
                    data-testid={`button-category-${category.id}`}
                  >
                    {category.name.replace('Public Sector - ', '')}
                  </Button>
                ))}
              </div>
            </div>

            {/* Year Filter */}
            {availableYears.length > 0 && (
              <div className="mb-12">
                <h3 className="text-sm font-semibold text-foreground mb-3 text-center">Filter by Year</h3>
                <div className="flex flex-wrap justify-center gap-3">
                  <Button
                    variant={selectedYear === null ? "default" : "outline"}
                    onClick={() => setSelectedYear(null)}
                    className={selectedYear === null ? "bg-black text-white" : "border-black text-black hover:bg-black hover:text-white"}
                    data-testid="button-all-years"
                  >
                    All Years
                  </Button>
                  {availableYears.map((year) => (
                    <Button
                      key={year}
                      variant={selectedYear === year ? "default" : "outline"}
                      onClick={() => setSelectedYear(year)}
                      className={selectedYear === year ? "bg-black text-white" : "border-black text-black hover:bg-black hover:text-white"}
                      data-testid={`button-year-${year}`}
                    >
                      {year}
                    </Button>
                  ))}
                </div>
              </div>
            )}

            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8">
              {filteredCourses.map((course) => (
                <CourseCard key={course.id} course={course} />
              ))}
            </div>

            {filteredCourses.length === 0 && (
              <div className="text-center py-16" data-testid="no-results">
                <GraduationCap className="w-16 h-16 text-muted-foreground mx-auto mb-4" />
                <h3 className="text-xl font-semibold text-foreground mb-2">
                  No exams found
                </h3>
                <p className="text-muted-foreground mb-6">
                  Try adjusting your search or category filter
                </p>
                <Button variant="outline" onClick={() => {
                  setSearchQuery("");
                  setSelectedCategory(null);
                  setSelectedYear(null);
                }} className="border-black text-black hover:bg-black hover:text-white">
                  Clear Filters
                </Button>
              </div>
            )}
          </div>
        </section>

        <section className="bg-card border-t py-16">
          <div className="max-w-7xl mx-auto px-6">
            <div className="grid md:grid-cols-3 gap-8">
              <div className="flex gap-4">
                <div className="flex-shrink-0">
                  <div className="w-12 h-12 bg-primary/10 rounded-md flex items-center justify-center">
                    <CheckCircle className="w-6 h-6 text-primary" />
                  </div>
                </div>
                <div>
                  <h3 className="font-semibold text-foreground mb-2">Latest Syllabus</h3>
                  <p className="text-sm text-muted-foreground">
                    Questions aligned with current exam patterns and latest syllabuses
                  </p>
                </div>
              </div>
              <div className="flex gap-4">
                <div className="flex-shrink-0">
                  <div className="w-12 h-12 bg-primary/10 rounded-md flex items-center justify-center">
                    <Landmark className="w-6 h-6 text-primary" />
                  </div>
                </div>
                <div>
                  <h3 className="font-semibold text-foreground mb-2">Yearly Papers</h3>
                  <p className="text-sm text-muted-foreground">
                    Practice with previous year question papers and predictive tests
                  </p>
                </div>
              </div>
              <div className="flex gap-4">
                <div className="flex-shrink-0">
                  <div className="w-12 h-12 bg-primary/10 rounded-md flex items-center justify-center">
                    <Award className="w-6 h-6 text-primary" />
                  </div>
                </div>
                <div>
                  <h3 className="font-semibold text-foreground mb-2">Performance Tracking</h3>
                  <p className="text-sm text-muted-foreground">
                    Detailed analytics to identify strengths and areas for improvement
                  </p>
                </div>
              </div>
            </div>
          </div>
        </section>

        <Footer />
      </div>
    </>
  );
}
