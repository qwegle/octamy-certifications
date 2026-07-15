import { useState, useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { Link } from "wouter";
import { Search, Filter, Clock, Users, Award, Grid, List, Building, Target, Zap, ShieldCheck, ChevronRight, Calendar, FileCheck2 } from "lucide-react";
import Header from "@/components/header";
import Footer from "@/components/footer";
import type { Course, Category } from "@shared/schema";
import { SEO } from "@/components/seo";

const businessTypes = [
  "Startup",
  "Small Business", 
  "Medium Enterprise",
  "Large Corporation",
  "Non-Profit",
  "Government"
];

const industryFocus = [
  "Technology",
  "Finance",
  "Healthcare", 
  "Manufacturing",
  "Retail",
  "Education",
  "Consulting",
  "Real Estate"
];

const sortOptions = [
  { value: "newest", label: "Recently Added", icon: Award },
  { value: "price-asc", label: "Lowest Price", icon: Target },
  { value: "price-desc", label: "Highest Price", icon: Target },
  { value: "duration-asc", label: "Shortest Duration", icon: Clock },
];

export default function BusinessCertificationsPage() {
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedBusinessType, setSelectedBusinessType] = useState<string>("all");
  const [selectedIndustry, setSelectedIndustry] = useState<string>("all");
  const [selectedPriceRange, setSelectedPriceRange] = useState<string>("all");
  const [sortBy, setSortBy] = useState("newest");
  const [viewMode, setViewMode] = useState<"grid" | "list">("grid");
  const [showFilters, setShowFilters] = useState(false);

  const { data: categories = [] } = useQuery<Category[]>({
    queryKey: ['/api/categories'],
  });

  const { data: courses = [], isLoading } = useQuery<(Course & { category: Category })[]>({
    queryKey: ['/api/courses'],
  });

  // Filter for business courses only
  const businessCourses = courses.filter(course => 
    course.category?.name === "Business" ||
    course.title.toLowerCase().includes("business") ||
    course.description.toLowerCase().includes("business") ||
    course.title.toLowerCase().includes("management") ||
    course.title.toLowerCase().includes("leadership")
  );

  const priceRanges = [
    { label: "Under ₹500", min: 0, max: 499 },
    { label: "₹500 - ₹1,500", min: 500, max: 1499 },
    { label: "₹1,500 - ₹5,000", min: 1500, max: 4999 },
    { label: "₹5,000 - ₹15,000", min: 5000, max: 14999 },
    { label: "Above ₹15,000", min: 15000, max: Infinity },
  ];

  // Filter and sort business certifications
  const filteredAndSortedCertifications = useMemo(() => {
    let filtered = businessCourses.filter(course => {
      // Search filter
      const matchesSearch = course.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
                           course.description.toLowerCase().includes(searchQuery.toLowerCase());

      const businessHaystack = `${course.title} ${course.description}`.toLowerCase();
      const matchesBusinessType = selectedBusinessType === "all" ||
        businessHaystack.includes(selectedBusinessType.toLowerCase());

      // Industry filter (using category or description)
      let matchesIndustry = true;
      if (selectedIndustry !== "all") {
        matchesIndustry = course.description.toLowerCase().includes(selectedIndustry.toLowerCase()) ||
                         course.title.toLowerCase().includes(selectedIndustry.toLowerCase());
      }

      // Price filter
      let matchesPrice = true;
      if (selectedPriceRange !== "all") {
        const priceRange = priceRanges.find(range => range.label === selectedPriceRange);
        if (priceRange) {
          const coursePrice = parseFloat(course.price);
          matchesPrice = coursePrice >= priceRange.min && coursePrice <= priceRange.max;
        }
      }

      return matchesSearch && matchesBusinessType && matchesIndustry && matchesPrice;
    });

    // Sort certifications
    filtered.sort((a, b) => {
      switch (sortBy) {
        case "newest":
          return new Date(b.createdAt || 0).getTime() - new Date(a.createdAt || 0).getTime();
        case "price-asc":
          return parseFloat(a.price) - parseFloat(b.price);
        case "price-desc":
          return parseFloat(b.price) - parseFloat(a.price);
        case "duration-asc":
          return a.duration - b.duration;
        default:
          return 0;
      }
    });

    return filtered;
  }, [businessCourses, searchQuery, selectedBusinessType, selectedIndustry, selectedPriceRange, sortBy]);

  const clearFilters = () => {
    setSearchQuery("");
    setSelectedBusinessType("all");
    setSelectedIndustry("all");
    setSelectedPriceRange("all");
    setSortBy("newest");
  };

  const hasActiveFilters = searchQuery || selectedBusinessType !== "all" || selectedIndustry !== "all" || selectedPriceRange !== "all";

  const BusinessCertificationCard = ({ certification, viewMode }: { certification: Course & { category: Category }, viewMode: "grid" | "list" }) => (
    <Card className={`group hover:shadow-lg transition-all duration-300 border-2 hover:border-black ${
      viewMode === "list" ? "md:flex md:flex-row" : ""
    }`}>
      <div className={`${viewMode === "list" ? "md:w-64 flex-shrink-0" : ""}`}>
        <div className="aspect-video bg-gradient-to-br from-blue-900 to-black rounded-t-lg relative overflow-hidden">
          <div className="absolute inset-0 bg-black bg-opacity-60 flex items-center justify-center">
            <Building className="h-16 w-16 text-white" />
          </div>
          <div className="absolute top-4 left-4">
            <Badge variant="secondary" className="bg-cream-soft text-black font-bold">
              BUSINESS
            </Badge>
          </div>
          <div className="absolute top-4 right-4">
            <Badge variant="outline" className="bg-black text-white border-white">
              Professional
            </Badge>
          </div>
          <div className="absolute bottom-4 left-4">
            <div className="flex items-center gap-2 text-white text-sm">
              <ShieldCheck className="h-4 w-4" />
              Verified Certificate
            </div>
          </div>
        </div>
      </div>
      
      <div className={`${viewMode === "list" ? "flex-1" : ""}`}>
        <CardHeader className="pb-3">
          <div className="flex items-start justify-between gap-2">
            <CardTitle className="text-lg group-hover:text-blue-600 transition-colors">
              {certification.title}
            </CardTitle>
            <div className="flex items-center gap-1 text-slate-500">
              <Target className="h-4 w-4" />
              <span className="text-sm font-medium">Pass {certification.passingScore}%</span>
            </div>
          </div>
          <p className="text-sm text-gray-600 line-clamp-2">
            {certification.description}
          </p>
        </CardHeader>
        
        <CardContent className="pt-0">
          <div className="space-y-4">
            <div className="flex items-center gap-4 text-sm text-gray-600">
              <div className="flex items-center gap-1">
                <Clock className="h-4 w-4" />
                {certification.duration} minutes
              </div>
              <div className="flex items-center gap-1">
                <Users className="h-4 w-4" />
                {certification.level}
              </div>
              <div className="flex items-center gap-1">
                <Calendar className="h-4 w-4" />
                Self-paced
              </div>
            </div>

            {/* Key Benefits */}
            <div className="flex flex-wrap gap-2">
              <Badge variant="outline" className="text-xs">Scored assessment</Badge>
              <Badge variant="outline" className="text-xs">QR verifiable</Badge>
              <Badge variant="outline" className="text-xs">Pay after passing</Badge>
            </div>
            
            <div className="flex items-center justify-between">
              <div className="space-y-1">
                <div className="text-2xl font-bold text-black">
                  ₹{certification.price}
                </div>
                <div className="text-xs text-gray-500">
                  One-time payment
                </div>
              </div>
              <Link href={certification.slug ? `/get-certified/${certification.slug}` : "/get-certified"}>
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
        title="Business skill assessments"
        description="Free-to-attempt business assessments with scored results and optional QR-verifiable credentials after passing."
        path="/business-certifications"
      />
      <Header />
      
      {/* Hero Section */}
      <section className="relative overflow-hidden bg-slate-950 py-14 text-white sm:py-20">
        <div aria-hidden className="absolute inset-0 bg-grid-white opacity-25 [mask-image:radial-gradient(ellipse_at_top,black_20%,transparent_75%)]" />
        <div aria-hidden className="absolute -top-32 left-1/2 h-80 w-[620px] -translate-x-1/2 rounded-full bg-sky-500/20 blur-3xl" />
        <div className="relative max-w-5xl mx-auto px-5 text-center">
          <p className="inline-flex items-center gap-2 rounded-full border border-white/15 bg-white/5 px-3 py-1.5 text-[10px] font-bold uppercase tracking-[0.2em] text-sky-200">
            <FileCheck2 className="h-3.5 w-3.5" /> Business skill evidence
          </p>
          <h1 className="mx-auto mt-5 max-w-4xl break-words text-4xl font-extrabold leading-[1.02] tracking-[-0.04em] sm:text-5xl md:text-6xl">
            Validate business judgement with <span className="text-sky-300">scored assessments</span>
          </h1>
          <p className="mx-auto mt-5 max-w-2xl text-base leading-7 text-slate-300 sm:text-lg">
            Assess leadership, strategy and operational skills for free. If you pass, choose whether to activate a QR-verifiable credential.
          </p>
          <div className="mt-7 flex flex-wrap items-center justify-center gap-x-5 gap-y-2 text-xs font-medium text-slate-300 sm:text-sm">
            <span className="inline-flex items-center gap-2"><Target className="h-4 w-4 text-sky-300" />Free to attempt</span>
            <span className="inline-flex items-center gap-2"><ShieldCheck className="h-4 w-4 text-sky-300" />Pay only after passing</span>
            <span className="inline-flex items-center gap-2"><FileCheck2 className="h-4 w-4 text-sky-300" />Public verification record</span>
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
              placeholder="Search business certifications, skills, or topics..."
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
              <SelectTrigger className="w-full sm:w-48">
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

            <div className="flex w-full items-center justify-between gap-2 sm:ml-auto sm:w-auto sm:justify-start">
              <span className="text-sm text-gray-600">{filteredAndSortedCertifications.length} certifications</span>
              <Separator orientation="vertical" className="h-6" />
              <Button
                variant={viewMode === "grid" ? "default" : "outline"}
                size="sm"
                onClick={() => setViewMode("grid")}
                aria-label="Show certifications as a grid"
                aria-pressed={viewMode === "grid"}
              >
                <Grid className="h-4 w-4" />
              </Button>
              <Button
                variant={viewMode === "list" ? "default" : "outline"}
                size="sm"
                onClick={() => setViewMode("list")}
                aria-label="Show certifications as a list"
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
                  Filter Business Certifications
                  {hasActiveFilters && (
                    <Button variant="outline" size="sm" onClick={clearFilters}>
                      Clear All
                    </Button>
                  )}
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
                  {/* Business Type Filter */}
                  <div>
                    <label className="text-sm font-medium mb-2 block">Business Type</label>
                    <Select value={selectedBusinessType} onValueChange={setSelectedBusinessType}>
                      <SelectTrigger>
                        <SelectValue placeholder="All Types" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="all">All Types</SelectItem>
                        {businessTypes.map((type) => (
                          <SelectItem key={type} value={type}>
                            {type}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>

                  {/* Industry Filter */}
                  <div>
                    <label className="text-sm font-medium mb-2 block">Industry Focus</label>
                    <Select value={selectedIndustry} onValueChange={setSelectedIndustry}>
                      <SelectTrigger>
                        <SelectValue placeholder="All Industries" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="all">All Industries</SelectItem>
                        {industryFocus.map((industry) => (
                          <SelectItem key={industry} value={industry}>
                            {industry}
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

                  {/* Quick Actions */}
                  <div>
                    <label className="text-sm font-medium mb-2 block">Quick Actions</label>
                    <div className="space-y-2">
                      <Link href="/business-demo">
                        <Button variant="outline" size="sm" className="w-full">
                          View Demo Certificate
                        </Button>
                      </Link>
                    </div>
                  </div>
                </div>
              </CardContent>
            </Card>
          )}
        </div>
      </section>

      {/* Business Value Proposition */}
      <section className="py-12 bg-cream-soft">
        <div className="max-w-7xl mx-auto px-6">
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3 sm:gap-8 mb-12">
            <Card className="text-center border-2 hover:border-black transition-colors">
              <CardContent className="pt-6">
                <div className="bg-black rounded-full w-16 h-16 flex items-center justify-center mx-auto mb-4">
                  <Target className="h-8 w-8 text-white" />
                </div>
                <h3 className="text-base sm:text-xl font-bold mb-2">Strategic judgement</h3>
                <p className="text-gray-600 text-xs sm:text-sm">Test reasoning across realistic leadership decisions.</p>
              </CardContent>
            </Card>
            <Card className="text-center border-2 hover:border-black transition-colors">
              <CardContent className="pt-6">
                <div className="bg-black rounded-full w-16 h-16 flex items-center justify-center mx-auto mb-4">
                  <Zap className="h-8 w-8 text-white" />
                </div>
                <h3 className="text-base sm:text-xl font-bold mb-2">Operational thinking</h3>
                <p className="text-gray-600 text-xs sm:text-sm">Evaluate process, prioritisation and execution skills.</p>
              </CardContent>
            </Card>
            <Card className="text-center border-2 hover:border-black transition-colors">
              <CardContent className="pt-6">
                <div className="bg-black rounded-full w-16 h-16 flex items-center justify-center mx-auto mb-4">
                  <Building className="h-8 w-8 text-white" />
                </div>
                <h3 className="text-base sm:text-xl font-bold mb-2">People management</h3>
                <p className="text-gray-600 text-xs sm:text-sm">Assess communication and team leadership choices.</p>
              </CardContent>
            </Card>
            <Card className="text-center border-2 hover:border-black transition-colors">
              <CardContent className="pt-6">
                <div className="bg-black rounded-full w-16 h-16 flex items-center justify-center mx-auto mb-4">
                  <ShieldCheck className="h-8 w-8 text-white" />
                </div>
                <h3 className="text-base sm:text-xl font-bold mb-2">Verifiable result</h3>
                <p className="text-gray-600 text-xs sm:text-sm">Share a credential ID after passing and activation.</p>
              </CardContent>
            </Card>
          </div>
        </div>
      </section>

      {/* Business Certifications Grid */}
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
          ) : filteredAndSortedCertifications.length === 0 ? (
            <div className="text-center py-16">
              <div className="text-6xl mb-4">🏢</div>
              <h3 className="text-2xl font-bold mb-2">No business certifications found</h3>
              <p className="text-gray-600 mb-6">
                Try adjusting your filters or search terms to find more certifications.
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
              {filteredAndSortedCertifications.map((certification) => (
                <BusinessCertificationCard
                  key={certification.id}
                  certification={certification}
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
