import { useState, useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { Link } from "wouter";
import { Search, Filter, Clock, Award, Grid, List, MapPin, Briefcase, GraduationCap, ChevronRight, FileCheck2 } from "lucide-react";
import Header from "@/components/header";
import Footer from "@/components/footer";
import type { Course, Category } from "@shared/schema";
import { SEO } from "@/components/seo";

const durations = [
  { label: "1-2 weeks", min: 1, max: 2 },
  { label: "3-4 weeks", min: 3, max: 4 },
  { label: "1-2 months", min: 4, max: 8 },
  { label: "3+ months", min: 12, max: Infinity },
];

const sortOptions = [
  { value: "newest", label: "Recently Added", icon: Award },
  { value: "duration-asc", label: "Shortest Duration", icon: Clock },
  { value: "duration-desc", label: "Longest Duration", icon: Clock },
];

const skillLevels = [
  { value: "novice", label: "Entry level" },
  { value: "intermediate", label: "Intermediate" },
  { value: "advanced", label: "Advanced" },
  { value: "expert", label: "Expert" },
];

const formatLevel = (level: string) => level === "novice"
  ? "Entry level"
  : level.charAt(0).toUpperCase() + level.slice(1);

export default function VirtualInternshipsPage() {
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedCategory, setSelectedCategory] = useState<string>("all");
  const [selectedDuration, setSelectedDuration] = useState<string>("all");
  const [selectedSkillLevel, setSelectedSkillLevel] = useState<string>("all");
  const [sortBy, setSortBy] = useState("newest");
  const [viewMode, setViewMode] = useState<"grid" | "list">("grid");
  const [showFilters, setShowFilters] = useState(false);

  const { data: categories = [] } = useQuery<Category[]>({
    queryKey: ['/api/categories'],
  });

  const { data: courses = [], isLoading } = useQuery<(Course & { category: Category })[]>({
    queryKey: ['/api/courses'],
  });

  // Filter for internship courses only
  const internshipCourses = courses.filter(course => 
    course.category?.name === "Internships" ||
    course.title.toLowerCase().includes("internship") ||
    course.description?.toLowerCase().includes("internship")
  );

  // Filter and sort internships
  const filteredAndSortedInternships = useMemo(() => {
    let filtered = internshipCourses.filter(course => {
      // Search filter
      const matchesSearch = course.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
                           course.description.toLowerCase().includes(searchQuery.toLowerCase()) ||
                           course.category.name.toLowerCase().includes(searchQuery.toLowerCase());

      // Category filter (for internship subcategories)
      const matchesCategory = selectedCategory === "all" || course.category.name === selectedCategory;

      // Duration filter
      let matchesDuration = true;
      if (selectedDuration !== "all") {
        const durationRange = durations.find(d => d.label === selectedDuration);
        if (durationRange) {
          const courseDurationWeeks = Math.ceil(course.duration / 7); // Convert days to weeks
          matchesDuration = courseDurationWeeks >= durationRange.min && courseDurationWeeks <= durationRange.max;
        }
      }

      // Skill level filter
      const matchesSkillLevel = selectedSkillLevel === "all" || course.level === selectedSkillLevel;

      return matchesSearch && matchesCategory && matchesDuration && matchesSkillLevel;
    });

    // Sort internships
    filtered.sort((a, b) => {
      switch (sortBy) {
        case "newest":
          return new Date(b.createdAt || 0).getTime() - new Date(a.createdAt || 0).getTime();
        case "duration-asc":
          return a.duration - b.duration;
        case "duration-desc":
          return b.duration - a.duration;
        default:
          return 0;
      }
    });

    return filtered;
  }, [internshipCourses, searchQuery, selectedCategory, selectedDuration, selectedSkillLevel, sortBy]);

  const clearFilters = () => {
    setSearchQuery("");
    setSelectedCategory("all");
    setSelectedDuration("all");
    setSelectedSkillLevel("all");
    setSortBy("newest");
  };

  const hasActiveFilters = searchQuery || selectedCategory !== "all" || selectedDuration !== "all" || selectedSkillLevel !== "all";

  const InternshipCard = ({ internship, viewMode }: { internship: Course & { category: Category }, viewMode: "grid" | "list" }) => (
    <Card className={`group hover:shadow-lg transition-all duration-300 border-2 hover:border-black ${
      viewMode === "list" ? "md:flex md:flex-row" : ""
    }`}>
      <div className={`${viewMode === "list" ? "md:w-64 flex-shrink-0" : ""}`}>
        <div className="aspect-video bg-gradient-to-br from-gray-900 to-black rounded-t-lg relative overflow-hidden">
          <div className="absolute inset-0 bg-black bg-opacity-60 flex items-center justify-center">
            <Briefcase className="h-12 w-12 text-white" />
          </div>
          <div className="absolute top-4 left-4">
            <Badge variant="secondary" className="bg-cream-soft text-black font-bold">
              INTERNSHIP
            </Badge>
          </div>
          <div className="absolute top-4 right-4">
            <Badge variant="outline" className="bg-black text-white border-white">
              {Math.ceil(internship.duration / 7)} weeks
            </Badge>
          </div>
        </div>
      </div>
      
      <div className={`${viewMode === "list" ? "flex-1" : ""}`}>
        <CardHeader className="pb-3">
          <div className="flex items-start justify-between gap-2">
            <CardTitle className="text-lg group-hover:text-blue-600 transition-colors">
              {internship.title}
            </CardTitle>
            <Badge variant="outline" className="text-xs">
              {internship.category.name}
            </Badge>
          </div>
          <p className="text-sm text-gray-600 line-clamp-2">
            {internship.description}
          </p>
        </CardHeader>
        
        <CardContent className="pt-0">
          <div className="space-y-3">
            <div className="flex items-center gap-4 text-sm text-gray-600">
              <div className="flex items-center gap-1">
                <Clock className="h-4 w-4" />
                {internship.duration} days
              </div>
              <div className="flex items-center gap-1">
                <GraduationCap className="h-4 w-4" />
                {formatLevel(internship.level)}
              </div>
            </div>
            
            <div className="flex items-center justify-between">
              <div>
                <div className="text-xs text-gray-500">Assessment fee</div>
                <div className="text-2xl font-bold text-black">₹{internship.price}</div>
              </div>
              <Link href={`/exam/${internship.slug || internship.id}`}>
                <Button className="bg-black hover:bg-gray-800 text-white group">
                  View assessment
                  <ChevronRight className="ml-2 h-4 w-4 group-hover:translate-x-1 transition-transform" />
                </Button>
              </Link>
            </div>
          </div>
        </CardContent>
      </div>
    </Card>
  );

  return (
    <div className="min-h-screen bg-cream-soft">
      <SEO
        title="Virtual Internships — Skill Verification Internship Program"
        description="Assessment-based skill programs in Data Analytics, AI, Cloud, Cybersecurity and more. Take a scored assessment and optionally activate a credential after passing. Not employment or supervised work experience."
        path="/virtual-internships"
      />
      <Header />
      
      {/* Hero Section */}
      <section className="bg-black text-white py-16">
        <div className="max-w-7xl mx-auto px-6">
          <div className="text-center">
            <div className="inline-block bg-yellow-500/20 border border-yellow-400/40 text-yellow-100 text-xs uppercase tracking-wider px-3 py-1 rounded-full mb-4">
              Assessment-Based Skill Verification Program
            </div>
            <h1 className="text-5xl md:text-6xl font-bold mb-6">
              SKILL VERIFICATION INTERNSHIP PROGRAMS
            </h1>
            <p className="text-xl text-gray-300 mb-4 max-w-3xl mx-auto">
              Take a free role-relevant assessment and — only if you pass — choose whether to activate a digital credential whose score and current status can be inspected.
            </p>
            <p className="text-sm text-gray-400 max-w-3xl mx-auto mb-8">
              This program is an assessment and skill-certification initiative and does <strong>not</strong> constitute employment, a paid internship, or any guarantee of placement.
            </p>
            <div className="flex items-center justify-center gap-4 text-sm text-gray-400 flex-wrap">
              <div className="flex items-center gap-2">
                <Briefcase className="h-4 w-4" />
                {internshipCourses.length}+ Programs
              </div>
              <div className="flex items-center gap-2">
                <MapPin className="h-4 w-4" />
                100% Remote Assessment
              </div>
              <div className="flex items-center gap-2">
                <Award className="h-4 w-4" />
                Verified Credential on Pass
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Search and Filters */}
      <section className="py-8 bg-cream-deep border-b">
        <div className="max-w-7xl mx-auto px-6">
          {/* Search Bar */}
          <div className="relative mb-6">
            <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 h-5 w-5" />
            <Input
              placeholder="Search assessment programs, skills, or domains..."
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
              <span className="text-sm text-gray-600">{filteredAndSortedInternships.length} programs</span>
              <Separator orientation="vertical" className="h-6" />
              <Button
                variant={viewMode === "grid" ? "default" : "outline"}
                size="sm"
                onClick={() => setViewMode("grid")}
                aria-label="Show programs as a grid"
                aria-pressed={viewMode === "grid"}
              >
                <Grid className="h-4 w-4" />
              </Button>
              <Button
                variant={viewMode === "list" ? "default" : "outline"}
                size="sm"
                onClick={() => setViewMode("list")}
                aria-label="Show programs as a list"
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
                  Filter Internships
                  {hasActiveFilters && (
                    <Button variant="outline" size="sm" onClick={clearFilters}>
                      Clear All
                    </Button>
                  )}
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                  {/* Field Filter */}
                  <div>
                    <label className="text-sm font-medium mb-2 block">Field</label>
                    <Select value={selectedCategory} onValueChange={setSelectedCategory}>
                      <SelectTrigger>
                        <SelectValue placeholder="All Fields" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="all">All Fields</SelectItem>
                        {categories.map((category) => (
                          <SelectItem key={category.id} value={category.name}>
                            {category.name}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>

                  {/* Duration Filter */}
                  <div>
                    <label className="text-sm font-medium mb-2 block">Duration</label>
                    <Select value={selectedDuration} onValueChange={setSelectedDuration}>
                      <SelectTrigger>
                        <SelectValue placeholder="All Durations" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="all">All Durations</SelectItem>
                        {durations.map((duration) => (
                          <SelectItem key={duration.label} value={duration.label}>
                            {duration.label}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>

                  {/* Skill Level Filter */}
                  <div>
                    <label className="text-sm font-medium mb-2 block">Skill Level</label>
                    <Select value={selectedSkillLevel} onValueChange={setSelectedSkillLevel}>
                      <SelectTrigger>
                        <SelectValue placeholder="All Levels" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="all">All Levels</SelectItem>
                        {skillLevels.map((level) => (
                          <SelectItem key={level.value} value={level.value}>
                            {level.label}
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

      {/* Benefits Section */}
      <section className="py-12 bg-cream-soft">
        <div className="max-w-7xl mx-auto px-6">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-8 mb-12">
            <Card className="text-center">
              <CardContent className="pt-6">
                <div className="bg-black rounded-full w-16 h-16 flex items-center justify-center mx-auto mb-4">
                  <Briefcase className="h-8 w-8 text-white" />
                </div>
                <h3 className="text-xl font-bold mb-2">Applied assessments</h3>
                <p className="text-gray-600">Demonstrate practical judgement through role-aligned assessment scenarios.</p>
              </CardContent>
            </Card>
            <Card className="text-center">
              <CardContent className="pt-6">
                <div className="bg-black rounded-full w-16 h-16 flex items-center justify-center mx-auto mb-4">
                  <GraduationCap className="h-8 w-8 text-white" />
                </div>
                <h3 className="text-xl font-bold mb-2">Evidence you control</h3>
                <p className="text-gray-600">Add passed assessments to a portable evidence profile for employers.</p>
              </CardContent>
            </Card>
            <Card className="text-center">
              <CardContent className="pt-6">
                <div className="bg-black rounded-full w-16 h-16 flex items-center justify-center mx-auto mb-4">
                  <FileCheck2 className="h-8 w-8 text-white" />
                </div>
                <h3 className="text-xl font-bold mb-2">Verifiable result</h3>
                <p className="text-gray-600">Successful learners can activate a credential with a public verification record.</p>
              </CardContent>
            </Card>
          </div>
        </div>
      </section>

      {/* Internships Grid */}
      <section className="py-12 bg-cream-deep">
        <div className="max-w-7xl mx-auto px-6">
          {isLoading ? (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8">
              {Array.from({ length: 6 }).map((_, i) => (
                <div key={i} className="animate-pulse">
                  <div className="bg-gray-200 rounded-lg h-80"></div>
                </div>
              ))}
            </div>
          ) : filteredAndSortedInternships.length === 0 ? (
            <div className="text-center py-16">
              <div className="text-6xl mb-4">💼</div>
              <h3 className="text-2xl font-bold mb-2">No internships found</h3>
              <p className="text-gray-600 mb-6">
                Try adjusting your filters or search terms to find more programs.
              </p>
              <Button onClick={clearFilters} variant="outline">
                Clear Filters
              </Button>
            </div>
          ) : (
            <div className={`grid gap-8 ${
              viewMode === "grid" 
                ? "grid-cols-1 md:grid-cols-2 lg:grid-cols-3" 
                : "grid-cols-1"
            }`}>
              {filteredAndSortedInternships.map((internship) => (
                <InternshipCard
                  key={internship.id}
                  internship={internship}
                  viewMode={viewMode}
                />
              ))}
            </div>
          )}
        </div>
      </section>

      <Footer />
    </div>
  );
}
