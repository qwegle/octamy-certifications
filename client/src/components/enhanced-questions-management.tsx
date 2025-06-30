import { useState } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Search, Plus, Edit, Trash2 } from "lucide-react";
import { useQuery } from "@tanstack/react-query";
import { apiRequest } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";

export function EnhancedQuestionsManagement() {
  const [searchTerm, setSearchTerm] = useState("");
  const [selectedCourse, setSelectedCourse] = useState<number | undefined>();
  const { toast } = useToast();

  const { data: questions = [], isLoading: questionsLoading, refetch: refetchQuestions } = useQuery({
    queryKey: ["/api/admin/questions", selectedCourse, searchTerm],
    queryFn: async () => {
      const params = new URLSearchParams();
      if (selectedCourse) params.append('courseId', selectedCourse.toString());
      if (searchTerm) params.append('search', searchTerm);
      const response = await apiRequest("GET", `/api/admin/questions?${params}`);
      return response.json();
    }
  });

  const { data: courses = [] } = useQuery({
    queryKey: ["/api/admin/courses"]
  });

  return (
    <Card className="bg-gray-900 border-gray-800">
      <CardHeader>
        <CardTitle className="text-white">Course Questions Management</CardTitle>
        <CardDescription className="text-gray-400">Manage questions for certification courses</CardDescription>
        <div className="flex items-center space-x-2 mt-4">
          <div className="relative flex-1 max-w-sm">
            <Search className="absolute left-2 top-2.5 h-4 w-4 text-gray-400" />
            <Input
              placeholder="Search questions..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="pl-8 bg-gray-800 border-gray-700 text-white"
            />
          </div>
          <Select value={selectedCourse?.toString() || "all"} onValueChange={(value) => setSelectedCourse(value === "all" ? undefined : parseInt(value))}>
            <SelectTrigger className="w-[300px] bg-gray-800 border-gray-700 text-white">
              <SelectValue placeholder="Select course" />
            </SelectTrigger>
            <SelectContent className="bg-gray-800 border-gray-700">
              <SelectItem value="all">All Courses</SelectItem>
              {courses.map((course: any) => (
                <SelectItem key={course.id} value={course.id.toString()}>
                  {course.title}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Button variant="outline" size="sm" className="bg-white text-black border-gray-300 hover:bg-gray-100">
            <Plus className="h-4 w-4 mr-2" />
            Add Question
          </Button>
        </div>
      </CardHeader>
      <CardContent>
        <div className="rounded-md border border-gray-800">
          <Table>
            <TableHeader>
              <TableRow className="border-gray-800 hover:bg-gray-800">
                <TableHead className="text-gray-300">Question</TableHead>
                <TableHead className="text-gray-300">Course</TableHead>
                <TableHead className="text-gray-300">Difficulty</TableHead>
                <TableHead className="text-gray-300">Status</TableHead>
                <TableHead className="text-gray-300">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {questionsLoading ? (
                <TableRow className="border-gray-800">
                  <TableCell colSpan={5} className="text-center py-8">
                    <div className="animate-spin w-8 h-8 border-4 border-white border-t-transparent rounded-full mx-auto" />
                  </TableCell>
                </TableRow>
              ) : questions.length === 0 ? (
                <TableRow className="border-gray-800">
                  <TableCell colSpan={5} className="text-center py-8 text-gray-400">
                    No questions found
                  </TableCell>
                </TableRow>
              ) : (
                questions.map((question: any) => (
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
                    <TableCell>
                      <div className="flex gap-2">
                        <Button 
                          variant="outline" 
                          size="sm" 
                          className="border-gray-600 text-gray-300"
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
                          size="sm" 
                          className="border-gray-600 text-gray-300"
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
      </CardContent>
    </Card>
  );
}