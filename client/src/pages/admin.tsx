import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Badge } from '@/components/ui/badge';
import { useToast } from '@/hooks/use-toast';
import { useAuth } from '@/lib/auth.tsx';
import { apiRequest } from '@/lib/queryClient';
import Header from '@/components/header';
import Footer from '@/components/footer';
import { 
  Plus, 
  Edit, 
  Trash2, 
  Eye, 
  Users, 
  BookOpen, 
  HelpCircle, 
  Award,
  Settings,
  AlertCircle
} from 'lucide-react';
import type { Course, Category, Question } from '@shared/schema';

export default function Admin() {
  const { user, token } = useAuth();
  const { toast } = useToast();
  const queryClient = useQueryClient();
  
  const [activeTab, setActiveTab] = useState<'courses' | 'questions' | 'certificates' | 'users'>('courses');
  const [selectedCourse, setSelectedCourse] = useState<number | null>(null);
  const [showAddCourse, setShowAddCourse] = useState(false);
  const [showAddQuestion, setShowAddQuestion] = useState(false);
  
  const [newCourse, setNewCourse] = useState({
    title: '',
    description: '',
    categoryId: '',
    duration: 15,
    passingScore: 50,
    price: '199.00',
    subjects: [] as string[], // For multi-subject exams
  });
  
  const [subjectInput, setSubjectInput] = useState(''); // Temp input for adding subjects
  
  const [newQuestion, setNewQuestion] = useState({
    courseId: selectedCourse || 0,
    question: '',
    options: ['', '', '', ''],
    correctAnswer: 0,
    subject: '', // Subject assignment for multi-subject exams
  });

  // Check if user is admin
  if (!user?.isAdmin) {
    return (
      <div className="min-h-screen bg-white">
        <Header />
        <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-12">
          <Card>
            <CardContent className="text-center py-12">
              <AlertCircle className="w-16 h-16 text-red-500 mx-auto mb-4" />
              <h2 className="text-2xl font-bold text-premcq-black mb-2">Access Denied</h2>
              <p className="text-premcq-gray-600">
                You don't have permission to access the admin panel.
              </p>
            </CardContent>
          </Card>
        </div>
        <Footer />
      </div>
    );
  }

  // Queries
  const { data: categories = [] } = useQuery<Category[]>({
    queryKey: ['/api/categories'],
  });

  const { data: courses = [] } = useQuery<Course[]>({
    queryKey: ['/api/admin/courses'],
    queryFn: async () => {
      const response = await fetch('/api/admin/courses', {
        headers: {
          'Authorization': `Bearer ${token}`,
        },
      });
      if (!response.ok) throw new Error('Failed to fetch courses');
      return response.json();
    },
  });

  const { data: questions = [] } = useQuery<Question[]>({
    queryKey: ['/api/admin/questions', selectedCourse],
    enabled: !!selectedCourse,
    queryFn: async () => {
      const response = await fetch(`/api/admin/questions/${selectedCourse}`, {
        headers: {
          'Authorization': `Bearer ${token}`,
        },
      });
      if (!response.ok) throw new Error('Failed to fetch questions');
      return response.json();
    },
  });

  // Mutations
  const createCourseMutation = useMutation({
    mutationFn: async (courseData: any) => {
      const response = await fetch('/api/admin/courses', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`,
        },
        body: JSON.stringify(courseData),
      });
      if (!response.ok) throw new Error('Failed to create course');
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/admin/courses'] });
      setShowAddCourse(false);
      setNewCourse({
        title: '',
        description: '',
        categoryId: '',
        duration: 15,
        passingScore: 50,
        price: '199.00',
        subjects: [], // Include subjects in reset
      });
      toast({
        title: "Success",
        description: "Course created successfully.",
      });
    },
    onError: () => {
      toast({
        title: "Error",
        description: "Failed to create course.",
        variant: "destructive",
      });
    },
  });

  const createQuestionMutation = useMutation({
    mutationFn: async (questionData: any) => {
      const response = await fetch('/api/admin/questions', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`,
        },
        body: JSON.stringify(questionData),
      });
      if (!response.ok) throw new Error('Failed to create question');
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/admin/questions', selectedCourse] });
      setShowAddQuestion(false);
      setNewQuestion({
        courseId: selectedCourse || 0,
        question: '',
        options: ['', '', '', ''],
        correctAnswer: 0,
        subject: '', // Include subject in reset
      });
      toast({
        title: "Success",
        description: "Question created successfully.",
      });
    },
    onError: () => {
      toast({
        title: "Error",
        description: "Failed to create question.",
        variant: "destructive",
      });
    },
  });

  const handleCreateCourse = () => {
    if (!newCourse.title || !newCourse.description || !newCourse.categoryId) {
      toast({
        title: "Validation Error",
        description: "Please fill in all required fields.",
        variant: "destructive",
      });
      return;
    }

    createCourseMutation.mutate({
      title: newCourse.title,
      description: newCourse.description,
      categoryId: parseInt(newCourse.categoryId),
      duration: newCourse.duration,
      passingScore: newCourse.passingScore,
      price: newCourse.price,
      subjects: newCourse.subjects.length > 0 ? newCourse.subjects : null, // Include subjects if provided
      isActive: true
    });
  };

  const handleCreateQuestion = () => {
    if (!newQuestion.question || newQuestion.options.some(opt => !opt.trim())) {
      toast({
        title: "Validation Error",
        description: "Please fill in the question and all options.",
        variant: "destructive",
      });
      return;
    }

    // Check if course has subjects and subject is required
    const selectedCourseData = courses.find(c => c.id === selectedCourse);
    const hasSubjects = selectedCourseData?.subjects && Array.isArray(selectedCourseData.subjects) && selectedCourseData.subjects.length > 0;
    
    if (hasSubjects && !newQuestion.subject) {
      toast({
        title: "Validation Error",
        description: "Please select a subject for this question.",
        variant: "destructive",
      });
      return;
    }

    createQuestionMutation.mutate({
      courseId: selectedCourse,
      question: newQuestion.question,
      options: newQuestion.options,
      correctAnswer: newQuestion.correctAnswer,
      subject: newQuestion.subject || null, // Include subject if provided
      isActive: true
    });
  };

  const handleQuestionOptionChange = (index: number, value: string) => {
    setNewQuestion(prev => ({
      ...prev,
      options: prev.options.map((opt, i) => i === index ? value : opt)
    }));
  };

  return (
    <div className="min-h-screen bg-white">
      <Header />
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-12">
        <div className="mb-8">
          <h1 className="text-4xl font-bold text-premcq-black mb-2">Admin Dashboard</h1>
          <p className="text-xl text-premcq-gray-600">
            Manage courses, questions, certificates, and users
          </p>
        </div>

        {/* Navigation Tabs */}
        <div className="mb-8">
          <nav className="flex space-x-8 border-b border-premcq-gray-200">
            <button
              onClick={() => setActiveTab('courses')}
              className={`py-4 px-1 border-b-2 font-medium text-sm ${
                activeTab === 'courses'
                  ? 'border-premcq-black text-premcq-black'
                  : 'border-transparent text-premcq-gray-500 hover:text-premcq-gray-700 hover:border-premcq-gray-300'
              }`}
            >
              <BookOpen className="w-4 h-4 inline mr-2" />
              Courses
            </button>
            <button
              onClick={() => setActiveTab('questions')}
              className={`py-4 px-1 border-b-2 font-medium text-sm ${
                activeTab === 'questions'
                  ? 'border-premcq-black text-premcq-black'
                  : 'border-transparent text-premcq-gray-500 hover:text-premcq-gray-700 hover:border-premcq-gray-300'
              }`}
            >
              <HelpCircle className="w-4 h-4 inline mr-2" />
              Questions
            </button>
            <button
              onClick={() => setActiveTab('certificates')}
              className={`py-4 px-1 border-b-2 font-medium text-sm ${
                activeTab === 'certificates'
                  ? 'border-premcq-black text-premcq-black'
                  : 'border-transparent text-premcq-gray-500 hover:text-premcq-gray-700 hover:border-premcq-gray-300'
              }`}
            >
              <Award className="w-4 h-4 inline mr-2" />
              Certificates
            </button>
            <button
              onClick={() => setActiveTab('users')}
              className={`py-4 px-1 border-b-2 font-medium text-sm ${
                activeTab === 'users'
                  ? 'border-premcq-black text-premcq-black'
                  : 'border-transparent text-premcq-gray-500 hover:text-premcq-gray-700 hover:border-premcq-gray-300'
              }`}
            >
              <Users className="w-4 h-4 inline mr-2" />
              Users
            </button>
          </nav>
        </div>

        {/* Courses Tab */}
        {activeTab === 'courses' && (
          <div className="space-y-6">
            <div className="flex justify-between items-center">
              <h2 className="text-2xl font-bold text-premcq-black">Manage Courses</h2>
              <Button
                onClick={() => setShowAddCourse(true)}
                className="bg-premcq-black text-white hover:bg-premcq-gray-800"
              >
                <Plus className="w-4 h-4 mr-2" />
                Add Course
              </Button>
            </div>

            {showAddCourse && (
              <Card>
                <CardHeader>
                  <CardTitle>Add New Course</CardTitle>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div>
                      <Label htmlFor="title">Course Title *</Label>
                      <Input
                        id="title"
                        value={newCourse.title}
                        onChange={(e) => setNewCourse(prev => ({ ...prev, title: e.target.value }))}
                        placeholder="Enter course title"
                      />
                    </div>
                    <div>
                      <Label htmlFor="category">Category *</Label>
                      <Select
                        value={newCourse.categoryId}
                        onValueChange={(value) => setNewCourse(prev => ({ ...prev, categoryId: value }))}
                      >
                        <SelectTrigger>
                          <SelectValue placeholder="Select category" />
                        </SelectTrigger>
                        <SelectContent>
                          {categories.map((category) => (
                            <SelectItem key={category.id} value={category.id.toString()}>
                              {category.name}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                  </div>
                  
                  <div>
                    <Label htmlFor="description">Description *</Label>
                    <Textarea
                      id="description"
                      value={newCourse.description}
                      onChange={(e) => setNewCourse(prev => ({ ...prev, description: e.target.value }))}
                      placeholder="Enter course description"
                      rows={3}
                    />
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                    <div>
                      <Label htmlFor="duration">Duration (minutes)</Label>
                      <Input
                        id="duration"
                        type="number"
                        value={newCourse.duration}
                        onChange={(e) => setNewCourse(prev => ({ ...prev, duration: parseInt(e.target.value) }))}
                        min="5"
                        max="120"
                      />
                    </div>
                    <div>
                      <Label htmlFor="passingScore">Passing Score (%)</Label>
                      <Input
                        id="passingScore"
                        type="number"
                        value={newCourse.passingScore}
                        onChange={(e) => setNewCourse(prev => ({ ...prev, passingScore: parseInt(e.target.value) }))}
                        min="0"
                        max="100"
                      />
                    </div>
                    <div>
                      <Label htmlFor="price">Price (₹)</Label>
                      <Input
                        id="price"
                        value={newCourse.price}
                        onChange={(e) => setNewCourse(prev => ({ ...prev, price: e.target.value }))}
                        placeholder="199.00"
                      />
                    </div>
                  </div>

                  {/* Multi-Subject Exam Configuration */}
                  <div className="space-y-3">
                    <Label>Exam Subjects (Optional - For Government Style Multi-Subject Exams)</Label>
                    <p className="text-sm text-gray-600">Add subjects like English, Math, GK, Current Affairs for sectional exams</p>
                    
                    <div className="flex gap-2">
                      <Input
                        value={subjectInput}
                        onChange={(e) => setSubjectInput(e.target.value)}
                        placeholder="e.g., English, Math, General Knowledge"
                        onKeyPress={(e) => {
                          if (e.key === 'Enter' && subjectInput.trim()) {
                            e.preventDefault();
                            setNewCourse(prev => ({
                              ...prev,
                              subjects: [...prev.subjects, subjectInput.trim()]
                            }));
                            setSubjectInput('');
                          }
                        }}
                      />
                      <Button
                        type="button"
                        onClick={() => {
                          if (subjectInput.trim()) {
                            setNewCourse(prev => ({
                              ...prev,
                              subjects: [...prev.subjects, subjectInput.trim()]
                            }));
                            setSubjectInput('');
                          }
                        }}
                        variant="outline"
                        className="whitespace-nowrap"
                      >
                        <Plus className="w-4 h-4 mr-1" />
                        Add Subject
                      </Button>
                    </div>

                    {newCourse.subjects.length > 0 && (
                      <div className="flex flex-wrap gap-2 mt-2">
                        {newCourse.subjects.map((subject, index) => (
                          <div
                            key={index}
                            className="bg-gray-100 px-3 py-1 rounded-md flex items-center gap-2"
                          >
                            <span className="text-sm font-medium">{subject}</span>
                            <button
                              type="button"
                              onClick={() => {
                                setNewCourse(prev => ({
                                  ...prev,
                                  subjects: prev.subjects.filter((_, i) => i !== index)
                                }));
                              }}
                              className="text-red-600 hover:text-red-800"
                            >
                              <Trash2 className="w-3 h-3" />
                            </button>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>

                  <div className="flex gap-4">
                    <Button
                      onClick={handleCreateCourse}
                      disabled={createCourseMutation.isPending}
                      className="bg-premcq-black text-white hover:bg-premcq-gray-800"
                    >
                      {createCourseMutation.isPending ? 'Creating...' : 'Create Course'}
                    </Button>
                    <Button
                      variant="outline"
                      onClick={() => setShowAddCourse(false)}
                    >
                      Cancel
                    </Button>
                  </div>
                </CardContent>
              </Card>
            )}

            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
              {courses.map((course) => (
                <Card key={course.id}>
                  <CardHeader>
                    <CardTitle className="text-lg">{course.title}</CardTitle>
                    <Badge variant={course.isActive ? "default" : "secondary"}>
                      {course.isActive ? 'Active' : 'Inactive'}
                    </Badge>
                  </CardHeader>
                  <CardContent className="space-y-3">
                    <p className="text-sm text-premcq-gray-600">{course.description}</p>
                    <div className="flex justify-between text-sm">
                      <span>Duration: {course.duration}m</span>
                      <span>Price: ₹{course.price}</span>
                    </div>
                    <div className="flex gap-2">
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() => {
                          setSelectedCourse(course.id);
                          setActiveTab('questions');
                        }}
                      >
                        <Eye className="w-4 h-4 mr-1" />
                        Questions
                      </Button>
                      <Button
                        size="sm"
                        variant="outline"
                      >
                        <Edit className="w-4 h-4 mr-1" />
                        Edit
                      </Button>
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          </div>
        )}

        {/* Questions Tab */}
        {activeTab === 'questions' && (
          <div className="space-y-6">
            <div className="flex justify-between items-center">
              <h2 className="text-2xl font-bold text-premcq-black">Manage Questions</h2>
              <div className="flex gap-4">
                <Select
                  value={selectedCourse?.toString() || ''}
                  onValueChange={(value) => setSelectedCourse(parseInt(value))}
                >
                  <SelectTrigger className="w-[200px]">
                    <SelectValue placeholder="Select course" />
                  </SelectTrigger>
                  <SelectContent>
                    {courses.map((course) => (
                      <SelectItem key={course.id} value={course.id.toString()}>
                        {course.title}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                {selectedCourse && (
                  <Button
                    onClick={() => setShowAddQuestion(true)}
                    className="bg-premcq-black text-white hover:bg-premcq-gray-800"
                  >
                    <Plus className="w-4 h-4 mr-2" />
                    Add Question
                  </Button>
                )}
              </div>
            </div>

            {showAddQuestion && selectedCourse && (
              <Card>
                <CardHeader>
                  <CardTitle>Add New Question</CardTitle>
                </CardHeader>
                <CardContent className="space-y-4">
                  {/* Subject Selection - Only shown for multi-subject courses */}
                  {(() => {
                    const selectedCourseData = courses.find(c => c.id === selectedCourse);
                    const hasSubjects = selectedCourseData?.subjects && Array.isArray(selectedCourseData.subjects) && selectedCourseData.subjects.length > 0;
                    
                    if (hasSubjects) {
                      return (
                        <div>
                          <Label htmlFor="subject">Subject * (Required for multi-subject exam)</Label>
                          <Select
                            value={newQuestion.subject}
                            onValueChange={(value) => setNewQuestion(prev => ({ ...prev, subject: value }))}
                          >
                            <SelectTrigger>
                              <SelectValue placeholder="Select subject" />
                            </SelectTrigger>
                            <SelectContent>
                              {selectedCourseData.subjects?.map((subject: string) => (
                                <SelectItem key={subject} value={subject}>
                                  {subject}
                                </SelectItem>
                              ))}
                            </SelectContent>
                          </Select>
                          <p className="text-xs text-gray-600 mt-1">
                            This question will appear in the "{newQuestion.subject || 'selected'}" section during the exam
                          </p>
                        </div>
                      );
                    }
                    return null;
                  })()}

                  <div>
                    <Label htmlFor="question">Question *</Label>
                    <Textarea
                      id="question"
                      value={newQuestion.question}
                      onChange={(e) => setNewQuestion(prev => ({ ...prev, question: e.target.value }))}
                      placeholder="Enter the question"
                      rows={3}
                    />
                  </div>

                  <div className="space-y-3">
                    <Label>Answer Options *</Label>
                    {newQuestion.options.map((option, index) => (
                      <div key={index} className="flex items-center gap-3">
                        <div className="flex items-center">
                          <input
                            type="radio"
                            id={`option-${index}`}
                            name="correctAnswer"
                            checked={newQuestion.correctAnswer === index}
                            onChange={() => setNewQuestion(prev => ({ ...prev, correctAnswer: index }))}
                            className="mr-2"
                          />
                          <Label htmlFor={`option-${index}`} className="text-sm">
                            {String.fromCharCode(65 + index)}.
                          </Label>
                        </div>
                        <Input
                          value={option}
                          onChange={(e) => handleQuestionOptionChange(index, e.target.value)}
                          placeholder={`Option ${String.fromCharCode(65 + index)}`}
                          className="flex-1"
                        />
                      </div>
                    ))}
                    <p className="text-sm text-premcq-gray-500">
                      Select the correct answer by clicking the radio button
                    </p>
                  </div>

                  <div className="flex gap-4">
                    <Button
                      onClick={handleCreateQuestion}
                      disabled={createQuestionMutation.isPending}
                      className="bg-premcq-black text-white hover:bg-premcq-gray-800"
                    >
                      {createQuestionMutation.isPending ? 'Creating...' : 'Create Question'}
                    </Button>
                    <Button
                      variant="outline"
                      onClick={() => setShowAddQuestion(false)}
                    >
                      Cancel
                    </Button>
                  </div>
                </CardContent>
              </Card>
            )}

            {selectedCourse && (
              <div className="space-y-4">
                <h3 className="text-lg font-semibold text-premcq-black">
                  Questions for: {courses.find(c => c.id === selectedCourse)?.title}
                </h3>
                {questions.length === 0 ? (
                  <Card>
                    <CardContent className="text-center py-12">
                      <HelpCircle className="w-16 h-16 text-premcq-gray-400 mx-auto mb-4" />
                      <h3 className="text-xl font-bold text-premcq-black mb-2">No Questions Yet</h3>
                      <p className="text-premcq-gray-600">
                        This course doesn't have any questions. Add some to get started.
                      </p>
                    </CardContent>
                  </Card>
                ) : (
                  <div className="space-y-4">
                    {questions.map((question, index) => (
                      <Card key={question.id}>
                        <CardHeader>
                          <CardTitle className="text-lg">Question {index + 1}</CardTitle>
                        </CardHeader>
                        <CardContent className="space-y-3">
                          <p className="font-medium">{question.question}</p>
                          <div className="space-y-2">
                            {question.options.map((option, optIndex) => (
                              <div
                                key={optIndex}
                                className={`p-2 rounded border ${
                                  optIndex === question.correctAnswer
                                    ? 'bg-green-50 border-green-200 text-green-800'
                                    : 'bg-premcq-gray-50 border-premcq-gray-200'
                                }`}
                              >
                                <span className="font-medium mr-2">
                                  {String.fromCharCode(65 + optIndex)}.
                                </span>
                                {option}
                                {optIndex === question.correctAnswer && (
                                  <Badge className="ml-2 bg-green-100 text-green-800">Correct</Badge>
                                )}
                              </div>
                            ))}
                          </div>
                          <div className="flex gap-2 pt-2">
                            <Button size="sm" variant="outline">
                              <Edit className="w-4 h-4 mr-1" />
                              Edit
                            </Button>
                            <Button size="sm" variant="outline">
                              <Trash2 className="w-4 h-4 mr-1" />
                              Delete
                            </Button>
                          </div>
                        </CardContent>
                      </Card>
                    ))}
                  </div>
                )}
              </div>
            )}
          </div>
        )}

        {/* Certificates Tab */}
        {activeTab === 'certificates' && (
          <div className="space-y-6">
            <h2 className="text-2xl font-bold text-premcq-black">Certificate Management</h2>
            <Card>
              <CardContent className="text-center py-12">
                <Award className="w-16 h-16 text-premcq-gray-400 mx-auto mb-4" />
                <h3 className="text-xl font-bold text-premcq-black mb-2">Certificate Management</h3>
                <p className="text-premcq-gray-600">
                  Certificate management features will be available here. This includes viewing all issued certificates, revoking certificates, and managing renewals.
                </p>
              </CardContent>
            </Card>
          </div>
        )}

        {/* Users Tab */}
        {activeTab === 'users' && (
          <div className="space-y-6">
            <h2 className="text-2xl font-bold text-premcq-black">User Management</h2>
            <Card>
              <CardContent className="text-center py-12">
                <Users className="w-16 h-16 text-premcq-gray-400 mx-auto mb-4" />
                <h3 className="text-xl font-bold text-premcq-black mb-2">User Management</h3>
                <p className="text-premcq-gray-600">
                  User management features will be available here. This includes viewing user statistics, managing user accounts, and reviewing user activity.
                </p>
              </CardContent>
            </Card>
          </div>
        )}
      </div>
      <Footer />
    </div>
  );
}
