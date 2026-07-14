import { useEffect } from "react";
import { Link, useLocation } from "wouter";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import DashboardLayout from "@/components/dashboard-layout";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { useAuth } from "@/lib/auth.tsx";
import { apiRequest } from "@/lib/queryClient";
import { SEO } from "@/components/seo";
import { BookOpen, Eye, EyeOff, Plus } from "lucide-react";
import { useToast } from "@/hooks/use-toast";

type Course = {
  id: number;
  title: string;
  slug: string;
  isActive: boolean;
  visibility: "public" | "unlisted" | "private";
  productType: "assessment" | "video_course" | "bundle";
  contentPrice: string | null;
  price: string;
  level: string;
  createdAt: string;
};

function courseState(course: Course) {
  if (course.isActive) return { label: "Live", className: "bg-emerald-100 text-emerald-800" };
  if (course.visibility === "private") return { label: "Draft", className: "bg-slate-100 text-slate-700" };
  return { label: "Submitted", className: "bg-amber-100 text-amber-800" };
}

export default function InstituteCourses() {
  const { user, token, isLoading: authLoading } = useAuth();
  const [, setLocation] = useLocation();
  const queryClient = useQueryClient();
  const { toast } = useToast();

  useEffect(() => {
    if (!authLoading && (!user || !token)) setLocation("/institute/login");
  }, [authLoading, user, token, setLocation]);

  const { data: courses = [], isLoading, error } = useQuery<Course[]>({
    queryKey: ["/api/institute/courses"],
    enabled: !!user && !!token,
    queryFn: async () => {
      const response = await apiRequest("GET", "/api/institute/courses");
      if (!response.ok) throw new Error((await response.json().catch(() => ({}))).message || "Failed to load courses");
      return response.json();
    },
  });
  const { data: institute } = useQuery<{ status: string }>({
    queryKey: ["/api/me/institute"],
    enabled: !!user && !!token,
    queryFn: async () => {
      const response = await apiRequest("GET", "/api/me/institute");
      if (!response.ok) throw new Error("Institute workspace unavailable");
      return response.json();
    },
  });
  const submit = useMutation({
    mutationFn: async (courseId: number) => {
      const response = await apiRequest("PATCH", `/api/institute/courses/${courseId}`, { visibility: "public" });
      if (!response.ok) throw new Error((await response.json().catch(() => ({}))).message || "Course could not be submitted");
      return response.json();
    },
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ["/api/institute/courses"] });
      toast({ title: "Course submitted", description: "It remains unavailable to learners until an Octamy admin approves it." });
    },
    onError: (submitError: Error) => toast({ title: "Submission unavailable", description: submitError.message }),
  });

  if (!user) return null;

  return (
    <DashboardLayout
      role="institute"
      title="Courses"
      description="Build institute-owned video, document, and assessment content. Drafts remain private until submitted and approved."
      breadcrumbs={[{ label: "Institute", href: "/institute/dashboard" }, { label: "Courses" }]}
      actions={(
        <Button onClick={() => setLocation("/institute/courses/new")} className="bg-slate-900 text-white">
          <Plus className="mr-2 h-4 w-4" /> New course
        </Button>
      )}
    >
      <SEO title="Institute courses" description="Manage institute-owned course content." path="/institute/courses" />
      {error ? (
        <Card className="border-amber-200 bg-amber-50/70">
          <CardContent className="p-4 text-sm text-amber-950">Courses could not be loaded. Refresh the page or check your institute membership.</CardContent>
        </Card>
      ) : isLoading ? (
        <div className="space-y-3" aria-label="Loading courses">
          {[1, 2, 3].map((item) => <div key={item} className="h-20 animate-pulse rounded-xl bg-slate-200/70" />)}
        </div>
      ) : courses.length === 0 ? (
        <Card className="border-dashed">
          <CardContent className="py-16 text-center">
            <BookOpen className="mx-auto mb-3 h-9 w-9 text-slate-400" />
            <h2 className="text-lg font-medium text-slate-900">No institute courses yet</h2>
            <p className="mx-auto mt-1 max-w-lg text-sm text-slate-600">
              Start with a private draft, add sections and lessons, then submit it for review when the workspace is verified.
            </p>
            <Button onClick={() => setLocation("/institute/courses/new")} className="mt-5 bg-slate-900 text-white">Create course draft</Button>
          </CardContent>
        </Card>
      ) : (
        <div className="divide-y divide-slate-200 rounded-xl border border-slate-200 bg-white">
          {courses.map((course) => {
            const state = courseState(course);
            return (
              <div key={course.id} className="flex flex-col items-start justify-between gap-4 p-4 hover:bg-slate-50 sm:flex-row sm:items-center">
                <div className="min-w-0">
                  <div className="flex flex-wrap items-center gap-2">
                    <p className="truncate font-medium text-slate-900">{course.title}</p>
                    <Badge className={state.className}>{state.label}</Badge>
                    <Badge variant="outline" className="capitalize">{course.level}</Badge>
                    <Badge variant="outline">{course.productType === "video_course" ? "Video course" : course.productType === "bundle" ? "Course + assessment" : "Assessment"}</Badge>
                  </div>
                  <p className="mt-1 flex items-center gap-1 text-xs text-slate-500">
                    Credential ₹{course.price}{course.productType !== "assessment" ? ` · Access ₹${course.contentPrice ?? "0.00"}` : ""} · {course.visibility === "public" ? <><Eye className="h-3 w-3" /> Public after approval</> : <><EyeOff className="h-3 w-3" /> {course.visibility}</>}
                  </p>
                </div>
                <div className="flex shrink-0 flex-wrap gap-3">
                  <Link href={`/institute/courses/${course.id}/curriculum`} className="text-sm font-medium text-slate-700 hover:underline">Edit curriculum →</Link>
                  {!course.isActive && course.visibility === "private" && institute?.status === "verified" && (
                    <Button size="sm" variant="outline" onClick={() => submit.mutate(course.id)} disabled={submit.isPending}>Submit for review</Button>
                  )}
                  {course.isActive && ["assessment", "bundle"].includes(course.productType) && (
                    <Link href="/institute/exams/new" className="text-sm font-medium text-slate-700 hover:underline">Set up cohort exam →</Link>
                  )}
                  {course.isActive && !["assessment", "bundle"].includes(course.productType) && (
                    <span className="text-xs font-medium text-slate-500">Approved · private learner access</span>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}
    </DashboardLayout>
  );
}
