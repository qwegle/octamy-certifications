import { useState } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import Header from "@/components/header";
import { Link, useParams } from "wouter";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { ArrowLeft, FileText, Users, Award, CheckCircle } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { queryClient } from "@/lib/queryClient";
import type { Course } from "@shared/schema";

const internshipFormSchema = z.object({
  fullName: z.string().min(2, "Full name must be at least 2 characters"),
  email: z.string().email("Please enter a valid email"),
  phone: z.string().min(10, "Please enter a valid phone number"),
  collegeName: z.string().min(2, "College name must be at least 2 characters"),
  graduationYear: z.string().min(4, "Please enter graduation year"),
  previousExperience: z.string().optional(),
  motivation: z.string().min(50, "Please write at least 50 characters about your motivation"),
  skills: z.string().min(10, "Please list your relevant skills"),
  availability: z.string().min(1, "Please select your availability"),
  portfolioLink: z.string().url().optional().or(z.literal("")),
  linkedinProfile: z.string().url().optional().or(z.literal("")),
});

type InternshipForm = z.infer<typeof internshipFormSchema>;

export default function InternshipFormPage() {
  const { slug } = useParams();
  const [step, setStep] = useState(1);
  const { toast } = useToast();

  const { data: course, isLoading } = useQuery<Course>({
    queryKey: ["/api/courses/slug", slug],
    enabled: !!slug,
  });

  const form = useForm<InternshipForm>({
    resolver: zodResolver(internshipFormSchema),
    defaultValues: {
      fullName: "",
      email: "",
      phone: "",
      collegeName: "",
      graduationYear: "",
      previousExperience: "",
      motivation: "",
      skills: "",
      availability: "",
      portfolioLink: "",
      linkedinProfile: "",
    },
  });

  const internshipMutation = useMutation({
    mutationFn: async (data: InternshipForm & { courseId: number }) => {
      const response = await fetch("/api/internship-applications", {
        method: "POST",
        body: JSON.stringify(data),
        headers: { "Content-Type": "application/json" },
      });
      
      if (!response.ok) {
        throw new Error("Failed to submit internship application");
      }
      
      return response.json();
    },
    onSuccess: (data) => {
      toast({
        title: "Application Submitted",
        description: "Your internship application has been submitted successfully!",
      });
      setStep(2);
    },
    onError: (error) => {
      toast({
        title: "Error",
        description: error.message,
        variant: "destructive",
      });
    },
  });

  const onSubmit = (data: InternshipForm) => {
    if (!course) return;
    internshipMutation.mutate({ ...data, courseId: course.id });
  };

  if (isLoading) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-black mx-auto mb-4"></div>
          <p>Loading internship details...</p>
        </div>
      </div>
    );
  }

  if (!course) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-center">
          <h1 className="text-2xl font-bold text-black mb-4">Internship Not Found</h1>
          <Link href="/">
            <Button className="bg-black text-white hover:bg-gray-800">
              Back to Home
            </Button>
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Navigation */}
      <Header />

      <div className="max-w-4xl mx-auto px-6 py-12">
        <div className="mb-8">
          <Link href={`/course/${slug}`}>
            <Button variant="outline" className="border-black text-black hover:bg-black hover:text-white mb-4">
              <ArrowLeft className="w-4 h-4 mr-2" />
              Back to Course
            </Button>
          </Link>
          <h1 className="text-4xl font-bold text-black mb-2">{course.title}</h1>
          <p className="text-gray-600">Complete your application to start your virtual internship</p>
        </div>

        {step === 1 && (
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
            {/* Application Form */}
            <div className="lg:col-span-2">
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center">
                    <FileText className="w-5 h-5 mr-2" />
                    Internship Application
                  </CardTitle>
                  <CardDescription>
                    Fill out the form below to apply for this virtual internship
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  <Form {...form}>
                    <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6">
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        <FormField
                          control={form.control}
                          name="fullName"
                          render={({ field }) => (
                            <FormItem>
                              <FormLabel>Full Name *</FormLabel>
                              <FormControl>
                                <Input placeholder="Enter your full name" {...field} />
                              </FormControl>
                              <FormMessage />
                            </FormItem>
                          )}
                        />

                        <FormField
                          control={form.control}
                          name="email"
                          render={({ field }) => (
                            <FormItem>
                              <FormLabel>Email Address *</FormLabel>
                              <FormControl>
                                <Input type="email" placeholder="your.email@example.com" {...field} />
                              </FormControl>
                              <FormMessage />
                            </FormItem>
                          )}
                        />
                      </div>

                      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        <FormField
                          control={form.control}
                          name="phone"
                          render={({ field }) => (
                            <FormItem>
                              <FormLabel>Phone Number *</FormLabel>
                              <FormControl>
                                <Input placeholder="+1 (555) 123-4567" {...field} />
                              </FormControl>
                              <FormMessage />
                            </FormItem>
                          )}
                        />

                        <FormField
                          control={form.control}
                          name="collegeName"
                          render={({ field }) => (
                            <FormItem>
                              <FormLabel>College/University *</FormLabel>
                              <FormControl>
                                <Input placeholder="Enter your college name" {...field} />
                              </FormControl>
                              <FormMessage />
                            </FormItem>
                          )}
                        />
                      </div>

                      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        <FormField
                          control={form.control}
                          name="graduationYear"
                          render={({ field }) => (
                            <FormItem>
                              <FormLabel>Graduation Year *</FormLabel>
                              <FormControl>
                                <Input placeholder="2024" {...field} />
                              </FormControl>
                              <FormMessage />
                            </FormItem>
                          )}
                        />

                        <FormField
                          control={form.control}
                          name="availability"
                          render={({ field }) => (
                            <FormItem>
                              <FormLabel>Availability *</FormLabel>
                              <FormControl>
                                <select {...field} className="w-full p-2 border border-gray-300 rounded-md">
                                  <option value="">Select availability</option>
                                  <option value="full-time">Full-time (40+ hours/week)</option>
                                  <option value="part-time">Part-time (20-30 hours/week)</option>
                                  <option value="flexible">Flexible (10-20 hours/week)</option>
                                </select>
                              </FormControl>
                              <FormMessage />
                            </FormItem>
                          )}
                        />
                      </div>

                      <FormField
                        control={form.control}
                        name="skills"
                        render={({ field }) => (
                          <FormItem>
                            <FormLabel>Relevant Skills *</FormLabel>
                            <FormControl>
                              <Textarea 
                                placeholder="List your relevant skills and technologies (e.g., Python, JavaScript, React, etc.)"
                                {...field} 
                              />
                            </FormControl>
                            <FormMessage />
                          </FormItem>
                        )}
                      />

                      <FormField
                        control={form.control}
                        name="motivation"
                        render={({ field }) => (
                          <FormItem>
                            <FormLabel>Why do you want this internship? *</FormLabel>
                            <FormControl>
                              <Textarea 
                                placeholder="Tell us about your motivation and what you hope to gain from this internship (minimum 50 characters)"
                                rows={4}
                                {...field} 
                              />
                            </FormControl>
                            <FormMessage />
                          </FormItem>
                        )}
                      />

                      <FormField
                        control={form.control}
                        name="previousExperience"
                        render={({ field }) => (
                          <FormItem>
                            <FormLabel>Previous Experience (Optional)</FormLabel>
                            <FormControl>
                              <Textarea 
                                placeholder="Describe any relevant work experience, projects, or internships"
                                {...field} 
                              />
                            </FormControl>
                            <FormMessage />
                          </FormItem>
                        )}
                      />

                      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        <FormField
                          control={form.control}
                          name="portfolioLink"
                          render={({ field }) => (
                            <FormItem>
                              <FormLabel>Portfolio URL (Optional)</FormLabel>
                              <FormControl>
                                <Input placeholder="https://yourportfolio.com" {...field} />
                              </FormControl>
                              <FormMessage />
                            </FormItem>
                          )}
                        />

                        <FormField
                          control={form.control}
                          name="linkedinProfile"
                          render={({ field }) => (
                            <FormItem>
                              <FormLabel>LinkedIn Profile (Optional)</FormLabel>
                              <FormControl>
                                <Input placeholder="https://linkedin.com/in/yourprofile" {...field} />
                              </FormControl>
                              <FormMessage />
                            </FormItem>
                          )}
                        />
                      </div>

                      <Button
                        type="submit"
                        disabled={internshipMutation.isPending}
                        className="bg-black text-white hover:bg-gray-800 w-full"
                      >
                        {internshipMutation.isPending ? "Submitting..." : "Submit Application"}
                      </Button>
                    </form>
                  </Form>
                </CardContent>
              </Card>
            </div>

            {/* Internship Details */}
            <div>
              <Card>
                <CardHeader>
                  <CardTitle>{course.title}</CardTitle>
                  <CardDescription>Virtual Internship Program</CardDescription>
                </CardHeader>
                <CardContent>
                  <div className="space-y-4">
                    <div className="flex items-center space-x-2">
                      <Award className="w-4 h-4 text-black" />
                      <span className="text-sm">Certificate upon completion</span>
                    </div>
                    <div className="flex items-center space-x-2">
                      <Users className="w-4 h-4 text-black" />
                      <span className="text-sm">Mentorship included</span>
                    </div>
                    <div className="flex items-center space-x-2">
                      <FileText className="w-4 h-4 text-black" />
                      <span className="text-sm">Real project experience</span>
                    </div>
                    
                    <div className="border-t pt-4">
                      <p className="text-lg font-bold text-black">${course.price}</p>
                      <p className="text-sm text-gray-600">One-time payment</p>
                    </div>
                  </div>
                </CardContent>
              </Card>

              <Card className="mt-6">
                <CardHeader>
                  <CardTitle>What You'll Get</CardTitle>
                </CardHeader>
                <CardContent>
                  <ul className="space-y-2 text-sm">
                    <li className="flex items-center"><CheckCircle className="w-4 h-4 mr-2 text-green-500" />Professional internship certificate</li>
                    <li className="flex items-center"><CheckCircle className="w-4 h-4 mr-2 text-green-500" />1-on-1 mentorship sessions</li>
                    <li className="flex items-center"><CheckCircle className="w-4 h-4 mr-2 text-green-500" />Real industry projects</li>
                    <li className="flex items-center"><CheckCircle className="w-4 h-4 mr-2 text-green-500" />LinkedIn recommendation</li>
                    <li className="flex items-center"><CheckCircle className="w-4 h-4 mr-2 text-green-500" />Career guidance</li>
                  </ul>
                </CardContent>
              </Card>
            </div>
          </div>
        )}

        {step === 2 && (
          <div className="text-center py-12">
            <CheckCircle className="w-16 h-16 text-green-500 mx-auto mb-6" />
            <h2 className="text-3xl font-bold text-black mb-4">Application Submitted!</h2>
            <p className="text-gray-600 mb-8 max-w-2xl mx-auto">
              Thank you for applying to the {course.title} internship. Our team will review your application and contact you within 48 hours.
            </p>
            <div className="space-x-4">
              <Link href="/">
                <Button className="bg-black text-white hover:bg-gray-800">
                  Back to Home
                </Button>
              </Link>
              <Link href={`/payment?courseId=${course.id}&type=internship`}>
                <Button variant="outline" className="border-black text-black hover:bg-black hover:text-white">
                  Proceed to Payment
                </Button>
              </Link>
            </div>
          </div>
        )}
      </div>

      {/* Footer */}
      <footer className="bg-black text-white py-12 mt-16">
        <div className="max-w-7xl mx-auto px-6">
          <div className="grid grid-cols-1 md:grid-cols-4 gap-8">
            <div>
              <h3 className="text-2xl font-bold mb-4">OCTAMY</h3>
              <p className="text-gray-400">Professional certification platform for the modern workforce.</p>
            </div>
            <div>
              <h4 className="font-semibold mb-4">Programs</h4>
              <ul className="space-y-2 text-gray-400">
                <li><Link href="/" className="hover:text-white">Virtual Internships</Link></li>
                <li><Link href="/business-certificates" className="hover:text-white">Business Certificates</Link></li>
                <li><Link href="/partners" className="hover:text-white">Partner Program</Link></li>
              </ul>
            </div>
            <div>
              <h4 className="font-semibold mb-4">Support</h4>
              <ul className="space-y-2 text-gray-400">
                <li><Link href="/help-center" className="hover:text-white">Help Center</Link></li>
                <li><Link href="/contact" className="hover:text-white">Contact Us</Link></li>
              </ul>
            </div>
            <div>
              <h4 className="font-semibold mb-4">Connect</h4>
              <p className="text-gray-400 mb-4">ISO Certified by Octamy Solutions Private Limited</p>
            </div>
          </div>
          <div className="border-t border-gray-800 mt-8 pt-8 text-center text-gray-400">
            <p>&copy; 2025 Octamy Solutions Private Limited. All rights reserved.</p>
          </div>
        </div>
      </footer>
    </div>
  );
}