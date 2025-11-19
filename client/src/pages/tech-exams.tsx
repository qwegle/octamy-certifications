import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Link } from "wouter";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Search, Award, Monitor, Code, Database, Brain, ArrowRight, CheckCircle, TrendingUp } from "lucide-react";
import CourseCard from "@/components/course-card";
import Header from "@/components/header";
import Footer from "@/components/footer";
import { useAuth } from "@/hooks/useAuth";
import type { Category, Course } from "@shared/schema";
import { Helmet } from "react-helmet-async";

export default function TechExams() {
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedCategory, setSelectedCategory] = useState<number | null>(null);
  const { user, isLoading } = useAuth();
  const isAuthenticated = !isLoading && user !== null;

  const { data: categories = [] } = useQuery<Category[]>({
    queryKey: ["/api/categories"],
  });

  const { data: allCourses = [] } = useQuery<(Course & { category: Category })[]>({
    queryKey: ["/api/courses"],
  });

  const techCategoryIds = categories
    .filter(cat => 
      cat.name.toLowerCase().includes('web') ||
      cat.name.toLowerCase().includes('ai') ||
      cat.name.toLowerCase().includes('ml') ||
      cat.name.toLowerCase().includes('data') ||
      cat.name.toLowerCase().includes('development') ||
      cat.name.toLowerCase().includes('programming') ||
      cat.name.toLowerCase().includes('tech')
    )
    .map(cat => cat.id);

  const techCategories = categories.filter(cat => techCategoryIds.includes(cat.id));

  const filteredCourses = allCourses.filter((course) => {
    const matchesSearch = course.title
      .toLowerCase()
      .includes(searchQuery.toLowerCase()) ||
      course.description?.toLowerCase().includes(searchQuery.toLowerCase());
    
    const matchesCategory =
      selectedCategory === null || course.categoryId === selectedCategory;
    
    const isTechCourse = techCategoryIds.includes(course.categoryId);

    return matchesSearch && matchesCategory && isTechCourse;
  });

  return (
    <>
      <Helmet>
        <title>Technology Certifications - PremCQ</title>
        <meta
          name="description"
          content="Get certified in Web Development, AI/ML, Data Science, Python, React, and more. Industry-recognized technology certifications with instant verification and performance badges."
        />
      </Helmet>

      <div className="min-h-screen bg-background">
        <Header />

        <section className="bg-gradient-to-br from-gray-50 via-white to-gray-50 py-16 border-b">
          <div className="max-w-7xl mx-auto px-6">
            <div className="text-center max-w-4xl mx-auto">
              <Badge className="mb-4 bg-black text-white">Technology Certifications</Badge>
              <h1 className="text-4xl lg:text-5xl font-bold text-foreground mb-6">
                Master Technology with Expert-Level MCQ Assessments
              </h1>
              <p className="text-lg text-muted-foreground mb-8">
                Prove your technical expertise in Web Development, AI/ML, Data Science, and more. Get instant verification and industry-recognized certificates.
              </p>

              <div className="grid md:grid-cols-4 gap-6 mt-12">
                <div className="text-center" data-testid="stat-courses">
                  <div className="w-16 h-16 bg-primary/10 rounded-full flex items-center justify-center mx-auto mb-3">
                    <Monitor className="w-8 h-8 text-primary" />
                  </div>
                  <div className="text-3xl font-bold text-foreground">{filteredCourses.length}+</div>
                  <div className="text-sm text-muted-foreground">Tech Courses</div>
                </div>
                <div className="text-center" data-testid="stat-skills">
                  <div className="w-16 h-16 bg-primary/10 rounded-full flex items-center justify-center mx-auto mb-3">
                    <Code className="w-8 h-8 text-primary" />
                  </div>
                  <div className="text-3xl font-bold text-foreground">20+</div>
                  <div className="text-sm text-muted-foreground">Technologies</div>
                </div>
                <div className="text-center" data-testid="stat-certificates">
                  <div className="w-16 h-16 bg-primary/10 rounded-full flex items-center justify-center mx-auto mb-3">
                    <Award className="w-8 h-8 text-primary" />
                  </div>
                  <div className="text-3xl font-bold text-foreground">5K+</div>
                  <div className="text-sm text-muted-foreground">Certificates Issued</div>
                </div>
                <div className="text-center" data-testid="stat-success">
                  <div className="w-16 h-16 bg-primary/10 rounded-full flex items-center justify-center mx-auto mb-3">
                    <TrendingUp className="w-8 h-8 text-primary" />
                  </div>
                  <div className="text-3xl font-bold text-foreground">98%</div>
                  <div className="text-sm text-muted-foreground">Success Rate</div>
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
                    placeholder="Search technology certifications..."
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    className="pl-10"
                    data-testid="input-search"
                  />
                </div>
              </div>
            </div>

            <div className="flex flex-wrap justify-center gap-3 mb-12">
              <Button
                variant={selectedCategory === null ? "default" : "outline"}
                onClick={() => setSelectedCategory(null)}
                data-testid="button-all-categories"
              >
                All Tech
              </Button>
              {techCategories.map((category) => (
                <Button
                  key={category.id}
                  variant={selectedCategory === category.id ? "default" : "outline"}
                  onClick={() => setSelectedCategory(category.id)}
                  data-testid={`button-category-${category.id}`}
                >
                  {category.name}
                </Button>
              ))}
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8">
              {filteredCourses.map((course) => (
                <CourseCard key={course.id} course={course} />
              ))}
            </div>

            {filteredCourses.length === 0 && (
              <div className="text-center py-16" data-testid="no-results">
                <Database className="w-16 h-16 text-muted-foreground mx-auto mb-4" />
                <h3 className="text-xl font-semibold text-foreground mb-2">
                  No courses found
                </h3>
                <p className="text-muted-foreground mb-6">
                  Try adjusting your search or category filter
                </p>
                <Button variant="outline" onClick={() => {
                  setSearchQuery("");
                  setSelectedCategory(null);
                }}>
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
                  <h3 className="font-semibold text-foreground mb-2">Industry-Recognized</h3>
                  <p className="text-sm text-muted-foreground">
                    Certificates accepted by leading tech companies and startups across India
                  </p>
                </div>
              </div>
              <div className="flex gap-4">
                <div className="flex-shrink-0">
                  <div className="w-12 h-12 bg-primary/10 rounded-md flex items-center justify-center">
                    <Brain className="w-6 h-6 text-primary" />
                  </div>
                </div>
                <div>
                  <h3 className="font-semibold text-foreground mb-2">AI-Curated Questions</h3>
                  <p className="text-sm text-muted-foreground">
                    Intelligent question selection based on difficulty and industry relevance
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
                  <h3 className="font-semibold text-foreground mb-2">Performance Badges</h3>
                  <p className="text-sm text-muted-foreground">
                    Earn Bronze, Silver, Gold, or Platinum badges based on your score
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
