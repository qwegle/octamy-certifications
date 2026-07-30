import { SEO } from "@/components/seo";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from "@/components/ui/accordion";
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { useLocation } from "wouter";
import { HelpCircle, Mail, Phone, MessageCircle, Send } from "lucide-react";
import { useEffect } from "react";
import octamyLogoDark from "@/assets/image_1750054456482.png";
import octamyLogoLight from "@/assets/image_1750054465427.png";
import { Link } from "wouter";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { apiRequest } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
const contactFormSchema = z.object({
  name: z.string().min(2, "Name must be at least 2 characters"),
  email: z.string().email("Please enter a valid email address"),
  phone: z.string().min(10, "Phone number must be at least 10 digits").optional(),
  subject: z.string().min(5, "Subject must be at least 5 characters"),
  message: z.string().min(10, "Message must be at least 10 characters"),
});

type ContactFormData = z.infer<typeof contactFormSchema>;

export default function HelpCenter() {
  const [, setLocation] = useLocation();
  const { toast } = useToast();
  const queryClient = useQueryClient();

  // Tawk.to Live Chat Integration
  useEffect(() => {
    // Load Tawk.to script
    const script = document.createElement('script');
    script.async = true;
    script.src = 'https://embed.tawk.to/677bb8032ac3b11ea8c4a0f2/1igcq60ce';
    script.charset = 'UTF-8';
    script.setAttribute('crossorigin', '*');
    
    // Add script to document head
    document.head.appendChild(script);

    // Initialize Tawk.to API when loaded
    script.onload = () => {
      (window as any).Tawk_API = (window as any).Tawk_API || {};
      (window as any).Tawk_LoadStart = new Date();
    };

    // Clean up function
    return () => {
      if (document.head.contains(script)) {
        document.head.removeChild(script);
      }
      // Remove Tawk.to widget if it exists
      if ((window as any).Tawk_API) {
        try {
          (window as any).Tawk_API.hideWidget();
        } catch (e) {
          console.log('Tawk.to cleanup error:', e);
        }
      }
    };
  }, []);

  // Function to open live chat
  const openLiveChat = () => {
    if ((window as any).Tawk_API && (window as any).Tawk_API.maximize) {
      (window as any).Tawk_API.maximize();
    } else {
      // Fallback if Tawk.to is not loaded yet
      toast({
        title: "Live Chat Loading",
        description: "Please wait a moment for the chat widget to load.",
      });
      setTimeout(() => {
        if ((window as any).Tawk_API && (window as any).Tawk_API.maximize) {
          (window as any).Tawk_API.maximize();
        }
      }, 1000);
    }
  };

  const form = useForm<ContactFormData>({
    resolver: zodResolver(contactFormSchema),
    defaultValues: {
      name: "",
      email: "",
      phone: "",
      subject: "",
      message: "",
    },
  });

  const contactMutation = useMutation({
    mutationFn: (data: ContactFormData) =>
      apiRequest("POST", "/api/contact-submission", data),
    onSuccess: () => {
      toast({
        title: "Message Sent!",
        description: "We've received your message and will get back to you soon.",
      });
      form.reset();
    },
    onError: (error: any) => {
      toast({
        title: "Error",
        description: error.message || "Failed to send message. Please try again.",
        variant: "destructive",
      });
    },
  });

  const onSubmit = (data: ContactFormData) => {
    contactMutation.mutate(data);
  };

  const faqs = [
    {
      question: "How do I start taking an assessment?",
      answer:
        "Browse our courses, select the one you're interested in, and click 'Start Assessment'. You'll need to create an account or sign in first.",
    },
    {
      question: "What happens if I don't pass the assessment?",
      answer:
        "You are not charged for a failed attempt. Retake limits and availability depend on the assessment; check the instructions shown before starting. A credential is available only after a passing result and optional activation.",
    },
    {
      question: "How long are the certificates valid?",
      answer:
        "Each credential has an expiry date shown on both the record and verification page. The live check distinguishes active, expired, revoked and unactivated records.",
    },
    {
      question: "Can I get a refund if I'm not satisfied?",
      answer:
        "Because assessments are free and payment occurs only after passing, activated credentials are generally final. Genuine duplicate-payment or technical-delivery issues can be reported within 7 days and are reviewed under the Refund Policy.",
    },
    {
      question: "What is a virtual internship certificate?",
      answer:
        "Octamy's current virtual internship listings are assessment-based skill programs. They are not employment, payroll engagement, supervised work experience or a placement guarantee.",
    },
    {
      question: "How do I verify a certificate?",
      answer:
        "Open the verification page and enter the credential ID exactly as issued. The result shows the assessment score, issuer and current activation, expiry or revocation status.",
    },
    {
      question: "Are the certificates recognized by employers?",
      answer:
        "Octamy does not claim universal employer acceptance or accreditation. The credential is an independent, assessment-backed signal that lets an employer inspect the recorded score and status alongside other hiring evidence.",
    },
    {
      question: "How long does it take to receive my certificate?",
      answer:
        "After a successful payment is confirmed, the activated credential should appear in your dashboard. If it does not, contact support with the payment reference.",
    },
    {
      question: "Can I update my certificate details after purchase?",
      answer:
        "Issued assessment details cannot be edited. Correct your account name before starting or contact support if a genuine account-data correction is needed.",
    },
    {
      question: "What payment methods do you accept?",
      answer:
        "Available methods and the payment processor are displayed at checkout and may vary by product. Never pay using details sent outside the official Octamy checkout.",
    },
  ];

  return (
    <div className="min-h-screen bg-cream-soft dark:bg-gray-900">
      <SEO
        title="Help Center"
        description="Get answers to common questions about exams, certificates, refunds, and account on Octamy."
        path="/help-center"
      />
      {/* Header */}
      <header className="bg-cream-soft dark:bg-gray-900 shadow-sm border-b border-cream-deep dark:border-gray-700">
        <div className="container mx-auto px-4 py-4">
          <div className="flex items-center justify-between">
            <Button variant="ghost" onClick={() => setLocation("/")}>
              <span className="text-2xl font-bold text-black dark:text-white">
                <img
                  src={octamyLogoDark}
                  alt="Octamy"
                  className="h-8 dark:none"
                />
              </span>
            </Button>
            <Button onClick={() => setLocation("/")}>Back to Home</Button>
          </div>
        </div>
      </header>

      {/* Main Content */}
      <main className="container mx-auto px-4 py-8">
        <div className="text-center mb-12">
          <h1 className="text-4xl font-bold text-gray-900 dark:text-white mb-4">
            Help Center
          </h1>
          <p className="text-xl text-gray-600 dark:text-gray-300 max-w-2xl mx-auto">
            Find answers to common questions about our certification platform
          </p>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
          {/* FAQ Section */}
          <div className="lg:col-span-2 space-y-8">
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center space-x-2">
                  <HelpCircle className="h-6 w-6 text-slate-600" />
                  <span>Frequently Asked Questions</span>
                </CardTitle>
                <CardDescription>
                  Common questions about our certification process and platform
                </CardDescription>
              </CardHeader>
              <CardContent>
                <Accordion type="single" collapsible className="w-full">
                  {faqs.map((faq, index) => (
                    <AccordionItem key={index} value={`item-${index}`}>
                      <AccordionTrigger className="text-left">
                        {faq.question}
                      </AccordionTrigger>
                      <AccordionContent className="text-gray-600 dark:text-gray-300">
                        {faq.answer}
                      </AccordionContent>
                    </AccordionItem>
                  ))}
                </Accordion>
              </CardContent>
            </Card>

            {/* Contact Form Section */}
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center space-x-2">
                  <Send className="h-6 w-6 text-slate-600" />
                  <span>Contact Support</span>
                </CardTitle>
                <CardDescription>
                  Send us a message and we'll respond within 24 hours
                </CardDescription>
              </CardHeader>
              <CardContent>
                <Form {...form}>
                  <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
                    <FormField
                      control={form.control}
                      name="name"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Name</FormLabel>
                          <FormControl>
                            <Input placeholder="Your full name" {...field} />
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
                          <FormLabel>Email</FormLabel>
                          <FormControl>
                            <Input type="email" placeholder="your.email@example.com" {...field} />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                    <FormField
                      control={form.control}
                      name="phone"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Phone Number (Optional)</FormLabel>
                          <FormControl>
                            <Input type="tel" placeholder="+91 9876543210" {...field} />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                    <FormField
                      control={form.control}
                      name="subject"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Subject</FormLabel>
                          <FormControl>
                            <Input placeholder="Brief description of your inquiry" {...field} />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                    <FormField
                      control={form.control}
                      name="message"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Message</FormLabel>
                          <FormControl>
                            <Textarea
                              placeholder="Please describe your issue or question in detail..."
                              rows={5}
                              {...field}
                            />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                    <Button 
                      type="submit" 
                      className="w-full" 
                      disabled={contactMutation.isPending}
                    >
                      {contactMutation.isPending ? (
                        "Sending..."
                      ) : (
                        <>
                          <Send className="h-4 w-4 mr-2" />
                          Send Message
                        </>
                      )}
                    </Button>
                  </form>
                </Form>
              </CardContent>
            </Card>
          </div>

          {/* Contact Section */}
          <div className="lg:col-span-1">
            <Card className="mb-6">
              <CardHeader>
                <CardTitle>Need More Help?</CardTitle>
                <CardDescription>
                  Contact our support team for personalized assistance
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="flex items-center space-x-3 p-3 bg-cream-deep dark:bg-gray-800 rounded-lg">
                  <Mail className="h-5 w-5 text-slate-600" />
                  <div>
                    <p className="font-medium">Email Support</p>
                    <p className="text-sm text-gray-600 dark:text-gray-400">
                      support@octamy.com
                    </p>
                  </div>
                </div>

                <div className="flex items-center space-x-3 p-3 bg-cream-deep dark:bg-gray-800 rounded-lg">
                  <Phone className="h-5 w-5 text-slate-600" />
                  <div>
                    <p className="font-medium">Phone Support</p>
                    <p className="text-sm text-gray-600 dark:text-gray-400">
                      +91 9876543210
                    </p>
                  </div>
                </div>

                <div 
                  className="flex items-center space-x-3 p-3 bg-cream-deep dark:bg-gray-800 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-700 cursor-pointer transition-colors"
                  onClick={openLiveChat}
                >
                  <MessageCircle className="h-5 w-5 text-slate-600" />
                  <div>
                    <p className="font-medium">Live Chat</p>
                    <p className="text-sm text-gray-600 dark:text-gray-400">
                      Click here to start chatting - Available 9 AM - 6 PM IST
                    </p>
                  </div>
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle>Quick Links</CardTitle>
              </CardHeader>
              <CardContent className="space-y-2">
                <Button
                  variant="ghost"
                  className="w-full justify-start"
                  onClick={() => setLocation("/verify")}
                >
                  Certificate Verification
                </Button>
                <Button
                  variant="ghost"
                  className="w-full justify-start"
                  onClick={() => setLocation("/dashboard")}
                >
                  My Dashboard
                </Button>
                <Button
                  variant="ghost"
                  className="w-full justify-start"
                  onClick={() => setLocation("/privacy-policy")}
                >
                  Privacy Policy
                </Button>
                <Button
                  variant="ghost"
                  className="w-full justify-start"
                  onClick={() => setLocation("/terms-of-service")}
                >
                  Terms of Service
                </Button>
              </CardContent>
            </Card>
          </div>
        </div>
      </main>
    </div>
  );
}
