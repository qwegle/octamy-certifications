import { useState, useEffect } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger } from "@/components/ui/alert-dialog";
import { Form, FormControl, FormDescription, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { useToast } from "@/hooks/use-toast";
import { useMutation, useQuery } from "@tanstack/react-query";
import { queryClient, apiRequest } from "@/lib/queryClient";
import { useLocation } from "wouter";
import { useAuth } from "@/lib/auth.tsx";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";

import { 
  Shield, 
  Users, 
  DollarSign, 
  TrendingUp, 
  Eye, 
  Check, 
  X, 
  BookOpen, 
  GraduationCap, 
  BarChart3, 
  UserCheck, 
  Download, 
  Plus, 
  Edit, 
  Trash2,
  LogOut,
  MousePointer,
  Award
} from "lucide-react";

// Question Management Components
function QuestionsManagement() {
  const [searchTerm, setSearchTerm] = useState("");
  const [selectedCourse, setSelectedCourse] = useState<number | undefined>();
  const [editingQuestion, setEditingQuestion] = useState<any>(null);
  const [showEditDialog, setShowEditDialog] = useState(false);
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

  const deleteQuestion = useMutation({
    mutationFn: async (questionId: number) => {
      const response = await apiRequest("DELETE", `/api/admin/questions/${questionId}`);
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/admin/questions"] });
      toast({
        title: "Question Deleted",
        description: "Question has been deleted successfully.",
      });
    },
    onError: (error: any) => {
      toast({
        title: "Error",
        description: error.message || "Failed to delete question",
        variant: "destructive",
      });
    },
  });

  return (
    <Card>
      <CardHeader>
        <CardTitle>Course Questions Management</CardTitle>
        <CardDescription>Manage questions for certification courses</CardDescription>
      </CardHeader>
      <CardContent>
        <div className="space-y-4">
          <div className="flex gap-4 items-center">
            <Input
              placeholder="Search questions..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="max-w-sm"
            />
            <Select value={selectedCourse?.toString() || "all"} onValueChange={(value) => setSelectedCourse(value === "all" ? undefined : parseInt(value))}>
              <SelectTrigger className="w-[200px]">
                <SelectValue placeholder="Filter by course" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Courses</SelectItem>
                {courses.map((course: any) => (
                  <SelectItem key={course.id} value={course.id.toString()}>
                    {course.title}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <Dialog>
              <DialogTrigger asChild>
                <Button>
                  <Plus className="h-4 w-4 mr-2" />
                  Add Question
                </Button>
              </DialogTrigger>
              <DialogContent className="max-w-2xl">
                <DialogHeader>
                  <DialogTitle>Add New Question</DialogTitle>
                </DialogHeader>
                <AddQuestionForm 
                  courses={courses} 
                  onSuccess={() => {
                    refetchQuestions();
                    toast({ title: "Success", description: "Question added successfully" });
                  }} 
                />
              </DialogContent>
            </Dialog>
          </div>

          {questionsLoading ? (
            <div className="flex justify-center py-8">
              <div className="animate-spin w-8 h-8 border-4 border-primary border-t-transparent rounded-full" />
            </div>
          ) : (
            <div className="border rounded-lg">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Question</TableHead>
                    <TableHead>Course</TableHead>
                    <TableHead>Difficulty</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead>Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {questions.map((question: any) => (
                    <TableRow key={question.id}>
                      <TableCell>
                        <div className="max-w-md">
                          <p className="font-medium truncate">{question.question}</p>
                          <p className="text-sm text-muted-foreground">
                            {question.options?.length} options
                          </p>
                        </div>
                      </TableCell>
                      <TableCell>
                        <Badge variant="outline">
                          {question.course?.title || courses.find(c => c.id === question.courseId)?.title || "No Course"}
                        </Badge>
                      </TableCell>
                      <TableCell>
                        <Badge variant={question.difficulty === 'hard' ? 'destructive' : question.difficulty === 'medium' ? 'default' : 'secondary'}>
                          {question.difficulty || 'Easy'}
                        </Badge>
                      </TableCell>
                      <TableCell>
                        <Badge variant={question.isActive ? 'default' : 'secondary'}>
                          {question.isActive ? 'Active' : 'Inactive'}
                        </Badge>
                      </TableCell>
                      <TableCell>
                        <div className="flex gap-2">
                          <Button 
                            variant="outline" 
                            size="sm"
                            onClick={() => {
                              setEditingQuestion(question);
                              setShowEditDialog(true);
                            }}
                          >
                            <Edit className="h-4 w-4" />
                          </Button>
                          <AlertDialog>
                            <AlertDialogTrigger asChild>
                              <Button variant="outline" size="sm">
                                <Trash2 className="h-4 w-4" />
                              </Button>
                            </AlertDialogTrigger>
                            <AlertDialogContent>
                              <AlertDialogHeader>
                                <AlertDialogTitle>Delete Question</AlertDialogTitle>
                                <AlertDialogDescription>
                                  Are you sure you want to delete this question? This action cannot be undone.
                                </AlertDialogDescription>
                              </AlertDialogHeader>
                              <AlertDialogFooter>
                                <AlertDialogCancel>Cancel</AlertDialogCancel>
                                <AlertDialogAction onClick={() => deleteQuestion.mutate(question.id)}>
                                  Delete
                                </AlertDialogAction>
                              </AlertDialogFooter>
                            </AlertDialogContent>
                          </AlertDialog>
                        </div>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          )}
        </div>
      </CardContent>

      {/* Edit Question Dialog */}
      <Dialog open={showEditDialog} onOpenChange={setShowEditDialog}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle>Edit Question</DialogTitle>
          </DialogHeader>
          {editingQuestion && (
            <div className="space-y-4">
              <div>
                <label className="text-sm font-medium">Question</label>
                <textarea 
                  className="w-full mt-1 p-2 border rounded-md" 
                  value={editingQuestion.question}
                  onChange={(e) => setEditingQuestion({...editingQuestion, question: e.target.value})}
                  rows={3}
                />
              </div>
              <div>
                <label className="text-sm font-medium">Course</label>
                <p className="text-sm text-muted-foreground">{editingQuestion.course?.title || 'No course assigned'}</p>
              </div>
              <div>
                <label className="text-sm font-medium">Options</label>
                {editingQuestion.options?.map((option: string, index: number) => (
                  <input 
                    key={index}
                    className="w-full mt-1 p-2 border rounded-md" 
                    value={option}
                    onChange={(e) => {
                      const newOptions = [...editingQuestion.options];
                      newOptions[index] = e.target.value;
                      setEditingQuestion({...editingQuestion, options: newOptions});
                    }}
                  />
                ))}
              </div>
              <div className="flex gap-2">
                <label className="text-sm font-medium">Correct Answer:</label>
                <select 
                  value={editingQuestion.correctAnswer}
                  onChange={(e) => setEditingQuestion({...editingQuestion, correctAnswer: parseInt(e.target.value)})}
                  className="px-2 py-1 border rounded"
                >
                  {editingQuestion.options?.map((_: any, index: number) => (
                    <option key={index} value={index}>Option {index + 1}</option>
                  ))}
                </select>
              </div>
              <div className="flex justify-end gap-2">
                <Button variant="outline" onClick={() => setShowEditDialog(false)}>
                  Cancel
                </Button>
                <Button onClick={async () => {
                  try {
                    const response = await apiRequest("PUT", `/api/admin/questions/${editingQuestion.id}`, {
                      question: editingQuestion.question,
                      options: editingQuestion.options,
                      correctAnswer: editingQuestion.correctAnswer
                    });
                    if (response.ok) {
                      toast({
                        title: "Question Updated",
                        description: "Question has been updated successfully.",
                      });
                      setShowEditDialog(false);
                      refetchQuestions();
                    }
                  } catch (error) {
                    toast({
                      title: "Error",
                      description: "Failed to update question",
                      variant: "destructive",
                    });
                  }
                }}>
                  Save Changes
                </Button>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </Card>
  );
}

// Add Question Form Component
function AddQuestionForm({ courses, onSuccess }: { courses: any[], onSuccess: () => void }) {
  const [formData, setFormData] = useState({
    courseId: '',
    question: '',
    options: ['', '', '', ''],
    correctAnswer: 0,
    difficulty: 'intermediate',
    isActive: true
  });
  const { toast } = useToast();

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      const response = await apiRequest("POST", "/api/admin/questions", {
        ...formData,
        courseId: parseInt(formData.courseId),
        options: formData.options.filter(opt => opt.trim() !== '')
      });
      if (response.ok) {
        onSuccess();
        setFormData({
          courseId: '',
          question: '',
          options: ['', '', '', ''],
          correctAnswer: 0,

          difficulty: 'intermediate',
          isActive: true
        });
      }
    } catch (error) {
      toast({
        title: "Error",
        description: "Failed to add question",
        variant: "destructive",
      });
    }
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <div>
        <label className="text-sm font-medium">Course</label>
        <select 
          className="w-full mt-1 p-2 border rounded-md"
          value={formData.courseId}
          onChange={(e) => setFormData({...formData, courseId: e.target.value})}
          required
        >
          <option value="">Select a course</option>
          {courses.map((course) => (
            <option key={course.id} value={course.id}>{course.title}</option>
          ))}
        </select>
      </div>
      <div>
        <label className="text-sm font-medium">Question</label>
        <textarea 
          className="w-full mt-1 p-2 border rounded-md"
          value={formData.question}
          onChange={(e) => setFormData({...formData, question: e.target.value})}
          rows={3}
          required
        />
      </div>
      <div>
        <label className="text-sm font-medium">Options</label>
        {formData.options.map((option, index) => (
          <input 
            key={index}
            className="w-full mt-1 p-2 border rounded-md"
            placeholder={`Option ${index + 1}`}
            value={option}
            onChange={(e) => {
              const newOptions = [...formData.options];
              newOptions[index] = e.target.value;
              setFormData({...formData, options: newOptions});
            }}
            required={index < 2}
          />
        ))}
      </div>
      <div>
        <label className="text-sm font-medium">Correct Answer</label>
        <select 
          className="w-full mt-1 p-2 border rounded-md"
          value={formData.correctAnswer}
          onChange={(e) => setFormData({...formData, correctAnswer: parseInt(e.target.value)})}
        >
          {formData.options.map((_, index) => (
            <option key={index} value={index}>Option {index + 1}</option>
          ))}
        </select>
      </div>

      <div className="grid grid-cols-2 gap-4">
        <div>
          <label className="text-sm font-medium">Difficulty</label>
          <select 
            className="w-full mt-1 p-2 border rounded-md"
            value={formData.difficulty}
            onChange={(e) => setFormData({...formData, difficulty: e.target.value})}
          >
            <option value="beginner">Beginner</option>
            <option value="intermediate">Intermediate</option>
            <option value="advanced">Advanced</option>
          </select>
        </div>
        <div className="flex items-center space-x-2 mt-6">
          <input 
            type="checkbox"
            checked={formData.isActive}
            onChange={(e) => setFormData({...formData, isActive: e.target.checked})}
          />
          <label className="text-sm">Active</label>
        </div>
      </div>
      <div className="flex justify-end gap-2">
        <Button type="submit">Add Question</Button>
      </div>
    </form>
  );
}

function AIQuestionsManagement() {
  const [searchTerm, setSearchTerm] = useState("");
  const [selectedTechnology, setSelectedTechnology] = useState<string>("");
  const [editingQuestion, setEditingQuestion] = useState<any>(null);
  const [showEditDialog, setShowEditDialog] = useState(false);
  const { toast } = useToast();

  const { data: questions = [], isLoading: questionsLoading, refetch: refetchInterviewQuestions } = useQuery({
    queryKey: ["/api/admin/interview-questions", selectedTechnology, searchTerm],
    queryFn: async () => {
      const params = new URLSearchParams();
      if (selectedTechnology && selectedTechnology !== "all") params.append('technology', selectedTechnology);
      if (searchTerm) params.append('search', searchTerm);
      const response = await apiRequest("GET", `/api/admin/interview-questions?${params}`);
      return response.json();
    }
  });

  const deleteQuestion = useMutation({
    mutationFn: async (questionId: number) => {
      const response = await apiRequest("DELETE", `/api/admin/interview-questions/${questionId}`);
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/admin/interview-questions"] });
      toast({
        title: "AI Question Deleted",
        description: "AI interview question has been deleted successfully.",
      });
    },
    onError: (error: any) => {
      toast({
        title: "Error",
        description: error.message || "Failed to delete AI question",
        variant: "destructive",
      });
    },
  });

  const technologies = ["JavaScript", "Python", "React", "Node.js", "Java", "C++", "SQL", "MongoDB"];

  return (
    <Card>
      <CardHeader>
        <CardTitle>AI Interview Questions Management</CardTitle>
        <CardDescription>Manage questions for AI technical interviews</CardDescription>
      </CardHeader>
      <CardContent>
        <div className="space-y-4">
          <div className="flex gap-4 items-center">
            <Input
              placeholder="Search AI questions..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="max-w-sm"
            />
            <Select value={selectedTechnology || "all"} onValueChange={(value) => setSelectedTechnology(value === "all" ? "" : value)}>
              <SelectTrigger className="w-[200px]">
                <SelectValue placeholder="Filter by technology" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Technologies</SelectItem>
                {technologies.map((tech) => (
                  <SelectItem key={tech} value={tech}>
                    {tech}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <Button>
              <Plus className="h-4 w-4 mr-2" />
              Add AI Question
            </Button>
          </div>

          {questionsLoading ? (
            <div className="flex justify-center py-8">
              <div className="animate-spin w-8 h-8 border-4 border-primary border-t-transparent rounded-full" />
            </div>
          ) : (
            <div className="border rounded-lg">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Title</TableHead>
                    <TableHead>Technology</TableHead>
                    <TableHead>Type</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead>Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {questions.map((question: any) => (
                    <TableRow key={question.id}>
                      <TableCell>
                        <div className="max-w-md">
                          <p className="font-medium">{question.title}</p>
                          <p className="text-sm text-muted-foreground truncate">
                            {question.question}
                          </p>
                        </div>
                      </TableCell>
                      <TableCell>
                        <Badge variant="outline">{question.technology}</Badge>
                      </TableCell>
                      <TableCell>{question.type || 'General'}</TableCell>
                      <TableCell>
                        <Badge variant={question.isActive ? 'default' : 'secondary'}>
                          {question.isActive ? 'Active' : 'Inactive'}
                        </Badge>
                      </TableCell>
                      <TableCell>
                        <div className="flex gap-2">
                          <Button 
                            variant="outline" 
                            size="sm"
                            onClick={() => {
                              setEditingQuestion(question);
                              setShowEditDialog(true);
                            }}
                          >
                            <Edit className="h-4 w-4" />
                          </Button>
                          <AlertDialog>
                            <AlertDialogTrigger asChild>
                              <Button variant="outline" size="sm">
                                <Trash2 className="h-4 w-4" />
                              </Button>
                            </AlertDialogTrigger>
                            <AlertDialogContent>
                              <AlertDialogHeader>
                                <AlertDialogTitle>Delete AI Question</AlertDialogTitle>
                                <AlertDialogDescription>
                                  Are you sure you want to delete this AI interview question? This action cannot be undone.
                                </AlertDialogDescription>
                              </AlertDialogHeader>
                              <AlertDialogFooter>
                                <AlertDialogCancel>Cancel</AlertDialogCancel>
                                <AlertDialogAction onClick={() => deleteQuestion.mutate(question.id)}>
                                  Delete
                                </AlertDialogAction>
                              </AlertDialogFooter>
                            </AlertDialogContent>
                          </AlertDialog>
                        </div>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          )}
        </div>
      </CardContent>

      {/* Edit AI Interview Question Dialog */}
      <Dialog open={showEditDialog} onOpenChange={setShowEditDialog}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle>Edit AI Interview Question</DialogTitle>
          </DialogHeader>
          {editingQuestion && (
            <div className="space-y-4">
              <div>
                <label className="text-sm font-medium">Title</label>
                <input 
                  className="w-full mt-1 p-2 border rounded-md" 
                  value={editingQuestion.title}
                  onChange={(e) => setEditingQuestion({...editingQuestion, title: e.target.value})}
                />
              </div>
              <div>
                <label className="text-sm font-medium">Question</label>
                <textarea 
                  className="w-full mt-1 p-2 border rounded-md" 
                  value={editingQuestion.question}
                  onChange={(e) => setEditingQuestion({...editingQuestion, question: e.target.value})}
                  rows={4}
                />
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="text-sm font-medium">Technology</label>
                  <select 
                    className="w-full mt-1 p-2 border rounded-md"
                    value={editingQuestion.technology}
                    onChange={(e) => setEditingQuestion({...editingQuestion, technology: e.target.value})}
                  >
                    {["JavaScript", "Python", "React", "Node.js", "Java", "C++", "SQL", "MongoDB"].map((tech) => (
                      <option key={tech} value={tech}>{tech}</option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="text-sm font-medium">Difficulty</label>
                  <select 
                    className="w-full mt-1 p-2 border rounded-md"
                    value={editingQuestion.difficulty}
                    onChange={(e) => setEditingQuestion({...editingQuestion, difficulty: e.target.value})}
                  >
                    <option value="beginner">Beginner</option>
                    <option value="intermediate">Intermediate</option>
                    <option value="advanced">Advanced</option>
                  </select>
                </div>
              </div>
              <div className="flex justify-end gap-2">
                <Button variant="outline" onClick={() => setShowEditDialog(false)}>
                  Cancel
                </Button>
                <Button onClick={async () => {
                  try {
                    const response = await apiRequest("PUT", `/api/admin/interview-questions/${editingQuestion.id}`, {
                      title: editingQuestion.title,
                      question: editingQuestion.question,
                      technology: editingQuestion.technology,
                      difficulty: editingQuestion.difficulty
                    });
                    if (response.ok) {
                      toast({
                        title: "AI Interview Question Updated",
                        description: "AI interview question has been updated successfully.",
                      });
                      setShowEditDialog(false);
                      refetchInterviewQuestions();
                    }
                  } catch (error) {
                    toast({
                      title: "Error",
                      description: "Failed to update AI interview question",
                      variant: "destructive",
                    });
                  }
                }}>
                  Save Changes
                </Button>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </Card>
  );
}

// Add AI Question Form Component
function AddAIQuestionForm({ onSuccess }: { onSuccess: () => void }) {
  const [formData, setFormData] = useState({
    title: '',
    question: '',
    technology: 'JavaScript',
    difficulty: 'intermediate',
    questionType: 'interview',
    timeLimit: 600,
    isActive: true
  });
  const { toast } = useToast();

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      const response = await apiRequest("POST", "/api/admin/interview-questions", formData);
      if (response.ok) {
        onSuccess();
        setFormData({
          title: '',
          question: '',
          technology: 'JavaScript',
          difficulty: 'intermediate',
          questionType: 'interview',
          timeLimit: 600,
          isActive: true
        });
      }
    } catch (error) {
      toast({
        title: "Error",
        description: "Failed to add AI interview question",
        variant: "destructive",
      });
    }
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <div>
        <label className="text-sm font-medium">Title</label>
        <input 
          className="w-full mt-1 p-2 border rounded-md"
          value={formData.title}
          onChange={(e) => setFormData({...formData, title: e.target.value})}
          required
        />
      </div>
      <div>
        <label className="text-sm font-medium">Question</label>
        <textarea 
          className="w-full mt-1 p-2 border rounded-md"
          value={formData.question}
          onChange={(e) => setFormData({...formData, question: e.target.value})}
          rows={4}
          required
        />
      </div>
      <div className="grid grid-cols-2 gap-4">
        <div>
          <label className="text-sm font-medium">Technology</label>
          <select 
            className="w-full mt-1 p-2 border rounded-md"
            value={formData.technology}
            onChange={(e) => setFormData({...formData, technology: e.target.value})}
          >
            {["JavaScript", "Python", "React", "Node.js", "Java", "C++", "SQL", "MongoDB"].map((tech) => (
              <option key={tech} value={tech}>{tech}</option>
            ))}
          </select>
        </div>
        <div>
          <label className="text-sm font-medium">Difficulty</label>
          <select 
            className="w-full mt-1 p-2 border rounded-md"
            value={formData.difficulty}
            onChange={(e) => setFormData({...formData, difficulty: e.target.value})}
          >
            <option value="beginner">Beginner</option>
            <option value="intermediate">Intermediate</option>
            <option value="advanced">Advanced</option>
          </select>
        </div>
      </div>
      <div className="grid grid-cols-2 gap-4">
        <div>
          <label className="text-sm font-medium">Question Type</label>
          <select 
            className="w-full mt-1 p-2 border rounded-md"
            value={formData.questionType}
            onChange={(e) => setFormData({...formData, questionType: e.target.value})}
          >
            <option value="interview">Interview</option>
            <option value="practical">Practical</option>
            <option value="handson">Hands-on</option>
          </select>
        </div>
        <div>
          <label className="text-sm font-medium">Time Limit (seconds)</label>
          <input 
            type="number"
            className="w-full mt-1 p-2 border rounded-md"
            value={formData.timeLimit}
            onChange={(e) => setFormData({...formData, timeLimit: parseInt(e.target.value)})}
            min="60"
            max="3600"
          />
        </div>
      </div>
      <div className="flex items-center space-x-2">
        <input 
          type="checkbox"
          checked={formData.isActive}
          onChange={(e) => setFormData({...formData, isActive: e.target.checked})}
        />
        <label className="text-sm">Active</label>
      </div>
      <div className="flex justify-end gap-2">
        <Button type="submit">Add AI Question</Button>
      </div>
    </form>
  );
}

function ContactSubmissionsManagement() {
  const [searchTerm, setSearchTerm] = useState("");
  const { toast } = useToast();

  const { data: contacts = [], isLoading: contactsLoading } = useQuery({
    queryKey: ["/api/admin/contacts", searchTerm],
    queryFn: async () => {
      const params = new URLSearchParams();
      if (searchTerm) params.append('search', searchTerm);
      const response = await apiRequest("GET", `/api/admin/contacts?${params}`);
      return response.json();
    }
  });

  const updateContact = useMutation({
    mutationFn: async ({ contactId, status, adminNotes }: { contactId: number; status: string; adminNotes?: string }) => {
      const response = await apiRequest("PUT", `/api/admin/contacts/${contactId}`, { status, adminNotes });
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/admin/contacts"] });
      toast({
        title: "Contact Updated",
        description: "Contact submission has been updated successfully.",
      });
    },
    onError: (error: any) => {
      toast({
        title: "Error",
        description: error.message || "Failed to update contact",
        variant: "destructive",
      });
    },
  });

  const getStatusBadge = (status: string) => {
    switch (status) {
      case 'responded':
        return <Badge variant="default">Responded</Badge>;
      case 'pending':
        return <Badge variant="secondary">Pending</Badge>;
      default:
        return <Badge variant="outline">New</Badge>;
    }
  };

  const newCount = contacts.filter((contact: any) => !contact.status || contact.status === 'new').length;
  const respondedCount = contacts.filter((contact: any) => contact.status === 'responded').length;

  return (
    <Card>
      <CardHeader>
        <CardTitle>Contact Submissions</CardTitle>
        <CardDescription>Manage support requests and customer inquiries</CardDescription>
      </CardHeader>
      <CardContent>
        <div className="space-y-4">
          <div className="flex justify-between items-center">
            <Input
              placeholder="Search contact submissions..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="max-w-sm"
            />
            <div className="flex gap-2">
              <Badge variant="outline">New: {newCount}</Badge>
              <Badge variant="outline">Responded: {respondedCount}</Badge>
            </div>
          </div>

          {contactsLoading ? (
            <div className="flex justify-center py-8">
              <div className="animate-spin w-8 h-8 border-4 border-primary border-t-transparent rounded-full" />
            </div>
          ) : (
            <div className="border rounded-lg">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Name</TableHead>
                    <TableHead>Email</TableHead>
                    <TableHead>Subject</TableHead>
                    <TableHead>Phone</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead>Date</TableHead>
                    <TableHead>Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {contacts.map((contact: any) => (
                    <TableRow key={contact.id}>
                      <TableCell className="font-medium">{contact.name}</TableCell>
                      <TableCell>{contact.email}</TableCell>
                      <TableCell>
                        <div className="max-w-xs">
                          <p className="truncate">{contact.subject}</p>
                        </div>
                      </TableCell>
                      <TableCell>{contact.phone || 'N/A'}</TableCell>
                      <TableCell>{getStatusBadge(contact.status)}</TableCell>
                      <TableCell>
                        {new Date(contact.submittedAt).toLocaleDateString()}
                      </TableCell>
                      <TableCell>
                        <div className="flex gap-2">
                          <Button 
                            variant="outline" 
                            size="sm"
                            onClick={() => updateContact.mutate({ contactId: contact.id, status: 'responded' })}
                            disabled={contact.status === 'responded'}
                          >
                            <Check className="h-4 w-4" />
                          </Button>
                          <Dialog>
                            <DialogTrigger asChild>
                              <Button variant="outline" size="sm">
                                <Eye className="h-4 w-4" />
                              </Button>
                            </DialogTrigger>
                            <DialogContent className="max-w-2xl">
                              <DialogHeader>
                                <DialogTitle>Contact Details</DialogTitle>
                              </DialogHeader>
                              <div className="space-y-4">
                                <div className="grid grid-cols-2 gap-4">
                                  <div>
                                    <p className="font-medium">Name</p>
                                    <p className="text-sm text-muted-foreground">{contact.name}</p>
                                  </div>
                                  <div>
                                    <p className="font-medium">Email</p>
                                    <p className="text-sm text-muted-foreground">{contact.email}</p>
                                  </div>
                                  <div>
                                    <p className="font-medium">Phone</p>
                                    <p className="text-sm text-muted-foreground">{contact.phone || 'N/A'}</p>
                                  </div>
                                  <div>
                                    <p className="font-medium">Status</p>
                                    <div>{getStatusBadge(contact.status)}</div>
                                  </div>
                                </div>
                                <div>
                                  <p className="font-medium">Subject</p>
                                  <p className="text-sm text-muted-foreground">{contact.subject}</p>
                                </div>
                                <div>
                                  <p className="font-medium">Message</p>
                                  <p className="text-sm text-muted-foreground whitespace-pre-wrap">{contact.message}</p>
                                </div>
                              </div>
                            </DialogContent>
                          </Dialog>
                        </div>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          )}
        </div>
      </CardContent>
    </Card>
  );
}

interface Analytics {
  totalUsers?: number;
  totalCourses?: number;
  totalCertificates?: number;
  totalRevenue?: number;
  totalPartners?: number;
  approvedPartners?: number;
  pendingPartners?: number;
  totalClicks?: number;
  totalConversions?: number;
}

interface Customer {
  id: number;
  name: string;
  email: string;
  createdAt: string;
  isAdmin: boolean;
  certificateCount: number;
  totalSpent: number;
}

interface AdminCourse {
  id: number;
  title: string;
  description: string;
  slug: string;
  categoryId: number;
  duration: number;
  passingScore: number;
  price: string;
  originalPrice?: string | null;
  isOnSale: boolean;
  level: string;
  isActive: boolean;
  isInternship: boolean;
  enrollmentCount: number;
  revenue: number;
  createdAt: string;
  category?: { id: number; name: string };
}

interface ExamAttempt {
  id: number;
  userId: number;
  courseId: number;
  courseTitle: string;
  userName: string;
  userEmail: string;
  score: number;
  passed: boolean;
  timeTaken: number;
  createdAt: string;
}

interface Transaction {
  id: number;
  certificateId: number;
  amount: string;
  status: string;
  createdAt: string;
  userName: string;
  courseTitle: string;
}

interface Partner {
  id: number;
  name: string;
  email: string;
  isApproved: boolean;
  clickCount: number;
  earnings: number;
  createdAt: string;
}

interface WithdrawalRequest {
  id: number;
  sellerId: number;
  amount: string;
  status: string;
  createdAt: string;
  sellerName: string;
  sellerEmail: string;
}

interface Category {
  id: number;
  name: string;
  description: string;
  courseCount?: number;
  createdAt: string;
}

const courseSchema = z.object({
  title: z.string().min(1, "Title is required"),
  description: z.string().min(1, "Description is required"),
  slug: z.string().min(1, "Slug is required"),
  categoryId: z.number().min(1, "Category is required"),
  duration: z.number().min(1, "Duration must be at least 1 minute"),
  passingScore: z.number().min(1).max(100, "Passing score must be between 1-100"),
  price: z.string().min(1, "Price is required"),
  originalPrice: z.string().optional(),
  isOnSale: z.boolean().default(false),
  level: z.enum(["Beginner", "Intermediate", "Advanced"]),
  isActive: z.boolean().default(true),
  isInternship: z.boolean().default(false)
});

type CourseFormData = z.infer<typeof courseSchema>;

// Category form schema
const categorySchema = z.object({
  name: z.string().min(1, "Category name is required"),
  description: z.string().min(1, "Description is required")
});

type CategoryFormData = z.infer<typeof categorySchema>;

// Inline CourseForm component
function CourseForm({ course, onCancel, onSuccess }: { course?: any; onCancel: () => void; onSuccess: () => void }) {
  const { toast } = useToast();
  const isEditing = !!course;

  const form = useForm<CourseFormData>({
    resolver: zodResolver(courseSchema),
    defaultValues: {
      title: course?.title || "",
      description: course?.description || "",
      slug: course?.slug || "",
      categoryId: course?.categoryId || 0,
      duration: course?.duration || 30,
      passingScore: course?.passingScore || 60,
      price: course?.price || "99",
      originalPrice: course?.originalPrice || "",
      isOnSale: course?.isOnSale || false,
      level: course?.level || "Beginner",
      isActive: course?.isActive !== false,
      isInternship: course?.isInternship || false
    }
  });

  // Reset form when course data changes
  useEffect(() => {
    if (course) {
      form.reset({
        title: course.title || "",
        description: course.description || "",
        slug: course.slug || "",
        categoryId: course.categoryId || 0,
        duration: course.duration || 30,
        passingScore: course.passingScore || 60,
        price: course.price || "99",
        originalPrice: course.originalPrice || "",
        isOnSale: course.isOnSale || false,
        level: course.level || "Beginner",
        isActive: course.isActive !== false,
        isInternship: course.isInternship || false
      });
    }
  }, [course, form]);

  // Fetch categories
  const { data: categories = [] } = useQuery<Category[]>({
    queryKey: ["/api/categories"]
  });

  // Create/Update course mutation
  const courseMutation = useMutation({
    mutationFn: async (data: CourseFormData) => {
      console.log('Form data being sent:', data);
      console.log('Is editing:', isEditing);
      console.log('Course ID:', course?.id);
      const url = isEditing ? `/api/admin/courses/${course.id}` : "/api/admin/courses";
      const method = isEditing ? "PUT" : "POST";
      console.log('API URL:', url);
      console.log('HTTP Method:', method);
      const result = await apiRequest(method, url, data);
      console.log('API Response:', result);
      return result;
    },
    onSuccess: (data) => {
      console.log('Mutation success:', data);
      // Invalidate all course-related queries
      queryClient.invalidateQueries({ queryKey: ["/api/admin/courses"] });
      queryClient.invalidateQueries({ queryKey: ["/api/courses"] });
      queryClient.invalidateQueries({ queryKey: ["/api/analytics"] });
      // Refetch the data immediately
      queryClient.refetchQueries({ queryKey: ["/api/admin/courses"] });
      toast({
        title: "Success",
        description: `Course ${isEditing ? 'updated' : 'created'} successfully`
      });
      onSuccess();
    },
    onError: (error: any) => {
      console.error('Mutation error:', error);
      toast({
        title: "Error",
        description: error.message || `Failed to ${isEditing ? 'update' : 'create'} course`,
        variant: "destructive"
      });
    }
  });

  const onSubmit = (data: CourseFormData) => {
    console.log('Form submitted with data:', data);
    console.log('Is editing:', isEditing);
    console.log('Course ID:', course?.id);
    
    // Generate slug from title if not provided
    if (!data.slug && data.title) {
      data.slug = data.title.toLowerCase().replace(/[^a-z0-9]+/g, '-');
    }
    console.log('Final data being sent:', data);
    courseMutation.mutate(data);
  };

  const handleTitleChange = (title: string) => {
    form.setValue("title", title);
    if (!form.getValues("slug")) {
      const slug = title.toLowerCase().replace(/[^a-z0-9]+/g, '-');
      form.setValue("slug", slug);
    }
  };

  return (
    <div className="w-full max-w-4xl mx-auto">
      <Form {...form}>
        <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <FormField
              control={form.control}
              name="title"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Course Title</FormLabel>
                  <FormControl>
                    <Input 
                      placeholder="e.g., Advanced AI Development"
                      {...field}
                      onChange={(e) => handleTitleChange(e.target.value)}
                    />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            <FormField
              control={form.control}
              name="slug"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>URL Slug</FormLabel>
                  <FormControl>
                    <Input placeholder="advanced-ai-development" {...field} />
                  </FormControl>
                  <FormDescription>Used in the course URL</FormDescription>
                  <FormMessage />
                </FormItem>
              )}
            />

            <FormField
              control={form.control}
              name="categoryId"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Category</FormLabel>
                  <Select onValueChange={(value) => field.onChange(parseInt(value))} value={field.value?.toString()}>
                    <FormControl>
                      <SelectTrigger>
                        <SelectValue placeholder="Select a category" />
                      </SelectTrigger>
                    </FormControl>
                    <SelectContent>
                      {categories.map((category: Category) => (
                        <SelectItem key={category.id} value={category.id.toString()}>
                          {category.name}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  <FormMessage />
                </FormItem>
              )}
            />

            <FormField
              control={form.control}
              name="level"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Difficulty Level</FormLabel>
                  <Select onValueChange={field.onChange} value={field.value}>
                    <FormControl>
                      <SelectTrigger>
                        <SelectValue placeholder="Select difficulty" />
                      </SelectTrigger>
                    </FormControl>
                    <SelectContent>
                      <SelectItem value="Beginner">Beginner</SelectItem>
                      <SelectItem value="Intermediate">Intermediate</SelectItem>
                      <SelectItem value="Advanced">Advanced</SelectItem>
                    </SelectContent>
                  </Select>
                  <FormMessage />
                </FormItem>
              )}
            />

            <FormField
              control={form.control}
              name="duration"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Duration (minutes)</FormLabel>
                  <FormControl>
                    <Input 
                      type="number" 
                      placeholder="30"
                      {...field}
                      onChange={(e) => field.onChange(parseInt(e.target.value))}
                    />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            <FormField
              control={form.control}
              name="passingScore"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Passing Score (%)</FormLabel>
                  <FormControl>
                    <Input 
                      type="number" 
                      placeholder="60"
                      min="1"
                      max="100"
                      {...field}
                      onChange={(e) => field.onChange(parseInt(e.target.value))}
                    />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            <FormField
              control={form.control}
              name="price"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Price (₹)</FormLabel>
                  <FormControl>
                    <Input placeholder="99" {...field} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            <FormField
              control={form.control}
              name="originalPrice"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Original Price (₹)</FormLabel>
                  <FormControl>
                    <Input placeholder="199" {...field} />
                  </FormControl>
                  <FormDescription>For sale pricing display</FormDescription>
                  <FormMessage />
                </FormItem>
              )}
            />
          </div>

          <FormField
            control={form.control}
            name="description"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Description</FormLabel>
                <FormControl>
                  <Textarea 
                    placeholder="Detailed course description..."
                    className="min-h-[100px]"
                    {...field}
                  />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />

          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            <FormField
              control={form.control}
              name="isOnSale"
              render={({ field }) => (
                <FormItem className="flex flex-row items-center justify-between rounded-lg border p-4">
                  <div className="space-y-0.5">
                    <FormLabel className="text-base">On Sale</FormLabel>
                    <FormDescription>Mark this course as on sale</FormDescription>
                  </div>
                  <FormControl>
                    <Switch checked={field.value} onCheckedChange={field.onChange} />
                  </FormControl>
                </FormItem>
              )}
            />

            <FormField
              control={form.control}
              name="isActive"
              render={({ field }) => (
                <FormItem className="flex flex-row items-center justify-between rounded-lg border p-4">
                  <div className="space-y-0.5">
                    <FormLabel className="text-base">Active</FormLabel>
                    <FormDescription>Make course available to users</FormDescription>
                  </div>
                  <FormControl>
                    <Switch checked={field.value} onCheckedChange={field.onChange} />
                  </FormControl>
                </FormItem>
              )}
            />

            <FormField
              control={form.control}
              name="isInternship"
              render={({ field }) => (
                <FormItem className="flex flex-row items-center justify-between rounded-lg border p-4">
                  <div className="space-y-0.5">
                    <FormLabel className="text-base">Internship</FormLabel>
                    <FormDescription>Mark as internship course</FormDescription>
                  </div>
                  <FormControl>
                    <Switch checked={field.value} onCheckedChange={field.onChange} />
                  </FormControl>
                </FormItem>
              )}
            />
          </div>

          <div className="flex gap-4 pt-4">
            <Button type="submit" disabled={courseMutation.isPending}>
              {courseMutation.isPending ? "Saving..." : (isEditing ? "Update Course" : "Create Course")}
            </Button>
            <Button type="button" variant="outline" onClick={onCancel}>
              Cancel
            </Button>
          </div>
        </form>
      </Form>
    </div>
  );
}

// Inline CategoryForm component
function CategoryForm({ category, onCancel, onSuccess }: { category?: any; onCancel: () => void; onSuccess: () => void }) {
  const { toast } = useToast();
  const isEditing = !!category;

  const form = useForm<CategoryFormData>({
    resolver: zodResolver(categorySchema),
    defaultValues: {
      name: category?.name || "",
      description: category?.description || ""
    }
  });

  // Create/Update category mutation
  const categoryMutation = useMutation({
    mutationFn: async (data: CategoryFormData) => {
      const url = isEditing ? `/api/admin/categories/${category.id}` : "/api/admin/categories";
      const method = isEditing ? "PUT" : "POST";
      return await apiRequest(method, url, data);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/categories"] });
      queryClient.invalidateQueries({ queryKey: ["/api/admin/courses"] });
      toast({
        title: "Success",
        description: `Category ${isEditing ? 'updated' : 'created'} successfully`
      });
      onSuccess();
    },
    onError: (error: any) => {
      toast({
        title: "Error",
        description: error.message || `Failed to ${isEditing ? 'update' : 'create'} category`,
        variant: "destructive"
      });
    }
  });

  const onSubmit = (data: CategoryFormData) => {
    categoryMutation.mutate(data);
  };

  return (
    <div className="w-full max-w-2xl mx-auto">
      <Form {...form}>
        <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6">
          <FormField
            control={form.control}
            name="name"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Category Name</FormLabel>
                <FormControl>
                  <Input placeholder="e.g., Artificial Intelligence" {...field} />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />

          <FormField
            control={form.control}
            name="description"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Description</FormLabel>
                <FormControl>
                  <Textarea 
                    placeholder="Brief description of this category..."
                    className="min-h-[100px]"
                    {...field}
                  />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />

          <div className="flex gap-4 pt-4">
            <Button type="submit" disabled={categoryMutation.isPending}>
              {categoryMutation.isPending ? "Saving..." : (isEditing ? "Update Category" : "Create Category")}
            </Button>
            <Button type="button" variant="outline" onClick={onCancel}>
              Cancel
            </Button>
          </div>
        </form>
      </Form>
    </div>
  );
}

interface ExamAttempt {
  id: number;
  userId: number;
  courseId: number;
  userEmail: string;
  userName: string;
  score: number;
  totalQuestions: number;
  timeTaken: number;
  createdAt: string;
  courseTitle: string;
  passed: boolean;
}

interface Transaction {
  id: number;
  transactionId: string;
  amount: string;
  status: string;
  createdAt: string;
  certificateId: number;
}

interface Partner {
  id: number;
  name: string;
  email: string;
  phone: string;
  referralCode: string;
  isApproved: boolean;
  totalEarnings: number;
  createdAt: string;
}

interface WithdrawalRequest {
  id: number;
  sellerId: number;
  amount: string;
  status: string;
  createdAt: string;
  sellerName: string;
  sellerEmail: string;
  upiId: string;
  accountHolderName: string;
}

export default function AdminDashboard() {
  const [, setLocation] = useLocation();
  const { toast } = useToast();
  const [activeTab, setActiveTab] = useState("overview");
  const [selectedCourse, setSelectedCourse] = useState<AdminCourse | null>(null);
  const [isCreatingCourse, setIsCreatingCourse] = useState(false);
  const [showCourseForm, setShowCourseForm] = useState(false);
  const [editingCourse, setEditingCourse] = useState<AdminCourse | null>(null);
  const [isEditingCourse, setIsEditingCourse] = useState(false);
  
  // Pagination states
  const [customersPage, setCustomersPage] = useState(1);
  const [coursesPage, setCoursesPage] = useState(1);
  const [examsPage, setExamsPage] = useState(1);
  const [transactionsPage, setTransactionsPage] = useState(1);
  const [partnersPage, setPartnersPage] = useState(1);
  const itemsPerPage = 10;

  // Check admin authentication
  useEffect(() => {
    const adminToken = localStorage.getItem("adminToken");
    if (!adminToken) {
      setLocation("/qwegle/login");
      return;
    }
  }, [setLocation]);

  // State for modals and pagination
  const [isCreatingCategory, setIsCreatingCategory] = useState(false);

  // Fetch analytics data
  const { data: analytics = {}, isLoading: analyticsLoading } = useQuery<Analytics>({
    queryKey: ["/api/admin/analytics"],
  });

  // Fetch categories data
  const { data: categories = [], isLoading: categoriesLoading } = useQuery<Category[]>({
    queryKey: ["/api/categories"],
  });

  // Fetch customers data
  const { data: customers = [], isLoading: customersLoading } = useQuery<Customer[]>({
    queryKey: ["/api/admin/customers"],
  });

  // Fetch admin courses data  
  const { data: adminCourses = [], isLoading: adminCoursesLoading } = useQuery<AdminCourse[]>({
    queryKey: ["/api/admin/courses"],
  });

  // Fetch exam attempts data
  const { data: examAttempts = [], isLoading: examAttemptsLoading } = useQuery<ExamAttempt[]>({
    queryKey: ["/api/admin/exam-attempts"],
  });

  // Fetch transactions data
  const { data: transactions = [], isLoading: transactionsLoading } = useQuery<Transaction[]>({
    queryKey: ["/api/admin/transactions"],
  });

  // Fetch partners data
  const { data: partners = [], isLoading: partnersLoading } = useQuery<Partner[]>({
    queryKey: ["/api/admin/partners"],
  });

  // Fetch withdrawals data
  const { data: withdrawals = [], isLoading: withdrawalsLoading } = useQuery<WithdrawalRequest[]>({
    queryKey: ["/api/admin/withdrawals"],
  });

  // Partner approval mutation
  // const approvePartnerMutation = useMutation({
  //   mutationFn: async ({ partnerId, approved }: { partnerId: number; approved: boolean }) => {
  //     const response = await apiRequest("POST", `/api/admin/partners/${partnerId}/approve`, { approved });
  //     return response.json();
  //   },
  //   onSuccess: () => {
  //     queryClient.invalidateQueries({ queryKey: ["/api/admin/partners"] });
  //     queryClient.invalidateQueries({ queryKey: ["/api/admin/analytics"] });
  //     toast({
  //       title: "Partner Updated",
  //       description: "Partner status has been updated successfully.",
  //     });
  //   },
  //   onError: (error: any) => {
  //     toast({
  //       title: "Error",
  //       description: error.message || "Failed to update partner status",
  //       variant: "destructive",
  //     });
  //   },
  // });

  const [approveLoading, setApproveLoading] = useState(false);
  async function approvePartner(partnerId: number, approved: boolean) {
    try {
      setApproveLoading(true);
      const response = await apiRequest(
        "POST",
        `/api/admin/partners/${partnerId}/approve`,
        { approved }
      );

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.message || "Failed to update partner status");
      }

      const data = await response.json();
      
      queryClient.invalidateQueries({ queryKey: ["/api/admin/partners"] });
      toast({
        title: "Partner Updated",
        description: "Partner status has been updated successfully.",
      });

      return data;
    } catch (error: any) {
      toast({
        title: "Error",
        description: error.message || "Failed to update partner status",
        variant: "destructive",
      });
    } finally {
      setApproveLoading(false);
    }
  }

  // Withdrawal processing mutation
  const processWithdrawalMutation = useMutation({
    mutationFn: async ({ withdrawalId, status }: { withdrawalId: number; status: string }) => {
      const response = await apiRequest("POST", `/api/admin/withdrawals/${withdrawalId}/process`, { status });
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/admin/withdrawals"] });
      queryClient.invalidateQueries({ queryKey: ["/api/admin/partners"] });
      toast({
        title: "Withdrawal Processed",
        description: "Withdrawal request has been processed successfully.",
      });
    },
    onError: (error: any) => {
      toast({
        title: "Error",
        description: error.message || "Failed to process withdrawal",
        variant: "destructive",
      });
    },
  });

  // Course deletion mutation
  const deleteCourse = useMutation({
    mutationFn: async (courseId: number) => {
      const response = await apiRequest("DELETE", `/api/admin/courses/${courseId}`);
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/admin/courses"] });
      queryClient.invalidateQueries({ queryKey: ["/api/admin/analytics"] });
      toast({
        title: "Course Deleted",
        description: "Course has been deleted successfully.",
      });
    },
    onError: (error: any) => {
      toast({
        title: "Error",
        description: error.message || "Failed to delete course",
        variant: "destructive",
      });
    },
  });

  // Category deletion mutation
  const deleteCategory = useMutation({
    mutationFn: async (categoryId: number) => {
      const response = await apiRequest("DELETE", `/api/admin/categories/${categoryId}`);
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/categories"] });
      queryClient.invalidateQueries({ queryKey: ["/api/admin/courses"] });
      queryClient.invalidateQueries({ queryKey: ["/api/admin/analytics"] });
      toast({
        title: "Category Deleted",
        description: "Category has been deleted successfully.",
      });
    },
    onError: (error: any) => {
      toast({
        title: "Error",
        description: error.message || "Failed to delete category",
        variant: "destructive",
      });
    },
  });

  const handleDeleteCategory = (categoryId: number) => {
    deleteCategory.mutate(categoryId);
  };

  const handleLogout = () => {
    localStorage.removeItem("adminToken");
    setLocation("/qwegle/login");
  };

  if (analyticsLoading) {
    return (
      <div className="min-h-screen bg-cream-deep dark:bg-gray-900 flex items-center justify-center">
        <div className="animate-spin w-8 h-8 border-4 border-blue-600 border-t-transparent rounded-full" />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-cream-deep dark:bg-gray-900">
      {/* Header */}
      <div className="bg-cream-soft dark:bg-gray-800 shadow-sm border-b">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex justify-between items-center py-4">
            <div className="flex items-center space-x-3">
              <Shield className="w-8 h-8 text-blue-600" />
              <div>
                <h1 className="text-2xl font-bold text-gray-900 dark:text-gray-100">Admin Dashboard</h1>
                <p className="text-sm text-gray-500 dark:text-gray-400">Octamy Platform Administration</p>
              </div>
            </div>
            <div className="flex items-center space-x-4">
              <Button
                onClick={() => setLocation("/admin/approvals")}
                size="sm"
                className="flex items-center gap-2 bg-amber-600 hover:bg-amber-700 text-white"
              >
                <Shield className="h-4 w-4" />
                Approval queue
              </Button>
              <Button
                onClick={() => setLocation("/enhanced-admin")}
                variant="outline"
                size="sm"
                className="flex items-center gap-2 border-green-600 text-green-600 hover:bg-green-50 dark:hover:bg-green-900/20"
              >
                <TrendingUp className="h-4 w-4" />
                Enhanced Version
              </Button>
              <Button variant="outline" size="sm" onClick={() => setLocation("/")}>
                <Eye className="w-4 h-4 mr-2" />
                View Site
              </Button>
              <Button variant="outline" size="sm" onClick={handleLogout}>
                <LogOut className="w-4 h-4 mr-2" />
                Logout
              </Button>
            </div>
          </div>
        </div>
      </div>

      {/* Main Content */}
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <div className="space-y-6">
          <Tabs defaultValue="overview" className="space-y-4">
            <TabsList className="grid w-full grid-cols-10">
              <TabsTrigger value="overview">Overview</TabsTrigger>
              <TabsTrigger value="customers">Customers</TabsTrigger>
              <TabsTrigger value="categories">Categories</TabsTrigger>
              <TabsTrigger value="courses">Courses</TabsTrigger>
              <TabsTrigger value="questions">Questions</TabsTrigger>
              <TabsTrigger value="ai-questions">AI Interview</TabsTrigger>
              <TabsTrigger value="contacts">Contact</TabsTrigger>
              <TabsTrigger value="exams">Exams</TabsTrigger>
              <TabsTrigger value="partners">Partners</TabsTrigger>
              <TabsTrigger value="transactions">Transactions</TabsTrigger>
            </TabsList>

            <TabsContent value="overview" className="space-y-4">
              {/* Quick Stats */}
              <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
                <Card>
                  <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                    <CardTitle className="text-sm font-medium">Total Users</CardTitle>
                    <Users className="h-4 w-4 text-muted-foreground" />
                  </CardHeader>
                  <CardContent>
                    <div className="text-2xl font-bold">{analytics?.totalUsers || 0}</div>
                    <p className="text-xs text-muted-foreground">
                      Registered customers
                    </p>
                  </CardContent>
                </Card>
                <Card>
                  <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                    <CardTitle className="text-sm font-medium">Total Courses</CardTitle>
                    <BookOpen className="h-4 w-4 text-muted-foreground" />
                  </CardHeader>
                  <CardContent>
                    <div className="text-2xl font-bold">{analytics?.totalCourses || 0}</div>
                    <p className="text-xs text-muted-foreground">
                      Available courses
                    </p>
                  </CardContent>
                </Card>
                <Card>
                  <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                    <CardTitle className="text-sm font-medium">Certificates Issued</CardTitle>
                    <GraduationCap className="h-4 w-4 text-muted-foreground" />
                  </CardHeader>
                  <CardContent>
                    <div className="text-2xl font-bold">{analytics?.totalCertificates || 0}</div>
                    <p className="text-xs text-muted-foreground">
                      Paid certificates
                    </p>
                  </CardContent>
                </Card>
                <Card>
                  <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                    <CardTitle className="text-sm font-medium">Total Revenue</CardTitle>
                    <DollarSign className="h-4 w-4 text-muted-foreground" />
                  </CardHeader>
                  <CardContent>
                    <div className="text-2xl font-bold">₹{analytics?.totalRevenue || 0}</div>
                    <p className="text-xs text-muted-foreground">
                      Platform earnings
                    </p>
                  </CardContent>
                </Card>
              </div>

              {/* Recent Activity */}
              <div className="grid gap-4 md:grid-cols-2">
                <Card>
                  <CardHeader>
                    <CardTitle>Recent Customers</CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div className="space-y-4">
                      {customers.slice(0, 5).map((customer: Customer) => (
                        <div key={customer.id} className="flex items-center">
                          <UserCheck className="h-4 w-4 text-muted-foreground" />
                          <div className="ml-4 space-y-1">
                            <p className="text-sm font-medium leading-none">{customer.name}</p>
                            <p className="text-sm text-muted-foreground">
                              {customer.email} • {customer.certificateCount} certificates
                            </p>
                          </div>
                        </div>
                      ))}
                    </div>
                  </CardContent>
                </Card>

                <Card>
                  <CardHeader>
                    <CardTitle>Top Courses</CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div className="space-y-4">
                      {adminCourses.slice(0, 5).map((course: AdminCourse) => (
                        <div key={course.id} className="flex items-center">
                          <BookOpen className="h-4 w-4 text-muted-foreground" />
                          <div className="ml-4 space-y-1">
                            <p className="text-sm font-medium leading-none">{course.title}</p>
                            <p className="text-sm text-muted-foreground">
                              {course.enrollmentCount} enrollments • ₹{course.revenue} revenue
                            </p>
                          </div>
                        </div>
                      ))}
                    </div>
                  </CardContent>
                </Card>
              </div>
            </TabsContent>

            <TabsContent value="customers" className="space-y-4">
              {customersLoading ? (
                <div className="text-center py-8">Loading customers...</div>
              ) : (
                <Card>
                  <CardHeader>
                    <CardTitle>Customer Management</CardTitle>
                    <CardDescription>Manage registered users and their activity</CardDescription>
                  </CardHeader>
                  <CardContent>
                    <Table>
                      <TableHeader>
                        <TableRow>
                          <TableHead>Name</TableHead>
                          <TableHead>Email</TableHead>
                          <TableHead>Certificates</TableHead>
                          <TableHead>Total Spent</TableHead>
                          <TableHead>Joined</TableHead>
                          <TableHead>Status</TableHead>
                          <TableHead>Actions</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {customers
                          .slice((customersPage - 1) * itemsPerPage, customersPage * itemsPerPage)
                          .map((customer: Customer) => (
                          <TableRow key={customer.id}>
                            <TableCell className="font-medium">{customer.name}</TableCell>
                            <TableCell>{customer.email}</TableCell>
                            <TableCell>{customer.certificateCount}</TableCell>
                            <TableCell>₹{customer.totalSpent}</TableCell>
                            <TableCell>{new Date(customer.createdAt).toLocaleDateString()}</TableCell>
                            <TableCell>
                              <Badge variant={customer.isAdmin ? "destructive" : "default"}>
                                {customer.isAdmin ? "Admin" : "Customer"}
                              </Badge>
                            </TableCell>
                            <TableCell>
                              <Button size="sm" variant="outline">
                                <Eye className="h-4 w-4" />
                              </Button>
                            </TableCell>
                          </TableRow>
                        ))}
                      </TableBody>
                    </Table>
                  </CardContent>
                </Card>
              )}
            </TabsContent>

            <TabsContent value="categories" className="space-y-4">
              <Card>
                <CardHeader className="flex flex-row items-center justify-between">
                  <div>
                    <CardTitle>Category Management</CardTitle>
                    <CardDescription>Manage course categories and organization</CardDescription>
                  </div>
                  <Dialog open={isCreatingCategory} onOpenChange={setIsCreatingCategory}>
                    <DialogTrigger asChild>
                      <Button>
                        <Plus className="h-4 w-4 mr-2" />
                        Add New Category
                      </Button>
                    </DialogTrigger>
                    <DialogContent className="max-w-2xl">
                      <DialogHeader>
                        <DialogTitle>Create New Category</DialogTitle>
                      </DialogHeader>
                      <CategoryForm
                        onCancel={() => setIsCreatingCategory(false)}
                        onSuccess={() => setIsCreatingCategory(false)}
                      />
                    </DialogContent>
                  </Dialog>
                </CardHeader>
                <CardContent>
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Name</TableHead>
                        <TableHead>Description</TableHead>
                        <TableHead>Courses</TableHead>
                        <TableHead>Created</TableHead>
                        <TableHead>Actions</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {categories.map((category: any) => (
                        <TableRow key={category.id}>
                          <TableCell>
                            <div className="font-medium">{category.name}</div>
                          </TableCell>
                          <TableCell>
                            <div className="text-sm text-muted-foreground">{category.description}</div>
                          </TableCell>
                          <TableCell>
                            <Badge variant="secondary">{category.courseCount || 0} courses</Badge>
                          </TableCell>
                          <TableCell>
                            <div className="text-sm text-muted-foreground">
                              {new Date(category.createdAt).toLocaleDateString()}
                            </div>
                          </TableCell>
                          <TableCell>
                            <div className="flex items-center space-x-2">
                              <Dialog>
                                <DialogTrigger asChild>
                                  <Button variant="outline" size="sm">
                                    <Edit className="h-4 w-4" />
                                  </Button>
                                </DialogTrigger>
                                <DialogContent className="max-w-2xl">
                                  <DialogHeader>
                                    <DialogTitle>Edit Category</DialogTitle>
                                  </DialogHeader>
                                  <CategoryForm
                                    category={category}
                                    onCancel={() => {}}
                                    onSuccess={() => {}}
                                  />
                                </DialogContent>
                              </Dialog>
                              <AlertDialog>
                                <AlertDialogTrigger asChild>
                                  <Button variant="outline" size="sm">
                                    <Trash2 className="h-4 w-4" />
                                  </Button>
                                </AlertDialogTrigger>
                                <AlertDialogContent>
                                  <AlertDialogHeader>
                                    <AlertDialogTitle>Delete Category</AlertDialogTitle>
                                    <AlertDialogDescription>
                                      Are you sure you want to delete "{category.name}"? This action cannot be undone.
                                      {category.courseCount > 0 && (
                                        <div className="mt-2 text-red-600">
                                          Warning: This category has {category.courseCount} courses. They will need to be reassigned.
                                        </div>
                                      )}
                                    </AlertDialogDescription>
                                  </AlertDialogHeader>
                                  <AlertDialogFooter>
                                    <AlertDialogCancel>Cancel</AlertDialogCancel>
                                    <AlertDialogAction
                                      onClick={() => handleDeleteCategory(category.id)}
                                      className="bg-red-600 hover:bg-red-700"
                                    >
                                      Delete
                                    </AlertDialogAction>
                                  </AlertDialogFooter>
                                </AlertDialogContent>
                              </AlertDialog>
                            </div>
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </CardContent>
              </Card>
            </TabsContent>

            <TabsContent value="courses" className="space-y-4">
              {adminCoursesLoading ? (
                <div className="text-center py-8">Loading courses...</div>
              ) : (
                <>
                  <Card>
                    <CardHeader className="flex flex-row items-center justify-between">
                      <div>
                        <CardTitle>Course Management</CardTitle>
                        <CardDescription>Manage courses, pricing, and content</CardDescription>
                      </div>
                      <Dialog open={isCreatingCourse} onOpenChange={setIsCreatingCourse}>
                        <DialogTrigger asChild>
                          <Button>
                            <Plus className="h-4 w-4 mr-2" />
                            Add New Course
                          </Button>
                        </DialogTrigger>
                        <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
                          <DialogHeader>
                            <DialogTitle>Create New Course</DialogTitle>
                          </DialogHeader>
                          <CourseForm
                            onCancel={() => setIsCreatingCourse(false)}
                            onSuccess={() => setIsCreatingCourse(false)}
                          />
                        </DialogContent>
                      </Dialog>
                    </CardHeader>
                    <CardContent>
                      <Table>
                        <TableHeader>
                          <TableRow>
                            <TableHead>Course</TableHead>
                            <TableHead>Category</TableHead>
                            <TableHead>Price</TableHead>
                            <TableHead>Enrollments</TableHead>
                            <TableHead>Certificates</TableHead>
                            <TableHead>Revenue</TableHead>
                            <TableHead>Status</TableHead>
                            <TableHead>Actions</TableHead>
                          </TableRow>
                        </TableHeader>
                        <TableBody>
                          {adminCourses
                            .slice((coursesPage - 1) * itemsPerPage, coursesPage * itemsPerPage)
                            .map((course: AdminCourse) => (
                            <TableRow key={course.id}>
                              <TableCell>
                                <div>
                                  <div className="font-medium">{course.title}</div>
                                  <div className="text-sm text-muted-foreground">{course.duration} min • {course.passingScore}% pass</div>
                                </div>
                              </TableCell>
                              <TableCell>{course.categoryName || 'Unknown'}</TableCell>
                              <TableCell>
                                <div>
                                  <span className="font-medium">₹{course.price}</span>
                                  {course.isOnSale && course.originalPrice && (
                                    <span className="text-sm text-muted-foreground line-through ml-2">₹{course.originalPrice}</span>
                                  )}
                                  {course.isOnSale && (
                                    <Badge variant="secondary" className="ml-2 text-xs">SALE</Badge>
                                  )}
                                </div>
                              </TableCell>
                              <TableCell>{course.enrollmentCount}</TableCell>
                              <TableCell>{course.certificateCount}</TableCell>
                              <TableCell>₹{course.revenue}</TableCell>
                              <TableCell>
                                <div className="flex gap-1">
                                  <Badge variant={course.isActive ? "default" : "secondary"}>
                                    {course.isActive ? "Active" : "Inactive"}
                                  </Badge>
                                  {course.isInternship && (
                                    <Badge variant="outline">Internship</Badge>
                                  )}
                                </div>
                              </TableCell>
                              <TableCell>
                                <div className="flex gap-2">
                                  <Button 
                                    size="sm" 
                                    variant="outline"
                                    onClick={() => setLocation(`/exam/${course.slug}`)}
                                  >
                                    <Eye className="h-4 w-4" />
                                  </Button>
                                  <Dialog open={isEditingCourse && selectedCourse?.id === course.id} onOpenChange={(open) => {
                                    setIsEditingCourse(open);
                                    if (!open) setSelectedCourse(null);
                                  }}>
                                    <DialogTrigger asChild>
                                      <Button 
                                        size="sm" 
                                        variant="outline"
                                        onClick={() => {
                                          setSelectedCourse(course);
                                          setIsEditingCourse(true);
                                        }}
                                      >
                                        <Edit className="h-4 w-4" />
                                      </Button>
                                    </DialogTrigger>
                                    <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
                                      <DialogHeader>
                                        <DialogTitle>Edit Course</DialogTitle>
                                      </DialogHeader>
                                      <CourseForm
                                        course={selectedCourse}
                                        onCancel={() => {
                                          setIsEditingCourse(false);
                                          setSelectedCourse(null);
                                        }}
                                        onSuccess={() => {
                                          setIsEditingCourse(false);
                                          setSelectedCourse(null);
                                        }}
                                      />
                                    </DialogContent>
                                  </Dialog>
                                  <AlertDialog>
                                    <AlertDialogTrigger asChild>
                                      <Button size="sm" variant="outline">
                                        <Trash2 className="h-4 w-4" />
                                      </Button>
                                    </AlertDialogTrigger>
                                    <AlertDialogContent>
                                      <AlertDialogHeader>
                                        <AlertDialogTitle>Delete Course</AlertDialogTitle>
                                        <AlertDialogDescription>
                                          Are you sure you want to delete "{course.title}"? This action cannot be undone and will remove all associated questions and exam attempts.
                                        </AlertDialogDescription>
                                      </AlertDialogHeader>
                                      <AlertDialogFooter>
                                        <AlertDialogCancel>Cancel</AlertDialogCancel>
                                        <AlertDialogAction
                                          onClick={() => deleteCourse.mutate(course.id)}
                                          className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
                                        >
                                          Delete Course
                                        </AlertDialogAction>
                                      </AlertDialogFooter>
                                    </AlertDialogContent>
                                  </AlertDialog>
                                </div>
                              </TableCell>
                            </TableRow>
                          ))}
                        </TableBody>
                      </Table>
                      {adminCourses.length > itemsPerPage && (
                        <div className="flex justify-center gap-2 mt-4">
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() => setCoursesPage(Math.max(1, coursesPage - 1))}
                            disabled={coursesPage === 1}
                          >
                            Previous
                          </Button>
                          <span className="flex items-center px-3 text-sm">
                            Page {coursesPage} of {Math.ceil(adminCourses.length / itemsPerPage)}
                          </span>
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() => setCoursesPage(Math.min(Math.ceil(adminCourses.length / itemsPerPage), coursesPage + 1))}
                            disabled={coursesPage >= Math.ceil(adminCourses.length / itemsPerPage)}
                          >
                            Next
                          </Button>
                        </div>
                      )}
                    </CardContent>
                  </Card>
                </>
              )}
            </TabsContent>

            <TabsContent value="exams" className="space-y-4">
              {examAttemptsLoading ? (
                <div className="text-center py-8">Loading exam attempts...</div>
              ) : (
                <Card>
                  <CardHeader>
                    <CardTitle>Exam Management</CardTitle>
                    <CardDescription>Monitor exam attempts and results</CardDescription>
                  </CardHeader>
                  <CardContent>
                    <Table>
                      <TableHeader>
                        <TableRow>
                          <TableHead>Student</TableHead>
                          <TableHead>Course</TableHead>
                          <TableHead>Score</TableHead>
                          <TableHead>Result</TableHead>
                          <TableHead>Time Taken</TableHead>
                          <TableHead>Date</TableHead>
                          <TableHead>Actions</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {examAttempts
                          .slice((examsPage - 1) * itemsPerPage, examsPage * itemsPerPage)
                          .map((attempt: ExamAttempt) => (
                          <TableRow key={attempt.id}>
                            <TableCell>
                              <div>
                                <div className="font-medium">{attempt.userName}</div>
                                <div className="text-sm text-muted-foreground">{attempt.userEmail}</div>
                              </div>
                            </TableCell>
                            <TableCell>{attempt.courseTitle}</TableCell>
                            <TableCell>
                              <span className="font-medium">
                                {attempt.score}/{attempt.totalQuestions}
                              </span>
                              <span className="text-sm text-muted-foreground ml-2">
                                ({Math.round((attempt.score / attempt.totalQuestions) * 100)}%)
                              </span>
                            </TableCell>
                            <TableCell>
                              <Badge variant={attempt.passed ? "default" : "destructive"}>
                                {attempt.passed ? "Passed" : "Failed"}
                              </Badge>
                            </TableCell>
                            <TableCell>{Math.round(attempt.timeTaken / 60)} min</TableCell>
                            <TableCell>{new Date(attempt.createdAt).toLocaleDateString()}</TableCell>
                            <TableCell>
                              <Button size="sm" variant="outline">
                                <Eye className="h-4 w-4" />
                              </Button>
                            </TableCell>
                          </TableRow>
                        ))}
                      </TableBody>
                    </Table>
                  </CardContent>
                </Card>
              )}
            </TabsContent>

            <TabsContent value="partners" className="space-y-4">
              {partnersLoading ? (
                <div className="text-center py-8">Loading partners...</div>
              ) : (
                <Card>
                  <CardHeader>
                    <CardTitle>Partner Management</CardTitle>
                    <CardDescription>Approve and manage affiliate partners</CardDescription>
                  </CardHeader>
                  <CardContent>
                    <Table>
                      <TableHeader>
                        <TableRow>
                          <TableHead>Name</TableHead>
                          <TableHead>Email</TableHead>
                          <TableHead>Phone</TableHead>
                          <TableHead>Referral Code</TableHead>
                          <TableHead>Status</TableHead>
                          <TableHead>Earnings</TableHead>
                          <TableHead>Actions</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {partners
                          .slice((partnersPage - 1) * itemsPerPage, partnersPage * itemsPerPage)
                          .map((partner: Partner) => (
                          <TableRow key={partner.id}>
                            <TableCell className="font-medium">{partner.name}</TableCell>
                            <TableCell>{partner.email}</TableCell>
                            <TableCell>{partner.phone || "N/A"}</TableCell>
                            <TableCell>
                              <Badge variant="outline">{partner.referralCode}</Badge>
                            </TableCell>
                            <TableCell>
                              <Badge variant={partner.isApproved ? "default" : "secondary"}>
                                {partner.isApproved ? "Approved" : "Pending"}
                              </Badge>
                            </TableCell>
                            <TableCell>₹{partner.totalEarnings || 0}</TableCell>
                            <TableCell>
                              <div className="flex gap-2">
                                {!partner.isApproved && (
                                  <Button
                                    size="sm"
                                    onClick={() => approvePartner( partner.id,  true )}
                                    disabled={approveLoading}
                                  >
                                    <Check className="h-4 w-4" />
                                  </Button>
                                )}
                                <Button size="sm" variant="outline">
                                  <Eye className="h-4 w-4" />
                                </Button>
                              </div>
                            </TableCell>
                          </TableRow>
                        ))}
                      </TableBody>
                    </Table>
                  </CardContent>
                </Card>
              )}
            </TabsContent>

            <TabsContent value="transactions" className="space-y-4">
              {transactionsLoading ? (
                <div className="text-center py-8">Loading transactions...</div>
              ) : (
                <Card>
                  <CardHeader>
                    <CardTitle>Recent Transactions</CardTitle>
                    <CardDescription>Monitor payment transactions</CardDescription>
                  </CardHeader>
                  <CardContent>
                    <Table>
                      <TableHeader>
                        <TableRow>
                          <TableHead>Transaction ID</TableHead>
                          <TableHead>Amount</TableHead>
                          <TableHead>Status</TableHead>
                          <TableHead>Certificate ID</TableHead>
                          <TableHead>Date</TableHead>
                          <TableHead>Actions</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {transactions
                          .slice((transactionsPage - 1) * itemsPerPage, transactionsPage * itemsPerPage)
                          .map((transaction: Transaction) => (
                          <TableRow key={transaction.id}>
                            <TableCell className="font-medium">{transaction.transactionId}</TableCell>
                            <TableCell>₹{transaction.amount}</TableCell>
                            <TableCell>
                              <Badge variant={
                                transaction.status === "completed" ? "default" : 
                                transaction.status === "success" ? "default" : 
                                transaction.status === "pending" ? "secondary" : "destructive"
                              } className={
                                transaction.status === "completed" ? "bg-green-100 text-green-800 hover:bg-green-200" :
                                transaction.status === "success" ? "bg-green-100 text-green-800 hover:bg-green-200" : ""
                              }>
                                {transaction.status}
                              </Badge>
                            </TableCell>
                            <TableCell>{transaction.certificateId}</TableCell>
                            <TableCell>{new Date(transaction.createdAt).toLocaleDateString()}</TableCell>
                            <TableCell>
                              <Button size="sm" variant="outline">
                                <Eye className="h-4 w-4" />
                              </Button>
                            </TableCell>
                          </TableRow>
                        ))}
                      </TableBody>
                    </Table>
                    {transactions.length > itemsPerPage && (
                      <div className="flex justify-center gap-2 mt-4">
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => setTransactionsPage(Math.max(1, transactionsPage - 1))}
                          disabled={transactionsPage === 1}
                        >
                          Previous
                        </Button>
                        <span className="flex items-center px-3 text-sm">
                          Page {transactionsPage} of {Math.ceil(transactions.length / itemsPerPage)}
                        </span>
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => setTransactionsPage(Math.min(Math.ceil(transactions.length / itemsPerPage), transactionsPage + 1))}
                          disabled={transactionsPage >= Math.ceil(transactions.length / itemsPerPage)}
                        >
                          Next
                        </Button>
                      </div>
                    )}
                  </CardContent>
                </Card>
              )}
            </TabsContent>

            <TabsContent value="partners" className="space-y-4">
              {partnersLoading ? (
                <div className="text-center py-8">Loading partners...</div>
              ) : (
                <Card>
                  <CardHeader>
                    <CardTitle>Partner Management</CardTitle>
                    <CardDescription>Manage partner applications and approvals</CardDescription>
                  </CardHeader>
                  <CardContent>
                    <Table>
                      <TableHeader>
                        <TableRow>
                          <TableHead>Name</TableHead>
                          <TableHead>Email</TableHead>
                          <TableHead>Phone</TableHead>
                          <TableHead>Earnings</TableHead>
                          <TableHead>Status</TableHead>
                          <TableHead>Actions</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {partners
                          .slice((partnersPage - 1) * itemsPerPage, partnersPage * itemsPerPage)
                          .map((partner: Partner) => (
                          <TableRow key={partner.id}>
                            <TableCell className="font-medium">{partner.name}</TableCell>
                            <TableCell>{partner.email}</TableCell>
                            <TableCell>{partner.phone || "N/A"}</TableCell>
                            <TableCell>₹{partner.totalEarnings || 0}</TableCell>
                            <TableCell>
                              <Badge variant={partner.isApproved ? "default" : "secondary"}>
                                {partner.isApproved ? "Approved" : "Pending"}
                              </Badge>
                            </TableCell>
                            <TableCell>
                              <div className="flex gap-2">
                                {!partner.isApproved && (
                                  <Button size="sm" onClick={() => handleApprovePartner(partner.id)}>
                                    Approve
                                  </Button>
                                )}
                                <Button size="sm" variant="outline">
                                  <Eye className="h-4 w-4" />
                                </Button>
                              </div>
                            </TableCell>
                          </TableRow>
                        ))}
                      </TableBody>
                    </Table>
                    {partners.length > itemsPerPage && (
                      <div className="flex justify-center gap-2 mt-4">
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => setPartnersPage(Math.max(1, partnersPage - 1))}
                          disabled={partnersPage === 1}
                        >
                          Previous
                        </Button>
                        <span className="flex items-center px-3 text-sm">
                          Page {partnersPage} of {Math.ceil(partners.length / itemsPerPage)}
                        </span>
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => setPartnersPage(Math.min(Math.ceil(partners.length / itemsPerPage), partnersPage + 1))}
                          disabled={partnersPage >= Math.ceil(partners.length / itemsPerPage)}
                        >
                          Next
                        </Button>
                      </div>
                    )}
                  </CardContent>
                </Card>
              )}
            </TabsContent>

            {/* Questions Tab */}
            <TabsContent value="questions" className="space-y-4">
              <QuestionsManagement />
            </TabsContent>

            {/* AI Questions Tab */}
            <TabsContent value="ai-questions" className="space-y-4">
              <AIQuestionsManagement />
            </TabsContent>

            {/* Contact Submissions Tab */}
            <TabsContent value="contacts" className="space-y-4">
              <ContactSubmissionsManagement />
            </TabsContent>
          </Tabs>
        </div>
      </div>
    </div>
  );
}