import { useState, useMemo, useEffect } from "react";
import { useQuery } from "@tanstack/react-query";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { Link } from "wouter";
import { Search, Filter, Clock, Users, Star, TrendingUp, Award, Grid, List, SortAsc, SortDesc } from "lucide-react";
import Header from "@/components/header";
import Footer from "@/components/footer";
import CourseCard from "@/components/course-card";
import type { Course, Category } from "@shared/schema";
import { SEO } from "@/components/seo";

const sortOptions = [
  { value: "newest", label: "Recently Added", icon: TrendingUp },
  { value: "title", label: "Title A–Z", icon: Star },
  { value: "duration-asc", label: "Shortest Duration", icon: Clock },
  { value: "duration-desc", label: "Longest Duration", icon: Clock },
  { value: "price-asc", label: "Lowest Price", icon: SortAsc },
  { value: "price-desc", label: "Highest Price", icon: SortDesc },
];

const difficultyLevels = [
  { value: "novice", label: "Beginner" },
  { value: "intermediate", label: "Intermediate" },
  { value: "advanced", label: "Advanced" },
  { value: "expert", label: "Expert" },
];

const priceRanges = [
  { label: "Free", min: 0, max: 0 },
  { label: "Under ₹100", min: 1, max: 99 },
  { label: "₹100 - ₹500", min: 100, max: 500 },
  { label: "₹500 - ₹1000", min: 500, max: 1000 },
  { label: "Above ₹1000", min: 1000, max: Infinity },
];

export default function CoursesPage() {
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedCategory, setSelectedCategory] = useState<string>("all");
  const [selectedDifficulty, setSelectedDifficulty] = useState<string>("all");
  const [selectedPriceRange, setSelectedPriceRange] = useState<string>("all");
  const [sortBy, setSortBy] = useState("newest");
  const [viewMode, setViewMode] = useState<"grid" | "list">("grid");
  const [showFilters, setShowFilters] = useState(false);
  const [visible, setVisible] = useState(12);

  const { data: categories = [] } = useQuery<Category[]>({
    queryKey: ['/api/categories'],
  });

  const { data: courses = [], isLoading } = useQuery<(Course & { category: Category })[]>({
    queryKey: ['/api/courses'],
  });

  // Filter and sort courses
  const filteredAndSortedCourses = useMemo(() => {
    let filtered = courses.filter(course => {
      // Search filter
      const categoryName = course.category?.name || '';
      const matchesSearch = course.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
                           (course.description || '').toLowerCase().includes(searchQuery.toLowerCase()) ||
                           categoryName.toLowerCase().includes(searchQuery.toLowerCase());

      // Category filter
      const matchesCategory = selectedCategory === "all" || categoryName === selectedCategory;

      // Difficulty filter
      const matchesDifficulty = selectedDifficulty === "all" || (course.level || '').toLowerCase() === selectedDifficulty;

      // Price filter
      let matchesPrice = true;
      if (selectedPriceRange !== "all") {
        const priceRange = priceRanges.find(range => range.label === selectedPriceRange);
        if (priceRange) {
          const coursePrice = parseFloat(course.price);
          matchesPrice = coursePrice >= priceRange.min && coursePrice <= priceRange.max;
        }
      }

      return matchesSearch && matchesCategory && matchesDifficulty && matchesPrice;
    });

    // Sort courses
    filtered.sort((a, b) => {
      switch (sortBy) {
        case "title":
          return a.title.localeCompare(b.title);
        case "duration-asc":
          return a.duration - b.duration;
        case "duration-desc":
          return b.duration - a.duration;
        case "price-asc":
          return parseFloat(a.price) - parseFloat(b.price);
        case "price-desc":
          return parseFloat(b.price) - parseFloat(a.price);
        case "newest":
          return new Date(b.createdAt || 0).getTime() - new Date(a.createdAt || 0).getTime();
        default:
          return 0;
      }
    });

    return filtered;
  }, [courses, searchQuery, selectedCategory, selectedDifficulty, selectedPriceRange, sortBy]);

  // Reset pagination when filters change
  useEffect(() => {
    setVisible(12);
  }, [searchQuery, selectedCategory, selectedDifficulty, selectedPriceRange, sortBy]);

  const clearFilters = () => {
    setSearchQuery("");
    setSelectedCategory("all");
    setSelectedDifficulty("all");
    setSelectedPriceRange("all");
    setSortBy("newest");
  };

  const hasActiveFilters = searchQuery || selectedCategory !== "all" || selectedDifficulty !== "all" || selectedPriceRange !== "all";

  return (
    <div className="min-h-screen bg-cream-soft">
      <SEO
        title="Professional Certifications & Skill Verification Courses"
        description="Browse industry-recognized professional certifications across AI, Development, Cloud, Cybersecurity, Business and more. Free assessments, optional verified certificate."
        path="/courses"
      />
      <Header />
      
      {/* Hero Section */}
      <section className="relative overflow-hidden bg-slate-950 text-white">
        <div aria-hidden className="pointer-events-none absolute inset-0 bg-grid-slate opacity-20 [mask-image:radial-gradient(ellipse_at_top,black_30%,transparent_70%)]" />
        <div aria-hidden className="pointer-events-none absolute -top-24 left-1/4 h-[420px] w-[420px] rounded-full bg-sky-500/30 blur-3xl animate-blob" />
        <div aria-hidden className="pointer-events-none absolute -top-10 right-10 h-[320px] w-[320px] rounded-full bg-indigo-500/25 blur-3xl animate-blob-slow" />
        <div className="relative max-w-7xl mx-auto px-6 py-20 sm:py-24">
          <div className="text-center">
            <p className="inline-flex items-center gap-2 rounded-full border border-white/15 bg-cream-soft/5 backdrop-blur px-4 py-1.5 text-[11px] font-semibold uppercase tracking-[0.2em] text-sky-300">
              <Award className="h-3.5 w-3.5" /> Skill verification catalog
            </p>
            <h1 className="mt-6 text-4xl sm:text-5xl md:text-6xl font-extrabold tracking-tight">
              <span className="block">Verified skills.</span>
              <span className="mt-1 block bg-gradient-to-r from-sky-300 via-indigo-300 to-fuchsia-300 bg-clip-text text-transparent">
                Real career outcomes.
              </span>
            </h1>
            <p className="mt-5 text-lg text-slate-300 max-w-3xl mx-auto leading-relaxed">
              Master industry-relevant skills with our comprehensive assessments.
              Free to attempt — pay only when you pass.
            </p>
            <div className="mt-7 flex flex-wrap items-center justify-center gap-x-6 gap-y-3 text-sm text-slate-300">
              <div className="flex items-center gap-2">
                <Award className="h-4 w-4 text-sky-300" />
                {courses.length}+ exams
              </div>
              <div className="flex items-center gap-2">
                <Users className="h-4 w-4 text-sky-300" />
                {categories.length} categories
              </div>
              <div className="flex items-center gap-2">
                <Star className="h-4 w-4 text-sky-300" />
                Recruiter-verifiable
              </div>
            </div>
          </div>
        </div>
        <div className="absolute inset-x-0 bottom-0 h-px bg-gradient-to-r from-transparent via-white/20 to-transparent" />
      </section>

      {/* Search and Filters */}
      <section className="py-8 bg-cream-deep border-b">
        <div className="max-w-7xl mx-auto px-6">
          {/* Search Bar */}
          <div className="relative mb-6">
            <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 h-5 w-5" />
            <Input
              placeholder="Search courses, skills, or topics..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="pl-10 h-12 text-lg border-2 focus:border-black"
            />
          </div>

          {/* Filter Controls */}
          <div className="flex flex-wrap items-center gap-4 mb-6">
            <Button
              variant={showFilters ? "default" : "outline"}
              onClick={() => setShowFilters(!showFilters)}
              className="flex items-center gap-2"
            >
              <Filter className="h-4 w-4" />
              Filters
              {hasActiveFilters && (
                <Badge variant="destructive" className="ml-2 h-5 w-5 p-0 text-xs">
                  !
                </Badge>
              )}
            </Button>

            <Select value={sortBy} onValueChange={setSortBy}>
              <SelectTrigger className="w-48">
                <SelectValue placeholder="Sort by" />
              </SelectTrigger>
              <SelectContent>
                {sortOptions.map((option) => {
                  const Icon = option.icon;
                  return (
                    <SelectItem key={option.value} value={option.value}>
                      <div className="flex items-center gap-2">
                        <Icon className="h-4 w-4" />
                        {option.label}
                      </div>
                    </SelectItem>
                  );
                })}
              </SelectContent>
            </Select>

            <div className="flex items-center gap-2 ml-auto">
              <span className="text-sm text-gray-600">{filteredAndSortedCourses.length} courses</span>
              <Separator orientation="vertical" className="h-6" />
              <Button
                variant={viewMode === "grid" ? "default" : "outline"}
                size="sm"
                onClick={() => setViewMode("grid")}
                aria-label="Grid view"
                aria-pressed={viewMode === "grid"}
              >
                <Grid className="h-4 w-4" />
              </Button>
              <Button
                variant={viewMode === "list" ? "default" : "outline"}
                size="sm"
                onClick={() => setViewMode("list")}
                aria-label="List view"
                aria-pressed={viewMode === "list"}
              >
                <List className="h-4 w-4" />
              </Button>
            </div>
          </div>

          {/* Expanded Filters */}
          {showFilters && (
            <Card className="mb-6">
              <CardHeader>
                <CardTitle className="flex items-center justify-between">
                  Filter Courses
                  {hasActiveFilters && (
                    <Button variant="outline" size="sm" onClick={clearFilters}>
                      Clear All
                    </Button>
                  )}
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                  {/* Category Filter */}
                  <div>
                    <label className="text-sm font-medium mb-2 block">Category</label>
                    <Select value={selectedCategory} onValueChange={setSelectedCategory}>
                      <SelectTrigger>
                        <SelectValue placeholder="All Categories" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="all">All Categories</SelectItem>
                        {categories.map((category) => (
                          <SelectItem key={category.id} value={category.name}>
                            {category.name}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>

                  {/* Difficulty Filter */}
                  <div>
                    <label className="text-sm font-medium mb-2 block">Difficulty Level</label>
                    <Select value={selectedDifficulty} onValueChange={setSelectedDifficulty}>
                      <SelectTrigger>
                        <SelectValue placeholder="All Levels" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="all">All Levels</SelectItem>
                        {difficultyLevels.map((level) => (
                          <SelectItem key={level.value} value={level.value}>
                            {level.label}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>

                  {/* Price Range Filter */}
                  <div>
                    <label className="text-sm font-medium mb-2 block">Price Range</label>
                    <Select value={selectedPriceRange} onValueChange={setSelectedPriceRange}>
                      <SelectTrigger>
                        <SelectValue placeholder="All Prices" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="all">All Prices</SelectItem>
                        {priceRanges.map((range) => (
                          <SelectItem key={range.label} value={range.label}>
                            {range.label}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                </div>
              </CardContent>
            </Card>
          )}
        </div>
      </section>

      {/* Courses Grid */}
      <section className="py-12">
        <div className="max-w-7xl mx-auto px-6">
          {isLoading ? (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8">
              {Array.from({ length: 6 }).map((_, i) => (
                <div key={i} className="animate-pulse">
                  <div className="bg-gray-200 rounded-lg h-64"></div>
                </div>
              ))}
            </div>
          ) : filteredAndSortedCourses.length === 0 ? (
            <div className="text-center py-16">
              <div className="mx-auto mb-5 flex h-16 w-16 items-center justify-center rounded-full bg-slate-100 text-slate-400">
                <Search className="h-7 w-7" />
              </div>
              <h3 className="text-2xl font-bold mb-2">No exams found</h3>
              <p className="text-gray-600 mb-6">
                Try adjusting your filters or search terms to find more exams.
              </p>
              <Button onClick={clearFilters} variant="outline">
                Clear Filters
              </Button>
            </div>
          ) : (
            <>
              <div className={`grid gap-8 ${
                viewMode === "grid" 
                  ? "grid-cols-1 md:grid-cols-2 lg:grid-cols-3" 
                  : "grid-cols-1"
              }`}>
                {filteredAndSortedCourses.slice(0, visible).map((course) => (
                  <CourseCard
                    key={course.id}
                    course={course}
                    viewMode={viewMode}
                  />
                ))}
              </div>
              {visible < filteredAndSortedCourses.length && (
                <div className="mt-10 text-center">
                  <Button
                    onClick={() => setVisible((v) => v + 12)}
                    className="bg-slate-900 hover:bg-black text-white rounded-full px-8"
                  >
                    Load more ({filteredAndSortedCourses.length - visible} remaining)
                  </Button>
                </div>
              )}
            </>
          )}
        </div>
      </section>

      <Footer />
    </div>
  );
}
