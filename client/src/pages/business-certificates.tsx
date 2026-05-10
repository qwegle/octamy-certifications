import { useState } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import Header from "@/components/header";
import { Link } from "wouter";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { ArrowLeft, Building, Users, CheckCircle, Award, TrendingUp } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { apiRequest, queryClient } from "@/lib/queryClient";
import type { Category, Course } from "@shared/schema";

const businessCertificateSchema = z.object({
  companyName: z.string().min(2, "Company name must be at least 2 characters"),
  employeeCount: z.string().min(1, "Please select employee count"),
  contactEmail: z.string().email("Please enter a valid email"),
  contactPhone: z.string().min(10, "Please enter a valid phone number"),
  industry: z.string().min(1, "Please select an industry"),
  selectedCourses: z.array(z.number()).min(1, "Please select at least one course"),
});

type BusinessCertificateForm = z.infer<typeof businessCertificateSchema>;

export default function BusinessCertificates() {
  const [step, setStep] = useState(1);
  const { toast } = useToast();

  const { data: categories = [] } = useQuery<Category[]>({
    queryKey: ["/api/categories"],
  });

  const { data: courses = [] } = useQuery<(Course & { category: Category })[]>({
    queryKey: ["/api/courses"],
  });

  const form = useForm<BusinessCertificateForm>({
    resolver: zodResolver(businessCertificateSchema),
    defaultValues: {
      companyName: "",
      employeeCount: "",
      contactEmail: "",
      contactPhone: "",
      industry: "",
      selectedCourses: [],
    },
  });

  const businessCertificateMutation = useMutation({
    mutationFn: async (data: BusinessCertificateForm) => {
      const response = await fetch("/api/business-certificates", {
        method: "POST",
        body: JSON.stringify(data),
        headers: { "Content-Type": "application/json" },
      });
      
      if (!response.ok) {
        throw new Error("Failed to submit business certificate request");
      }
      
      return response.json();
    },
    onSuccess: () => {
      toast({
        title: "Business Certificate Request Submitted",
        description: "We'll contact you within 24 hours with pricing and next steps.",
      });
      setStep(3);
    },
    onError: (error) => {
      toast({
        title: "Error",
        description: error.message,
        variant: "destructive",
      });
    },
  });

  const onSubmit = (data: BusinessCertificateForm) => {
    businessCertificateMutation.mutate(data);
  };

  const selectedCourses = courses.filter(course => 
    form.watch("selectedCourses").includes(course.id)
  );

  const totalPrice = selectedCourses.reduce((sum, course) => 
    sum + parseFloat(course.price), 0
  );

  const discountedPrice = totalPrice * 0.7; // 30% bulk discount

  return (
    <div className="min-h-screen bg-cream-deep">
      {/* Navigation */}
      <Header />

      <div className="max-w-6xl mx-auto px-6 py-12">
        <div className="mb-8">
          <Link href="/">
            <Button variant="outline" className="border-black text-black hover:bg-black hover:text-white mb-4">
              <ArrowLeft className="w-4 h-4 mr-2" />
              Back to Home
            </Button>
          </Link>
          <h1 className="text-4xl font-bold text-black mb-2">Business Certifications</h1>
          <p className="text-gray-600">Get your entire team certified with company-branded certificates and bulk pricing.</p>
        </div>

        {step === 1 && (
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
            {/* Benefits */}
            <div className="space-y-6">
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center">
                    <Building className="w-5 h-5 mr-2" />
                    Company-Branded Certificates
                  </CardTitle>
                  <CardDescription>
                    Certificates include your company name and branding
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  <ul className="space-y-2 text-sm">
                    <li className="flex items-center"><CheckCircle className="w-4 h-4 mr-2 text-green-500" />Your company name on all certificates</li>
                    <li className="flex items-center"><CheckCircle className="w-4 h-4 mr-2 text-green-500" />Professional business validation</li>
                    <li className="flex items-center"><CheckCircle className="w-4 h-4 mr-2 text-green-500" />Enhanced credibility for employees</li>
                  </ul>
                </CardContent>
              </Card>

              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center">
                    <TrendingUp className="w-5 h-5 mr-2" />
                    Bulk Pricing
                  </CardTitle>
                  <CardDescription>
                    Save up to 30% on team certifications
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  <ul className="space-y-2 text-sm">
                    <li className="flex items-center"><CheckCircle className="w-4 h-4 mr-2 text-green-500" />30% discount for 10+ employees</li>
                    <li className="flex items-center"><CheckCircle className="w-4 h-4 mr-2 text-green-500" />Volume pricing tiers available</li>
                    <li className="flex items-center"><CheckCircle className="w-4 h-4 mr-2 text-green-500" />Flexible payment terms</li>
                  </ul>
                </CardContent>
              </Card>

              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center">
                    <Users className="w-5 h-5 mr-2" />
                    Team Management
                  </CardTitle>
                  <CardDescription>
                    Track and manage team progress
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  <ul className="space-y-2 text-sm">
                    <li className="flex items-center"><CheckCircle className="w-4 h-4 mr-2 text-green-500" />Real-time progress dashboard</li>
                    <li className="flex items-center"><CheckCircle className="w-4 h-4 mr-2 text-green-500" />Performance analytics</li>
                    <li className="flex items-center"><CheckCircle className="w-4 h-4 mr-2 text-green-500" />Completion tracking</li>
                  </ul>
                </CardContent>
              </Card>
            </div>

            {/* Get Started */}
            <div>
              <Card>
                <CardHeader>
                  <CardTitle>Get Started</CardTitle>
                  <CardDescription>Tell us about your team certification needs</CardDescription>
                </CardHeader>
                <CardContent>
                  <div className="space-y-4">
                    <div className="text-center p-6 bg-cream-deep rounded-lg">
                      <Award className="w-12 h-12 text-black mx-auto mb-4" />
                      <h3 className="font-bold text-lg mb-2">Professional Team Certification</h3>
                      <p className="text-sm text-gray-600 mb-4">
                        Elevate your team's skills with industry-recognized certifications
                      </p>
                      <Button 
                        onClick={() => setStep(2)}
                        className="bg-black text-white hover:bg-gray-800"
                      >
                        Start Application
                      </Button>
                    </div>
                  </div>
                </CardContent>
              </Card>
            </div>
          </div>
        )}

        {step === 2 && (
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
            {/* Form */}
            <div className="lg:col-span-2">
              <Card>
                <CardHeader>
                  <CardTitle>Business Certificate Application</CardTitle>
                  <CardDescription>Provide your company details and course selection</CardDescription>
                </CardHeader>
                <CardContent>
                  <Form {...form}>
                    <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6">
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        <FormField
                          control={form.control}
                          name="companyName"
                          render={({ field }) => (
                            <FormItem>
                              <FormLabel>Company Name</FormLabel>
                              <FormControl>
                                <Input placeholder="Enter company name" {...field} />
                              </FormControl>
                              <FormMessage />
                            </FormItem>
                          )}
                        />

                        <FormField
                          control={form.control}
                          name="employeeCount"
                          render={({ field }) => (
                            <FormItem>
                              <FormLabel>Employee Count</FormLabel>
                              <FormControl>
                                <select {...field} className="w-full p-2 border border-gray-300 rounded-md">
                                  <option value="">Select employee count</option>
                                  <option value="10-25">10-25 employees</option>
                                  <option value="26-50">26-50 employees</option>
                                  <option value="51-100">51-100 employees</option>
                                  <option value="100+">100+ employees</option>
                                </select>
                              </FormControl>
                              <FormMessage />
                            </FormItem>
                          )}
                        />
                      </div>

                      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        <FormField
                          control={form.control}
                          name="contactEmail"
                          render={({ field }) => (
                            <FormItem>
                              <FormLabel>Contact Email</FormLabel>
                              <FormControl>
                                <Input type="email" placeholder="contact@company.com" {...field} />
                              </FormControl>
                              <FormMessage />
                            </FormItem>
                          )}
                        />

                        <FormField
                          control={form.control}
                          name="contactPhone"
                          render={({ field }) => (
                            <FormItem>
                              <FormLabel>Contact Phone</FormLabel>
                              <FormControl>
                                <Input placeholder="+1 (555) 123-4567" {...field} />
                              </FormControl>
                              <FormMessage />
                            </FormItem>
                          )}
                        />
                      </div>

                      <FormField
                        control={form.control}
                        name="industry"
                        render={({ field }) => (
                          <FormItem>
                            <FormLabel>Industry</FormLabel>
                            <FormControl>
                              <select {...field} className="w-full p-2 border border-gray-300 rounded-md">
                                <option value="">Select industry</option>
                                <option value="technology">Technology</option>
                                <option value="finance">Finance</option>
                                <option value="healthcare">Healthcare</option>
                                <option value="education">Education</option>
                                <option value="manufacturing">Manufacturing</option>
                                <option value="other">Other</option>
                              </select>
                            </FormControl>
                            <FormMessage />
                          </FormItem>
                        )}
                      />

                      <div>
                        <FormLabel>Select Courses</FormLabel>
                        <div className="mt-2 space-y-2 max-h-64 overflow-y-auto border border-cream-deep rounded-md p-4">
                          {courses.map((course) => (
                            <label key={course.id} className="flex items-center space-x-3 cursor-pointer">
                              <input
                                type="checkbox"
                                checked={form.watch("selectedCourses").includes(course.id)}
                                onChange={(e) => {
                                  const currentCourses = form.getValues("selectedCourses");
                                  if (e.target.checked) {
                                    form.setValue("selectedCourses", [...currentCourses, course.id]);
                                  } else {
                                    form.setValue("selectedCourses", currentCourses.filter(id => id !== course.id));
                                  }
                                }}
                                className="rounded border-gray-300"
                              />
                              <div className="flex-1">
                                <span className="font-medium">{course.title}</span>
                                <Badge variant="outline" className="ml-2">{course.category.name}</Badge>
                                <span className="block text-sm text-gray-600">₹{course.price}</span>
                              </div>
                            </label>
                          ))}
                        </div>
                        {form.formState.errors.selectedCourses && (
                          <p className="text-sm text-red-600 mt-1">
                            {form.formState.errors.selectedCourses.message}
                          </p>
                        )}
                      </div>

                      <Button
                        type="submit"
                        disabled={businessCertificateMutation.isPending}
                        className="bg-black text-white hover:bg-gray-800"
                      >
                        {businessCertificateMutation.isPending ? "Submitting..." : "Submit Application"}
                      </Button>
                    </form>
                  </Form>
                </CardContent>
              </Card>
            </div>

            {/* Summary */}
            <div>
              <Card>
                <CardHeader>
                  <CardTitle>Order Summary</CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="space-y-3">
                    <div className="text-sm">
                      <p className="font-medium">Selected Courses: {selectedCourses.length}</p>
                      {selectedCourses.map((course) => (
                        <div key={course.id} className="flex justify-between mt-1">
                          <span className="text-gray-600">{course.title}</span>
                          <span>₹{course.price}</span>
                        </div>
                      ))}
                    </div>
                    
                    {selectedCourses.length > 0 && (
                      <>
                        <div className="border-t pt-3">
                          <div className="flex justify-between">
                            <span>Subtotal:</span>
                            <span>₹{totalPrice.toFixed(2)}</span>
                          </div>
                          <div className="flex justify-between text-green-600">
                            <span>Bulk Discount (30%):</span>
                            <span>-₹{(totalPrice - discountedPrice).toFixed(2)}</span>
                          </div>
                          <div className="flex justify-between font-bold text-lg border-t pt-2">
                            <span>Total:</span>
                            <span>₹{discountedPrice.toFixed(2)}</span>
                          </div>
                        </div>
                        
                        <div className="text-xs text-gray-500 mt-4">
                          * Final pricing may vary based on team size and customization requirements
                        </div>
                      </>
                    )}
                  </div>
                </CardContent>
              </Card>
            </div>
          </div>
        )}

        {step === 3 && (
          <div className="text-center py-12">
            <CheckCircle className="w-16 h-16 text-green-500 mx-auto mb-6" />
            <h2 className="text-3xl font-bold text-black mb-4">Application Submitted Successfully!</h2>
            <p className="text-gray-600 mb-8 max-w-2xl mx-auto">
              Thank you for your interest in our business certification program. Our team will review your application and contact you within 24 hours with a customized proposal and next steps.
            </p>
            <div className="space-x-4">
              <Link href="/">
                <Button className="bg-black text-white hover:bg-gray-800">
                  Back to Home
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
              <h4 className="font-semibold mb-4">Business Solutions</h4>
              <ul className="space-y-2 text-gray-400">
                <li><Link href="/business-certificates" className="hover:text-white">Team Certifications</Link></li>
                <li><Link href="/business-certificates" className="hover:text-white">Bulk Pricing</Link></li>
                <li><Link href="/business-certificates" className="hover:text-white">Custom Programs</Link></li>
              </ul>
            </div>
            <div>
              <h4 className="font-semibold mb-4">Support</h4>
              <ul className="space-y-2 text-gray-400">
                <li><Link href="/help-center" className="hover:text-white">Help Center</Link></li>
                <li><Link href="/contact" className="hover:text-white">Contact Sales</Link></li>
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