import { useState } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Search, Eye, Mail } from "lucide-react";
import { useQuery } from "@tanstack/react-query";
import { apiRequest } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { format } from "date-fns";

export function EnhancedContactSubmissionsManagement() {
  const [searchTerm, setSearchTerm] = useState("");
  const { toast } = useToast();

  const { data: contactSubmissions = [], isLoading: contactsLoading } = useQuery({
    queryKey: ["/api/admin/contact-submissions"],
    queryFn: async () => {
      const response = await apiRequest("GET", "/api/admin/contact-submissions");
      return response.json();
    }
  });

  const filteredContacts = contactSubmissions.filter((contact: any) => 
    !searchTerm || 
    contact.name?.toLowerCase().includes(searchTerm.toLowerCase()) ||
    contact.email?.toLowerCase().includes(searchTerm.toLowerCase()) ||
    contact.subject?.toLowerCase().includes(searchTerm.toLowerCase())
  );

  return (
    <Card className="bg-gray-900 border-gray-800">
      <CardHeader>
        <CardTitle className="text-white">Contact Submissions Management</CardTitle>
        <CardDescription className="text-gray-400">Manage customer inquiries and contact form submissions</CardDescription>
        <div className="flex items-center space-x-2 mt-4">
          <div className="relative flex-1 max-w-sm">
            <Search className="absolute left-2 top-2.5 h-4 w-4 text-gray-400" />
            <Input
              placeholder="Search contacts..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="pl-8 bg-gray-800 border-gray-700 text-white"
            />
          </div>
        </div>
      </CardHeader>
      <CardContent>
        <div className="rounded-md border border-gray-800">
          <Table>
            <TableHeader>
              <TableRow className="border-gray-800 hover:bg-gray-800">
                <TableHead className="text-gray-300">ID</TableHead>
                <TableHead className="text-gray-300">Name</TableHead>
                <TableHead className="text-gray-300">Email</TableHead>
                <TableHead className="text-gray-300">Subject</TableHead>
                <TableHead className="text-gray-300">Message</TableHead>
                <TableHead className="text-gray-300">Status</TableHead>
                <TableHead className="text-gray-300">Submitted</TableHead>
                <TableHead className="text-gray-300">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {contactsLoading ? (
                <TableRow className="border-gray-800">
                  <TableCell colSpan={8} className="text-center py-8">
                    <div className="animate-spin w-8 h-8 border-4 border-white border-t-transparent rounded-full mx-auto" />
                  </TableCell>
                </TableRow>
              ) : filteredContacts.length === 0 ? (
                <TableRow className="border-gray-800">
                  <TableCell colSpan={8} className="text-center py-8 text-gray-400">
                    No contact submissions found
                  </TableCell>
                </TableRow>
              ) : (
                filteredContacts.map((contact: any) => (
                  <TableRow key={contact.id} className="border-gray-800 hover:bg-gray-800">
                    <TableCell className="font-mono text-sm text-white">{contact.id}</TableCell>
                    <TableCell className="text-white">{contact.name}</TableCell>
                    <TableCell className="text-gray-300">{contact.email}</TableCell>
                    <TableCell className="text-white font-medium">{contact.subject}</TableCell>
                    <TableCell className="text-gray-300 max-w-xs truncate">{contact.message}</TableCell>
                    <TableCell>
                      <Badge variant={
                        contact.status === 'responded' ? "default" : 
                        contact.status === 'read' ? "secondary" : "destructive"
                      } className={
                        contact.status === 'responded' ? "bg-slate-600" :
                        contact.status === 'read' ? "bg-slate-600" : "bg-gray-600"
                      }>
                        {contact.status || 'unread'}
                      </Badge>
                    </TableCell>
                    <TableCell className="text-gray-300">
                      {contact.submittedAt ? format(new Date(contact.submittedAt), 'MMM dd, yyyy HH:mm') : 'N/A'}
                    </TableCell>
                    <TableCell>
                      <div className="flex space-x-1">
                        <Button 
                          variant="ghost" 
                          size="sm" 
                          className="text-slate-400 hover:text-slate-300 hover:bg-gray-800"
                          onClick={() => {
                            toast({
                              title: "View Contact",
                              description: `Viewing submission from ${contact.name}`,
                            });
                          }}
                        >
                          <Eye className="w-4 h-4" />
                        </Button>
                        <Button 
                          variant="ghost" 
                          size="sm" 
                          className="text-slate-400 hover:text-slate-300 hover:bg-gray-800"
                          onClick={() => {
                            toast({
                              title: "Reply to Contact",
                              description: `Replying to ${contact.email}`,
                            });
                          }}
                        >
                          <Mail className="w-4 h-4" />
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
