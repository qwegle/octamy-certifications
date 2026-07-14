import { useState } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Search, Plus, Edit, Trash2, AlertCircle } from "lucide-react";
import { useQuery } from "@tanstack/react-query";
import { apiRequest } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";

interface AdminCourseSummary {
  id: number;
  title: string;
}

interface AdminQuestion {
  id: number;
  courseId: number;
  question: string;
  options?: unknown[];
  difficulty?: string | null;
  isActive?: boolean | null;
  course?: AdminCourseSummary | null;
}

export function EnhancedQuestionsManagement() {
  const [searchTerm, setSearchTerm] = useState("");
  const [selectedCourse, setSelectedCourse] = useState<number | undefined>();
  const { toast } = useToast();

  const questionsQuery = useQuery<AdminQuestion[]>({
    queryKey: ["/api/admin/questions", selectedCourse, searchTerm],
    queryFn: async () => {
      const params = new URLSearchParams();
      if (selectedCourse) params.append('courseId', selectedCourse.toString());
      if (searchTerm) params.append('search', searchTerm);
      const response = await apiRequest("GET", `/api/admin/questions?${params}`);
      if (!response.ok) {
        throw new Error((await response.json().catch(() => ({}))).message || "Questions could not be loaded");
      }
      return response.json() as Promise<AdminQuestion[]>;
    }
  });

  const coursesQuery = useQuery<AdminCourseSummary[]>({
    queryKey: ["/api/admin/courses"],
    queryFn: async () => {
      const response = await apiRequest("GET", "/api/admin/courses");
      if (!response.ok) {
        throw new Error((await response.json().catch(() => ({}))).message || "Courses could not be loaded");
      }
      return response.json() as Promise<AdminCourseSummary[]>;
    },
  });
  const questions = questionsQuery.data ?? [];
  const courses = coursesQuery.data ?? [];

  return (
    <Card className="bg-gray-900 border-gray-800">
      <CardHeader>
        <CardTitle className="text-white">Course Questions Management</CardTitle>
        <CardDescription className="text-gray-400">Manage questions for certification courses</CardDescription>
        <div className="mt-4 grid gap-3 sm:grid-cols-2 xl:grid-cols-[minmax(16rem,1fr)_18rem_auto]">
          <div className="relative min-w-0">
            <Label htmlFor="admin-question-search" className="sr-only">Search course questions</Label>
            <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-gray-400" aria-hidden="true" />
            <Input
              id="admin-question-search"
              type="search"
              aria-label="Search course questions"
              placeholder="Search questions..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-full bg-gray-800 pl-9 text-white placeholder:text-gray-400"
            />
          </div>
          <div className="min-w-0">
            <Label htmlFor="admin-question-course" className="sr-only">Filter questions by course</Label>
            <Select value={selectedCourse?.toString() || "all"} onValueChange={(value) => setSelectedCourse(value === "all" ? undefined : Number(value))} disabled={coursesQuery.isLoading || coursesQuery.isError}>
            <SelectTrigger id="admin-question-course" className="w-full bg-gray-800 border-gray-700 text-white" aria-label="Filter questions by course">
              <SelectValue placeholder="Select course" />
            </SelectTrigger>
            <SelectContent className="bg-gray-800 border-gray-700">
              <SelectItem value="all">All Courses</SelectItem>
              {courses.map((course) => (
                <SelectItem key={course.id} value={course.id.toString()}>
                  {course.title}
                </SelectItem>
              ))}
            </SelectContent>
            </Select>
          </div>
          <Button
            variant="outline"
            className="w-full bg-white text-black border-gray-300 hover:bg-gray-100 sm:col-span-2 xl:col-span-1 xl:w-auto"
            onClick={() => {
              toast({
                title: "Open the question editor",
                description: "Use the standard admin Questions workspace to add a course question with its answers and scoring.",
              });
            }}
          >
            <Plus className="h-4 w-4 mr-2" />
            Add Question
          </Button>
        </div>
        {coursesQuery.isError && (
          <p role="alert" className="mt-3 rounded-lg border border-amber-700/50 bg-amber-950/40 p-3 text-sm text-amber-100">
            The course filter is temporarily unavailable. Questions can still be searched.
          </p>
        )}
      </CardHeader>
      <CardContent>
        {questionsQuery.isError ? (
          <div role="alert" aria-live="assertive" className="rounded-lg border border-amber-700/50 bg-amber-950/30 px-6 py-10 text-center">
            <AlertCircle className="mx-auto mb-3 h-9 w-9 text-amber-300" aria-hidden="true" />
            <h3 className="font-semibold text-white">Questions could not be loaded</h3>
            <p className="mx-auto mt-1 max-w-md text-sm text-gray-300">
              {questionsQuery.error instanceof Error ? questionsQuery.error.message : "Check your connection and try again."}
            </p>
            <Button variant="outline" className="mt-4 bg-white text-slate-900" onClick={() => questionsQuery.refetch()}>
              Try again
            </Button>
          </div>
        ) : (
        <div
          className="overflow-x-auto rounded-md border border-gray-800 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white"
          role="region"
          aria-label="Course questions table"
          tabIndex={0}
        >
          <Table className="min-w-[760px]">
            <TableHeader>
              <TableRow className="border-gray-800 hover:bg-gray-800">
                <TableHead className="text-gray-300">Question</TableHead>
                <TableHead className="text-gray-300">Course</TableHead>
                <TableHead className="text-gray-300">Difficulty</TableHead>
                <TableHead className="text-gray-300">Status</TableHead>
                <TableHead className="text-right text-gray-300">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {questionsQuery.isLoading ? (
                <TableRow className="border-gray-800">
                  <TableCell colSpan={5} className="text-center py-10">
                    <div role="status" aria-live="polite" className="text-sm text-gray-300">
                      <span className="mx-auto mb-3 block h-8 w-8 animate-spin rounded-full border-2 border-gray-600 border-t-white" aria-hidden="true" />
                      Loading questions…
                    </div>
                  </TableCell>
                </TableRow>
              ) : questions.length === 0 ? (
                <TableRow className="border-gray-800">
                  <TableCell colSpan={5} className="text-center py-8 text-gray-400">
                    <p>{searchTerm || selectedCourse ? "No questions match the current filters." : "No course questions have been added yet."}</p>
                    {(searchTerm || selectedCourse) && (
                      <Button
                        variant="outline"
                        className="mt-3 border-gray-600 bg-gray-800 text-white hover:bg-gray-700"
                        onClick={() => { setSearchTerm(""); setSelectedCourse(undefined); }}
                      >
                        Clear filters
                      </Button>
                    )}
                  </TableCell>
                </TableRow>
              ) : (
                questions.map((question) => (
                  <TableRow key={question.id} className="border-gray-800 hover:bg-gray-800">
                    <TableCell className="text-white max-w-md">
                      <div className="truncate" title={question.question}>
                        {question.question}
                      </div>
                      <div className="text-sm text-gray-400">
                        {question.options?.length} options
                      </div>
                    </TableCell>
                    <TableCell>
                      <Badge variant="outline" className="border-gray-600 text-gray-300">
                        {question.course?.title || courses.find(c => c.id === question.courseId)?.title || "No Course"}
                      </Badge>
                    </TableCell>
                    <TableCell>
                      <Badge variant={
                        question.difficulty === 'advanced' ? 'destructive' : 
                        question.difficulty === 'intermediate' ? 'default' : 'secondary'
                      } className={
                        question.difficulty === 'advanced' ? "bg-red-600" : 
                        question.difficulty === 'intermediate' ? "bg-blue-600" : "bg-gray-600"
                      }>
                        {question.difficulty || 'beginner'}
                      </Badge>
                    </TableCell>
                    <TableCell>
                      <Badge variant={question.isActive ? 'default' : 'secondary'} className={question.isActive ? "bg-green-600" : "bg-gray-600"}>
                        {question.isActive ? 'Active' : 'Inactive'}
                      </Badge>
                    </TableCell>
                    <TableCell className="text-right">
                      <div className="flex justify-end gap-2">
                        <Button 
                          variant="outline" 
                          size="icon"
                          className="border-gray-600 text-gray-300"
                          aria-label={`Edit question: ${question.question}`}
                          title="Edit question"
                          onClick={() => {
                            toast({
                              title: "Edit Question",
                              description: `Editing: ${question.question.substring(0, 50)}...`,
                            });
                          }}
                        >
                          <Edit className="h-4 w-4" />
                        </Button>
                        <Button 
                          variant="outline" 
                          size="icon"
                          className="border-gray-600 text-gray-300"
                          aria-label={`Delete question: ${question.question}`}
                          title="Delete question"
                          onClick={() => {
                            toast({
                              title: "Delete Question",
                              description: "Question deletion functionality",
                            });
                          }}
                        >
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      </div>
                    </TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
        </div>
        )}
      </CardContent>
    </Card>
  );
}
