import { useState } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from "@/components/ui/alert-dialog";
import { Search, Plus, Edit, Trash2, Upload, Download, CheckCircle, XCircle } from "lucide-react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";

interface QuestionFormData {
  courseId: number;
  question: string;
  options: string[];
  correctAnswer: number;
  difficulty: "beginner" | "intermediate" | "advanced";
  subject?: string;
  explanation?: string;
  tags?: string;
  isActive: boolean;
}

export function EnhancedQuestionsManagement() {
  const [searchTerm, setSearchTerm] = useState("");
  const [selectedCourse, setSelectedCourse] = useState<number | undefined>();
  const [isAddDialogOpen, setIsAddDialogOpen] = useState(false);
  const [editingQuestion, setEditingQuestion] = useState<any>(null);
  const [deleteQuestionId, setDeleteQuestionId] = useState<number | null>(null);
  const [uploadFile, setUploadFile] = useState<File | null>(null);
  const { toast } = useToast();

  // Form state for manual entry
  const [formData, setFormData] = useState<QuestionFormData>({
    courseId: 0,
    question: "",
    options: ["", "", "", ""],
    correctAnswer: 0,
    difficulty: "beginner",
    subject: "",
    explanation: "",
    tags: "",
    isActive: true,
  });

  const { data: questions = [], isLoading: questionsLoading } = useQuery({
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
    queryKey: ["/api/admin/courses"],
    queryFn: async () => {
      const response = await apiRequest("GET", "/api/admin/courses");
      return response.json();
    }
  });

  // Add question mutation
  const addQuestionMutation = useMutation({
    mutationFn: async (data: QuestionFormData) => {
      const response = await apiRequest("POST", "/api/admin/questions", {
        ...data,
        tags: data.tags ? data.tags.split(',').map(t => t.trim()) : [],
      });
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/admin/questions"] });
      toast({ title: "Success", description: "Question added successfully" });
      setIsAddDialogOpen(false);
      resetForm();
    },
    onError: () => {
      toast({ title: "Error", description: "Failed to add question", variant: "destructive" });
    }
  });

  // Update question mutation
  const updateQuestionMutation = useMutation({
    mutationFn: async ({ id, data }: { id: number; data: Partial<QuestionFormData> }) => {
      const response = await apiRequest("PUT", `/api/admin/questions/${id}`, {
        ...data,
        tags: data.tags ? (typeof data.tags === 'string' ? data.tags.split(',').map(t => t.trim()) : data.tags) : undefined,
      });
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/admin/questions"] });
      toast({ title: "Success", description: "Question updated successfully" });
      setEditingQuestion(null);
      resetForm();
    },
    onError: () => {
      toast({ title: "Error", description: "Failed to update question", variant: "destructive" });
    }
  });

  // Delete question mutation
  const deleteQuestionMutation = useMutation({
    mutationFn: async (id: number) => {
      await apiRequest("DELETE", `/api/admin/questions/${id}`);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/admin/questions"] });
      toast({ title: "Success", description: "Question deleted successfully" });
      setDeleteQuestionId(null);
    },
    onError: () => {
      toast({ title: "Error", description: "Failed to delete question", variant: "destructive" });
    }
  });

  // Bulk import mutation
  const bulkImportMutation = useMutation({
    mutationFn: async (file: File) => {
      const uploadFormData = new FormData();
      uploadFormData.append('file', file);
      
      // Use fetch with credentials for file upload (FormData not supported by apiRequest)
      const response = await fetch('/api/admin/questions/bulk-import', {
        method: 'POST',
        body: uploadFormData,
        credentials: 'include',
      });
      if (!response.ok) {
        const error = await response.json().catch(() => ({ message: 'Upload failed' }));
        throw new Error(error.message || 'Upload failed');
      }
      return response.json();
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ["/api/admin/questions"] });
      toast({
        title: "Import Complete",
        description: `Successfully imported ${data.imported} questions. ${data.failed} failed.`,
      });
      setUploadFile(null);
    },
    onError: () => {
      toast({ title: "Error", description: "Failed to import questions", variant: "destructive" });
    }
  });

  const resetForm = () => {
    setFormData({
      courseId: 0,
      question: "",
      options: ["", "", "", ""],
      correctAnswer: 0,
      difficulty: "beginner",
      subject: "",
      explanation: "",
      tags: "",
      isActive: true,
    });
  };

  const handleEdit = (question: any) => {
    setEditingQuestion(question);
    setFormData({
      courseId: question.courseId,
      question: question.question,
      options: question.options || ["", "", "", ""],
      correctAnswer: question.correctAnswer || 0,
      difficulty: question.difficulty || "beginner",
      subject: question.subject || "",
      explanation: question.explanation || "",
      tags: Array.isArray(question.tags) ? question.tags.join(', ') : "",
      isActive: question.isActive ?? true,
    });
  };

  const handleSubmit = () => {
    // Enhanced validation
    if (!formData.courseId || formData.courseId === 0) {
      toast({ title: "Validation Error", description: "Please select a course", variant: "destructive" });
      return;
    }
    if (!formData.question.trim()) {
      toast({ title: "Validation Error", description: "Please enter a question", variant: "destructive" });
      return;
    }
    if (formData.options.length < 2 || formData.options.some(o => !o.trim())) {
      toast({ title: "Validation Error", description: "Please fill all answer options", variant: "destructive" });
      return;
    }
    if (formData.correctAnswer < 0 || formData.correctAnswer >= formData.options.length) {
      toast({ title: "Validation Error", description: "Please select a correct answer", variant: "destructive" });
      return;
    }

    if (editingQuestion) {
      updateQuestionMutation.mutate({ id: editingQuestion.id, data: formData });
    } else {
      addQuestionMutation.mutate(formData);
    }
  };

  const handleFileUpload = () => {
    if (!uploadFile) {
      toast({ title: "Error", description: "Please select a file", variant: "destructive" });
      return;
    }
    bulkImportMutation.mutate(uploadFile);
  };

  const downloadTemplate = async () => {
    try {
      const response = await fetch('/api/admin/questions/template', {
        credentials: 'include',
      });
      const blob = await response.blob();
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = 'questions-template.xlsx';
      document.body.appendChild(a);
      a.click();
      window.URL.revokeObjectURL(url);
      document.body.removeChild(a);
    } catch (error) {
      toast({ title: "Error", description: "Failed to download template", variant: "destructive" });
    }
  };

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
              data-testid="input-search-questions"
            />
          </div>
          <Select value={selectedCourse?.toString() || "all"} onValueChange={(value) => setSelectedCourse(value === "all" ? undefined : parseInt(value))}>
            <SelectTrigger className="w-[300px] bg-gray-800 border-gray-700 text-white" data-testid="select-course-filter">
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
          <Dialog open={isAddDialogOpen || editingQuestion !== null} onOpenChange={(open) => {
            if (!open) {
              setIsAddDialogOpen(false);
              setEditingQuestion(null);
              resetForm();
            } else {
              setIsAddDialogOpen(true);
            }
          }}>
            <DialogTrigger asChild>
              <Button variant="outline" size="sm" className="bg-white text-black border-gray-300 hover:bg-gray-100" data-testid="button-add-question">
                <Plus className="h-4 w-4 mr-2" />
                Add Question
              </Button>
            </DialogTrigger>
            <DialogContent className="max-w-3xl max-h-[90vh] overflow-y-auto bg-gray-900 border-gray-700 text-white">
              <DialogHeader>
                <DialogTitle className="text-white">{editingQuestion ? "Edit Question" : "Add New Question"}</DialogTitle>
                <DialogDescription className="text-gray-400">
                  {editingQuestion ? "Update the question details below" : "Enter question details below. You can also upload questions in bulk using Excel/CSV."}
                </DialogDescription>
              </DialogHeader>

              <Tabs defaultValue="manual" className="w-full">
                <TabsList className="grid w-full grid-cols-2 bg-gray-800">
                  <TabsTrigger value="manual" className="data-[state=active]:bg-white data-[state=active]:text-black" data-testid="tab-manual-entry">Manual Entry</TabsTrigger>
                  <TabsTrigger value="bulk" className="data-[state=active]:bg-white data-[state=active]:text-black" disabled={editingQuestion !== null} data-testid="tab-bulk-upload">Bulk Upload</TabsTrigger>
                </TabsList>

                <TabsContent value="manual" className="space-y-4 mt-4">
                  <div className="grid gap-4">
                    <div>
                      <Label htmlFor="course" className="text-white">Course *</Label>
                      <Select 
                        value={formData.courseId > 0 ? formData.courseId.toString() : ""} 
                        onValueChange={(value) => setFormData({ ...formData, courseId: parseInt(value) })}
                      >
                        <SelectTrigger className="bg-gray-800 border-gray-700 text-white" data-testid="select-course">
                          <SelectValue placeholder="Select course" />
                        </SelectTrigger>
                        <SelectContent className="bg-gray-800 border-gray-700">
                          {courses.map((course: any) => (
                            <SelectItem key={course.id} value={course.id.toString()}>
                              {course.title}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>

                    <div>
                      <Label htmlFor="question" className="text-white">Question *</Label>
                      <Textarea
                        id="question"
                        value={formData.question}
                        onChange={(e) => setFormData({ ...formData, question: e.target.value })}
                        placeholder="Enter the question"
                        className="bg-gray-800 border-gray-700 text-white"
                        rows={3}
                        data-testid="textarea-question"
                      />
                    </div>

                    <div>
                      <Label className="text-white">Answer Options * (Mark correct answer)</Label>
                      <div className="space-y-2 mt-2">
                        {formData.options.map((option, index) => (
                          <div key={index} className="flex gap-2 items-center">
                            <input
                              type="radio"
                              checked={formData.correctAnswer === index}
                              onChange={() => setFormData({ ...formData, correctAnswer: index })}
                              className="w-4 h-4"
                              data-testid={`radio-option-${index}`}
                            />
                            <Input
                              value={option}
                              onChange={(e) => {
                                const newOptions = [...formData.options];
                                newOptions[index] = e.target.value;
                                setFormData({ ...formData, options: newOptions });
                              }}
                              placeholder={`Option ${index + 1}`}
                              className="bg-gray-800 border-gray-700 text-white"
                              data-testid={`input-option-${index}`}
                            />
                          </div>
                        ))}
                      </div>
                    </div>

                    <div className="grid grid-cols-2 gap-4">
                      <div>
                        <Label htmlFor="difficulty" className="text-white">Difficulty *</Label>
                        <Select value={formData.difficulty} onValueChange={(value: any) => setFormData({ ...formData, difficulty: value })}>
                          <SelectTrigger className="bg-gray-800 border-gray-700 text-white" data-testid="select-difficulty">
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent className="bg-gray-800 border-gray-700">
                            <SelectItem value="beginner">Beginner</SelectItem>
                            <SelectItem value="intermediate">Intermediate</SelectItem>
                            <SelectItem value="advanced">Advanced</SelectItem>
                          </SelectContent>
                        </Select>
                      </div>

                      <div>
                        <Label htmlFor="subject" className="text-white">Subject</Label>
                        <Input
                          id="subject"
                          value={formData.subject}
                          onChange={(e) => setFormData({ ...formData, subject: e.target.value })}
                          placeholder="e.g., Mathematics, Physics"
                          className="bg-gray-800 border-gray-700 text-white"
                          data-testid="input-subject"
                        />
                      </div>
                    </div>

                    <div>
                      <Label htmlFor="explanation" className="text-white">Explanation</Label>
                      <Textarea
                        id="explanation"
                        value={formData.explanation}
                        onChange={(e) => setFormData({ ...formData, explanation: e.target.value })}
                        placeholder="Explain the correct answer"
                        className="bg-gray-800 border-gray-700 text-white"
                        rows={3}
                        data-testid="textarea-explanation"
                      />
                    </div>

                    <div>
                      <Label htmlFor="tags" className="text-white">Tags (comma-separated)</Label>
                      <Input
                        id="tags"
                        value={formData.tags}
                        onChange={(e) => setFormData({ ...formData, tags: e.target.value })}
                        placeholder="e.g., algebra, geometry, trigonometry"
                        className="bg-gray-800 border-gray-700 text-white"
                        data-testid="input-tags"
                      />
                    </div>

                    <div className="flex items-center space-x-2">
                      <input
                        type="checkbox"
                        id="isActive"
                        checked={formData.isActive}
                        onChange={(e) => setFormData({ ...formData, isActive: e.target.checked })}
                        className="w-4 h-4"
                        data-testid="checkbox-active"
                      />
                      <Label htmlFor="isActive" className="text-white cursor-pointer">Mark as Active</Label>
                    </div>
                  </div>

                  <div className="flex justify-end gap-2 mt-6">
                    <Button
                      variant="outline"
                      onClick={() => {
                        setIsAddDialogOpen(false);
                        setEditingQuestion(null);
                        resetForm();
                      }}
                      className="bg-gray-800 text-white border-gray-700"
                      data-testid="button-cancel"
                    >
                      Cancel
                    </Button>
                    <Button
                      onClick={handleSubmit}
                      disabled={addQuestionMutation.isPending || updateQuestionMutation.isPending}
                      className="bg-white text-black hover:bg-gray-200"
                      data-testid="button-submit"
                    >
                      {(addQuestionMutation.isPending || updateQuestionMutation.isPending) ? "Saving..." : editingQuestion ? "Update Question" : "Add Question"}
                    </Button>
                  </div>
                </TabsContent>

                <TabsContent value="bulk" className="space-y-4 mt-4">
                  <div className="bg-blue-900/20 border border-blue-700 rounded-md p-4 mb-4">
                    <h4 className="text-white font-semibold mb-2">Bulk Import Instructions</h4>
                    <ul className="text-gray-300 text-sm space-y-1 list-disc list-inside">
                      <li>Download the template Excel file below</li>
                      <li>Fill in your questions following the template format</li>
                      <li>Upload the completed file to import all questions at once</li>
                      <li>Supported formats: .xlsx, .xls, .csv</li>
                    </ul>
                  </div>

                  <Button
                    variant="outline"
                    onClick={downloadTemplate}
                    className="w-full bg-gray-800 text-white border-gray-700 hover:bg-gray-700"
                    data-testid="button-download-template"
                  >
                    <Download className="h-4 w-4 mr-2" />
                    Download Template File
                  </Button>

                  <div className="border-2 border-dashed border-gray-700 rounded-md p-8 text-center">
                    <Upload className="h-12 w-12 text-gray-500 mx-auto mb-4" />
                    <input
                      type="file"
                      accept=".xlsx,.xls,.csv"
                      onChange={(e) => setUploadFile(e.target.files?.[0] || null)}
                      className="hidden"
                      id="file-upload"
                      data-testid="input-file"
                    />
                    <label htmlFor="file-upload" className="cursor-pointer">
                      <Button variant="outline" className="bg-gray-800 text-white border-gray-700" data-testid="button-select-file">
                        Select File
                      </Button>
                    </label>
                    {uploadFile && (
                      <p className="text-white mt-2">Selected: {uploadFile.name}</p>
                    )}
                  </div>

                  <Button
                    onClick={handleFileUpload}
                    disabled={!uploadFile || bulkImportMutation.isPending}
                    className="w-full bg-white text-black hover:bg-gray-200"
                    data-testid="button-upload"
                  >
                    {bulkImportMutation.isPending ? "Uploading..." : "Upload Questions"}
                  </Button>
                </TabsContent>
              </Tabs>
            </DialogContent>
          </Dialog>
        </div>
      </CardHeader>
      <CardContent>
        <div className="rounded-md border border-gray-800">
          <Table>
            <TableHeader>
              <TableRow className="border-gray-800 hover:bg-gray-800">
                <TableHead className="text-gray-300">Question</TableHead>
                <TableHead className="text-gray-300">Course</TableHead>
                <TableHead className="text-gray-300">Subject</TableHead>
                <TableHead className="text-gray-300">Difficulty</TableHead>
                <TableHead className="text-gray-300">Status</TableHead>
                <TableHead className="text-gray-300">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {questionsLoading ? (
                <TableRow className="border-gray-800">
                  <TableCell colSpan={6} className="text-center py-8">
                    <div className="animate-spin w-8 h-8 border-4 border-white border-t-transparent rounded-full mx-auto" />
                  </TableCell>
                </TableRow>
              ) : questions.length === 0 ? (
                <TableRow className="border-gray-800">
                  <TableCell colSpan={6} className="text-center py-8 text-gray-400">
                    No questions found
                  </TableCell>
                </TableRow>
              ) : (
                questions.map((question: any) => (
                  <TableRow key={question.id} className="border-gray-800 hover:bg-gray-800" data-testid={`row-question-${question.id}`}>
                    <TableCell className="text-white max-w-md">
                      <div className="truncate" title={question.question}>
                        {question.question}
                      </div>
                      <div className="text-sm text-gray-400 flex items-center gap-2 mt-1">
                        <span>{question.options?.length || 0} options</span>
                        {question.correctAnswer !== undefined && (
                          <span className="flex items-center gap-1">
                            <CheckCircle className="w-3 h-3 text-green-500" />
                            Option {question.correctAnswer + 1}
                          </span>
                        )}
                      </div>
                    </TableCell>
                    <TableCell>
                      <Badge variant="outline" className="border-gray-600 text-gray-300">
                        {courses.find((c: any) => c.id === question.courseId)?.title || "Unknown"}
                      </Badge>
                    </TableCell>
                    <TableCell className="text-gray-300">
                      {question.subject || "-"}
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
                          className="border-gray-600 text-gray-300 hover:bg-gray-700"
                          onClick={() => handleEdit(question)}
                          data-testid={`button-edit-${question.id}`}
                        >
                          <Edit className="h-4 w-4" />
                        </Button>
                        <Button 
                          variant="outline" 
                          size="sm" 
                          className="border-gray-600 text-red-400 hover:bg-red-900/20"
                          onClick={() => setDeleteQuestionId(question.id)}
                          data-testid={`button-delete-${question.id}`}
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

      {/* Delete Confirmation Dialog */}
      <AlertDialog open={deleteQuestionId !== null} onOpenChange={() => setDeleteQuestionId(null)}>
        <AlertDialogContent className="bg-gray-900 border-gray-700">
          <AlertDialogHeader>
            <AlertDialogTitle className="text-white">Are you sure?</AlertDialogTitle>
            <AlertDialogDescription className="text-gray-400">
              This action cannot be undone. This will permanently delete the question from the database.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel className="bg-gray-800 text-white border-gray-700" data-testid="button-cancel-delete">
              Cancel
            </AlertDialogCancel>
            <AlertDialogAction
              onClick={() => deleteQuestionId && deleteQuestionMutation.mutate(deleteQuestionId)}
              className="bg-red-600 text-white hover:bg-red-700"
              data-testid="button-confirm-delete"
            >
              Delete
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </Card>
  );
}
