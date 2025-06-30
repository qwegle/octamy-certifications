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

const technologies = [
  "JavaScript", "Python", "Java", "React", "Node.js", "SQL", "Data Science", 
  "Machine Learning", "Cybersecurity", "Cloud Computing", "DevOps"
];

export function EnhancedAIQuestionsManagement() {
  const [searchTerm, setSearchTerm] = useState("");
  const [selectedTechnology, setSelectedTechnology] = useState<string>("");
  const { toast } = useToast();

  const { data: questions = [], isLoading: questionsLoading, refetch: refetchQuestions } = useQuery({
    queryKey: ["/api/admin/interview-questions", selectedTechnology, searchTerm],
    queryFn: async () => {
      const params = new URLSearchParams();
      if (selectedTechnology && selectedTechnology !== "all") params.append('technology', selectedTechnology);
      if (searchTerm) params.append('search', searchTerm);
      const response = await apiRequest("GET", `/api/admin/interview-questions?${params}`);
      return response.json();
    }
  });

  return (
    <Card className="bg-gray-900 border-gray-800">
      <CardHeader>
        <CardTitle className="text-white">AI Interview Questions Management</CardTitle>
        <CardDescription className="text-gray-400">Manage AI-powered interview questions for different technologies</CardDescription>
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
          <Select value={selectedTechnology || "all"} onValueChange={(value) => setSelectedTechnology(value === "all" ? "" : value)}>
            <SelectTrigger className="w-[300px] bg-gray-800 border-gray-700 text-white">
              <SelectValue placeholder="Select technology" />
            </SelectTrigger>
            <SelectContent className="bg-gray-800 border-gray-700">
              <SelectItem value="all">All Technologies</SelectItem>
              {technologies.map((tech) => (
                <SelectItem key={tech} value={tech}>
                  {tech}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Button variant="outline" size="sm" className="bg-white text-black border-gray-300 hover:bg-gray-100">
            <Plus className="h-4 w-4 mr-2" />
            Add AI Question
          </Button>
        </div>
      </CardHeader>
      <CardContent>
        <div className="rounded-md border border-gray-800">
          <Table>
            <TableHeader>
              <TableRow className="border-gray-800 hover:bg-gray-800">
                <TableHead className="text-gray-300">Title</TableHead>
                <TableHead className="text-gray-300">Technology</TableHead>
                <TableHead className="text-gray-300">Type</TableHead>
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
                    No AI interview questions found
                  </TableCell>
                </TableRow>
              ) : (
                questions.map((question: any) => (
                  <TableRow key={question.id} className="border-gray-800 hover:bg-gray-800">
                    <TableCell className="text-white max-w-md">
                      <div className="font-medium">{question.title}</div>
                      <div className="text-sm text-gray-400 truncate">
                        {question.question}
                      </div>
                    </TableCell>
                    <TableCell>
                      <Badge variant="outline" className="border-gray-600 text-gray-300">
                        {question.technology}
                      </Badge>
                    </TableCell>
                    <TableCell className="text-gray-300">{question.type || 'General'}</TableCell>
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
                              title: "Edit AI Question",
                              description: `Editing: ${question.title}`,
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
                              title: "Delete AI Question", 
                              description: "AI question deletion functionality",
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