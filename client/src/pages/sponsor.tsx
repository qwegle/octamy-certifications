import { useState } from "react";
import { useMutation } from "@tanstack/react-query";
import { Link } from "wouter";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import {
  Heart,
  Users,
  Target,
  Zap,
  Brain,
  TrendingUp,
  Award,
  CheckCircle,
  ArrowLeft,
  Menu,
  X,
} from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { apiRequest } from "@/lib/queryClient";
import { useLocation } from "wouter";
import { useAuth } from "@/lib/auth";
// Using available image from assets
import octamyLogoDark from "@/assets/image_1750054456482.png";
import octamyLogoLight from "@/assets/image_1750054465427.png";

const PRESET_AMOUNTS = [1, 10, 100, 1000, 10000, 100000, 1000000];

const TEAM_MEMBERS = [
  {
    name: "Nitikesh Pattanayak",
    role: "Founder & CEO",
    image: "/team/nitikesh.jpg",
    description:
      "Visionary leader driving innovation in professional certification",
  },
  {
    name: "Nikhilesh Pattanayak",
    role: "Co-founder",
    image: "/team/nikhil.jpg",
    description: "Technical architect building scalable learning platforms",
  },
  {
    name: "S.N Digbijaya",
    role: "Head of Product",
    image: "/team/digbi.jpg",
    description: "Product strategist focused on learner experience",
  },
  {
    name: "Subhendu Jena",
    role: "Lead Developer",
    image: "/team/subhendu.jpg",
    description: "Full-stack developer creating robust educational tools",
  },
];

const FUTURE_ROADMAP = [
  {
    title: "AI-Based Learning Paths",
    description:
      "Personalized learning journeys adapted to individual skill levels and career goals",
    icon: <Brain className="w-6 h-6" />,
    timeline: "Planned",
  },
  {
    title: "AI-Powered Skill Assessment",
    description:
      "Intelligent evaluation system that identifies strengths and improvement areas",
    icon: <Target className="w-6 h-6" />,
    timeline: "Research",
  },
  {
    title: "AI Career Guidance",
    description:
      "Explainable recommendations based on assessment evidence and stated goals",
    icon: <TrendingUp className="w-6 h-6" />,
    timeline: "Planned",
  },
  {
    title: "Advanced Analytics Dashboard",
    description: "Comprehensive learning analytics with predictive insights",
    icon: <Zap className="w-6 h-6" />,
    timeline: "In progress",
  },
];

const CURRENT_FEATURES = [
  "Free scored skill assessments",
  "Optional credential activation after passing",
  "Live credential status checks",
  "Learner-controlled evidence sharing",
  "Creator and institute workspaces",
  "Cohorts, question banks and scheduled exams",
  "Recruiter search for opted-in profiles",
];

const USPS = [
  {
    title: "Proof Before Payment",
    description: "Learners see their score before deciding whether to buy a credential",
  },
  {
    title: "Inspectable Evidence",
    description: "Live records expose the score, issuer, dates and current status",
  },
  {
    title: "Learner-Controlled Sharing",
    description: "Public evidence passports remain private until the learner opts in",
  },
  {
    title: "Honest Evidence Boundaries",
    description: "Octamy distinguishes assessment results from identity, accreditation and job performance",
  },
];

export default function SponsorPage() {
  const [selectedAmount, setSelectedAmount] = useState<number | null>(null);
  const [customAmount, setCustomAmount] = useState("");
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [message, setMessage] = useState("");
  const [isAnonymous, setIsAnonymous] = useState(false);
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const { toast } = useToast();
  const [, setLocation] = useLocation();
  const { user } = useAuth();

  const sponsorMutation = useMutation({
    mutationFn: async (sponsorData: any) => {
      const response = await apiRequest("POST", "/api/sponsors", sponsorData);
      return response.json();
    },
    onSuccess: (data) => {
      if (data.success) {
        // Create and submit payment form
        const form = document.createElement("form");
        form.method = "POST";
        form.action = data.payment.action;

        Object.entries(data.payment.fields).forEach(([key, value]) => {
          const input = document.createElement("input");
          input.type = "hidden";
          input.name = key;
          input.value = value as string;
          form.appendChild(input);
        });

        document.body.appendChild(form);
        form.submit();
      }
    },
    onError: (error) => {
      toast({
        title: "Error",
        description: "Failed to process sponsorship. Please try again.",
        variant: "destructive",
      });
    },
  });

  const handleAmountSelect = (amount: number) => {
    setSelectedAmount(amount);
    setCustomAmount("");
  };

  const handleCustomAmountChange = (value: string) => {
    setCustomAmount(value);
    setSelectedAmount(null);
  };

  const getCurrentAmount = () => {
    return selectedAmount || parseInt(customAmount) || 0;
  };

  const handleSponsor = () => {
    const amount = getCurrentAmount();

    if (!amount || amount < 1) {
      toast({
        title: "Invalid Amount",
        description: "Please select or enter a valid amount",
        variant: "destructive",
      });
      return;
    }

    if (!name || !email) {
      toast({
        title: "Missing Information",
        description: "Please provide your name and email",
        variant: "destructive",
      });
      return;
    }

    sponsorMutation.mutate({
      name,
      email,
      amount,
      message,
      isAnonymous,
    });
  };

  return (
    <div className="min-h-screen bg-cream-soft dark:bg-black text-black dark:text-white">
      {/* Header */}
      <header className="bg-cream-soft dark:bg-black shadow-sm border-b border-black dark:border-white sticky top-0 z-50">
        <div className="container mx-auto px-4 py-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center space-x-4">
              <Button
                variant="ghost"
                onClick={() => setLocation("/")}
                className="hover:bg-gray-100 dark:hover:bg-gray-900"
              >
                <span className="text-2xl font-bold text-black dark:text-white">
                  <Link href="/" className="text-2xl font-bold">
                    <img
                      src={octamyLogoDark}
                      alt="Octamy"
                      className="h-8 dark:none"
                    />
                  </Link>
                </span>
              </Button>
            </div>

            {/* Desktop Navigation */}
            <nav className="hidden md:flex items-center space-x-6">
              <Button
                variant="ghost"
                onClick={() => setLocation("/exams")}
                className="text-black dark:text-white hover:bg-gray-100 dark:hover:bg-gray-900"
              >
                Exams
              </Button>
              <Button
                variant="ghost"
                onClick={() => setLocation("/virtual-internships")}
                className="text-black dark:text-white hover:bg-gray-100 dark:hover:bg-gray-900"
              >
                Internships
              </Button>
              <Button
                variant="ghost"
                onClick={() => setLocation("/business-certifications")}
                className="text-black dark:text-white hover:bg-gray-100 dark:hover:bg-gray-900"
              >
                Business
              </Button>
              {/* <Button
                variant="ghost"
                onClick={() => setLocation("/learning-paths")}
                className="text-black dark:text-white hover:bg-gray-100 dark:hover:bg-gray-900"
              >
                Learning Paths
              </Button> */}
            </nav>

            <div className="flex items-center space-x-4">
              <Button
                variant="ghost"
                onClick={() => setLocation("/")}
                className="hover:bg-gray-100 dark:hover:bg-gray-900"
              >
                <ArrowLeft className="h-4 w-4 mr-2" />
                Back
              </Button>
              {user ? (
                <Button
                  onClick={() => setLocation("/dashboard")}
                  className="bg-black dark:bg-cream-soft text-white dark:text-black hover:bg-gray-800 dark:hover:bg-gray-200"
                >
                  Dashboard
                </Button>
              ) : (
                <Button
                  onClick={() => setLocation("/auth")}
                  className="bg-black dark:bg-cream-soft text-white dark:text-black hover:bg-gray-800 dark:hover:bg-gray-200"
                >
                  Sign In
                </Button>
              )}

              {/* Mobile menu button */}
              <Button
                variant="ghost"
                size="sm"
                className="md:hidden"
                onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
              >
                {mobileMenuOpen ? (
                  <X className="h-5 w-5" />
                ) : (
                  <Menu className="h-5 w-5" />
                )}
              </Button>
            </div>
          </div>

          {/* Mobile Navigation */}
          {mobileMenuOpen && (
            <nav className="md:hidden mt-4 pb-4 border-t border-black dark:border-white pt-4">
              <div className="flex flex-col space-y-2">
                <Button
                  variant="ghost"
                  onClick={() => {
                    setLocation("/exams");
                    setMobileMenuOpen(false);
                  }}
                  className="justify-start text-black dark:text-white"
                >
                  Exams
                </Button>
                <Button
                  variant="ghost"
                  onClick={() => {
                    setLocation("/virtual-internships");
                    setMobileMenuOpen(false);
                  }}
                  className="justify-start text-black dark:text-white"
                >
                  Internships
                </Button>
                <Button
                  variant="ghost"
                  onClick={() => {
                    setLocation("/business-certifications");
                    setMobileMenuOpen(false);
                  }}
                  className="justify-start text-black dark:text-white"
                >
                  Business
                </Button>
                <Button
                  variant="ghost"
                  onClick={() => {
                    setLocation("/learning-paths");
                    setMobileMenuOpen(false);
                  }}
                  className="justify-start text-black dark:text-white"
                >
                  Learning Paths
                </Button>
              </div>
            </nav>
          )}
        </div>
      </header>

      {/* Hero Section */}
      <div className="bg-black dark:bg-cream-soft text-white dark:text-black py-20">
        <div className="max-w-6xl mx-auto px-4 text-center">
          <div className="flex items-center justify-center mb-6">
            <Heart className="w-12 h-12 text-red-500 mr-4" />
            <h1 className="text-5xl font-bold">Support Octamy's Vision</h1>
          </div>
          <p className="text-xl text-gray-300 max-w-3xl mx-auto mb-8">
            Help us revolutionize professional education by making quality
            certifications accessible to everyone. Your support enables us to
            invest more in development, AI technology, and keeping our platform
            affordable for students worldwide.
          </p>
          <div className="flex items-center justify-center space-x-8 text-sm text-gray-400">
            <div className="flex items-center">
              <Users className="w-4 h-4 mr-2" />
              <span>10,000+ Students Served</span>
            </div>
            <div className="flex items-center">
              <Award className="w-4 h-4 mr-2" />
              <span>500+ Certificates Issued</span>
            </div>
            <div className="flex items-center">
              <CheckCircle className="w-4 h-4 mr-2" />
              <span>95% Success Rate</span>
            </div>
          </div>
        </div>
      </div>

      <div className="max-w-6xl mx-auto px-4 py-16">
        {/* Success/Error Messages */}
        {typeof window !== "undefined" && (
          <>
            {new URLSearchParams(window.location.search).get("success") && (
              <Card className="mb-8 border-green-200 bg-green-50">
                <CardContent className="p-6">
                  <div className="flex items-center gap-3">
                    <CheckCircle className="w-6 h-6 text-green-600" />
                    <div>
                      <h3 className="font-semibold text-green-800">
                        Payment Successful!
                      </h3>
                      <p className="text-green-700">
                        Thank you for your generous support. Your contribution
                        helps us build better educational tools.
                      </p>
                    </div>
                  </div>
                </CardContent>
              </Card>
            )}
            {new URLSearchParams(window.location.search).get("error") && (
              <Card className="mb-8 border-red-200 bg-red-50">
                <CardContent className="p-6">
                  <div className="flex items-center gap-3">
                    <Heart className="w-6 h-6 text-red-600" />
                    <div>
                      <h3 className="font-semibold text-red-800">
                        Payment Failed
                      </h3>
                      <p className="text-red-700">
                        There was an issue processing your payment. Please try
                        again.
                      </p>
                    </div>
                  </div>
                </CardContent>
              </Card>
            )}
          </>
        )}

        {/* Sponsorship Form */}
        <Card className="mb-16 border-2 border-black">
          <CardHeader className="bg-black text-white">
            <CardTitle className="text-2xl">Send Your Love & Support</CardTitle>
            <CardDescription className="text-gray-300">
              Choose an amount and help us build the future of professional
              education
            </CardDescription>
          </CardHeader>
          <CardContent className="p-8">
            {/* Amount Selection */}
            <div className="mb-8">
              <Label className="text-lg font-semibold mb-4 block">
                Select Amount (INR)
              </Label>
              <div className="grid grid-cols-3 md:grid-cols-7 gap-3 mb-4">
                {PRESET_AMOUNTS.map((amount) => (
                  <Button
                    key={amount}
                    variant={selectedAmount === amount ? "default" : "outline"}
                    className={`text-lg font-bold ${
                      selectedAmount === amount
                        ? "bg-black text-white"
                        : "border-black text-black hover:bg-black hover:text-white"
                    }`}
                    onClick={() => handleAmountSelect(amount)}
                  >
                    ₹{amount.toLocaleString()}
                  </Button>
                ))}
              </div>

              <div className="mt-4">
                <Label htmlFor="custom-amount" className="text-sm font-medium">
                  Or enter custom amount:
                </Label>
                <Input
                  id="custom-amount"
                  type="number"
                  placeholder="Enter amount in INR"
                  value={customAmount}
                  onChange={(e) => handleCustomAmountChange(e.target.value)}
                  className="mt-2 border-black focus:border-black"
                />
              </div>
            </div>

            {/* Contact Information */}
            <div className="grid md:grid-cols-2 gap-6 mb-6">
              <div>
                <Label htmlFor="sponsor-name">Name *</Label>
                <Input
                  id="sponsor-name"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  className="border-black focus:border-black"
                  placeholder="Your full name"
                />
              </div>
              <div>
                <Label htmlFor="sponsor-email">Email *</Label>
                <Input
                  id="sponsor-email"
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  className="border-black focus:border-black"
                  placeholder="your@email.com"
                />
              </div>
            </div>

            {/* Optional Message */}
            <div className="mb-6">
              <Label htmlFor="sponsor-message">Message (Optional)</Label>
              <Textarea
                id="sponsor-message"
                value={message}
                onChange={(e) => setMessage(e.target.value)}
                className="border-black focus:border-black"
                placeholder="Share your thoughts or motivation for supporting us..."
                rows={3}
              />
            </div>

            {/* Submit Button */}
            <div className="text-center">
              <Button
                onClick={handleSponsor}
                disabled={sponsorMutation.isPending || getCurrentAmount() < 1}
                className="bg-black text-white hover:bg-gray-800 text-lg px-12 py-3"
              >
                {sponsorMutation.isPending
                  ? "Processing..."
                  : `Support with ₹${getCurrentAmount().toLocaleString()}`}
              </Button>
              {getCurrentAmount() > 0 && (
                <p className="text-sm text-gray-600 mt-2">
                  You'll be redirected to PayUMoney for secure payment
                </p>
              )}
            </div>
          </CardContent>
        </Card>

        {/* Current Features */}
        <Card className="mb-16 border-2 border-black">
          <CardHeader className="bg-black text-white">
            <CardTitle className="text-2xl">What We've Built So Far</CardTitle>
            <CardDescription className="text-gray-300">
              Current features available on the Octamy platform
            </CardDescription>
          </CardHeader>
          <CardContent className="p-8">
            <div className="grid md:grid-cols-3 gap-4">
              {CURRENT_FEATURES.map((feature, index) => (
                <div
                  key={index}
                  className="flex items-center space-x-3 p-3 bg-cream-deep rounded border"
                >
                  <CheckCircle className="w-5 h-5 text-green-600 flex-shrink-0" />
                  <span className="font-medium">{feature}</span>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>

        {/* Future Roadmap */}
        <Card className="mb-16 border-2 border-black">
          <CardHeader className="bg-black text-white">
            <CardTitle className="text-2xl">Future Roadmap</CardTitle>
            <CardDescription className="text-gray-300">
              AI-powered features coming soon to revolutionize learning
            </CardDescription>
          </CardHeader>
          <CardContent className="p-8">
            <div className="grid md:grid-cols-2 gap-6">
              {FUTURE_ROADMAP.map((item, index) => (
                <div key={index} className="border border-black rounded-lg p-6">
                  <div className="flex items-start space-x-4">
                    <div className="bg-black text-white p-3 rounded-lg">
                      {item.icon}
                    </div>
                    <div className="flex-1">
                      <div className="flex items-center justify-between mb-2">
                        <h3 className="text-lg font-bold">{item.title}</h3>
                        <Badge
                          variant="outline"
                          className="border-black text-black"
                        >
                          {item.timeline}
                        </Badge>
                      </div>
                      <p className="text-gray-600">{item.description}</p>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>

        {/* Our USPs */}
        <Card className="mb-16 border-2 border-black">
          <CardHeader className="bg-black text-white">
            <CardTitle className="text-2xl">Why Choose Octamy</CardTitle>
            <CardDescription className="text-gray-300">
              Our unique value propositions that set us apart
            </CardDescription>
          </CardHeader>
          <CardContent className="p-8">
            <div className="grid md:grid-cols-2 gap-6">
              {USPS.map((usp, index) => (
                <div key={index} className="border border-black rounded-lg p-6">
                  <h3 className="text-lg font-bold mb-3">{usp.title}</h3>
                  <p className="text-gray-600">{usp.description}</p>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>

        {/* Meet Our Team */}
        <Card className="border-2 border-black">
          <CardHeader className="bg-black text-white">
            <CardTitle className="text-2xl">Meet Our Team</CardTitle>
            <CardDescription className="text-gray-300">
              The passionate individuals building the future of professional
              education
            </CardDescription>
          </CardHeader>
          <CardContent className="p-8">
            <div className="grid md:grid-cols-2 lg:grid-cols-4 gap-6">
              {TEAM_MEMBERS.map((member, index) => (
                <div
                  key={index}
                  className="text-center border border-black rounded-lg p-6"
                >
                  <div className="w-24 h-24 bg-gray-200 rounded-full mx-auto mb-4 flex items-center justify-center">
                    <Users className="w-12 h-12 text-gray-500" />
                  </div>
                  <h3 className="text-lg font-bold mb-1">{member.name}</h3>
                  <p className="text-sm text-gray-600 mb-3">{member.role}</p>
                  <p className="text-xs text-gray-500">{member.description}</p>
                </div>
              ))}
            </div>
            <div className="mt-8 text-center">
              <p className="text-sm text-gray-600">
                Want to learn more about our team? Visit{" "}
                <a
                  href="https://www.qwegle.com/team/"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-black font-medium hover:underline"
                >
                  qwegle.com/team
                </a>
              </p>
            </div>
          </CardContent>
        </Card>

        {/* Impact Statement */}
        <div className="text-center mt-16 p-8 bg-cream-deep rounded-lg border-2 border-black">
          <h2 className="text-3xl font-bold mb-4">Your Impact Matters</h2>
          <p className="text-lg text-gray-600 max-w-4xl mx-auto">
            Every rupee you contribute helps us keep our certification costs
            low, invest in cutting-edge AI technology, and reach more students
            who need affordable, quality education. Together, we're
            democratizing professional skill development and creating
            opportunities for everyone to succeed in their careers.
          </p>
        </div>
      </div>
    </div>
  );
}
