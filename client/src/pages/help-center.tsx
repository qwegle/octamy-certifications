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
        "You can retake the assessment after 24 hours. There's no limit to the number of attempts, and you only pay once you pass and want to receive your certificate.",
    },
    {
      question: "How long are the certificates valid?",
      answer:
        "Our certificates have lifetime validity. Once issued, they remain valid indefinitely and can be verified through our verification system.",
    },
    {
      question: "Can I get a refund if I'm not satisfied?",
      answer:
        "Yes, we offer a 30-day money-back guarantee. If you're not satisfied with your certificate, contact us within 30 days for a full refund.",
    },
    {
      question: "What is a virtual internship certificate?",
      answer:
        "Virtual internship certificates are professional credentials that show you've completed an internship program. You can customize the duration and dates according to your needs.",
    },
    {
      question: "How do I verify a certificate?",
      answer:
        "Use our certificate verification system by entering the certificate ID. You can also scan the QR code on any certificate to verify its authenticity.",
    },
    {
      question: "Are the certificates recognized by employers?",
      answer:
        "Yes, our certificates are industry-recognized and accepted by employers worldwide. They demonstrate your skills and knowledge in specific domains.",
    },
    {
      question: "How long does it take to receive my certificate?",
      answer:
        "Digital certificates are issued instantly upon successful payment. You'll receive an email with your certificate and can download it immediately from your dashboard.",
    },
    {
      question: "Can I update my certificate details after purchase?",
      answer:
        "For virtual internship certificates, you can customize the details (name, dates, duration) during the application process after payment. Regular certificates cannot be modified after issuance.",
    },
    {
      question: "What payment methods do you accept?",
      answer:
        "We accept all major credit/debit cards, net banking, UPI, and digital wallets through our secure payment partner Razorpay.",
    },
  ];

  return (
    <div className="min-h-screen bg-white dark:bg-gray-900">
      <SEO
        title="Help Center"
        description="Get answers to common questions about exams, certificates, refunds, and account on Octamy."
        path="/help-center"
      />
      {/* Header */}
      <header className="bg-white dark:bg-gray-900 shadow-sm border-b border-gray-200 dark:border-gray-700">
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
                  <HelpCircle className="h-6 w-6 text-blue-600" />
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
                  <Send className="h-6 w-6 text-blue-600" />
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
                <div className="flex items-center space-x-3 p-3 bg-gray-50 dark:bg-gray-800 rounded-lg">
                  <Mail className="h-5 w-5 text-blue-600" />
                  <div>
                    <p className="font-medium">Email Support</p>
                    <p className="text-sm text-gray-600 dark:text-gray-400">
                      support@octamy.com
                    </p>
                  </div>
                </div>

                <div className="flex items-center space-x-3 p-3 bg-gray-50 dark:bg-gray-800 rounded-lg">
                  <Phone className="h-5 w-5 text-green-600" />
                  <div>
                    <p className="font-medium">Phone Support</p>
                    <p className="text-sm text-gray-600 dark:text-gray-400">
                      +91 9876543210
                    </p>
                  </div>
                </div>

                <div 
                  className="flex items-center space-x-3 p-3 bg-gray-50 dark:bg-gray-800 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-700 cursor-pointer transition-colors"
                  onClick={openLiveChat}
                >
                  <MessageCircle className="h-5 w-5 text-purple-600" />
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
