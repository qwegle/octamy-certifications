import { useState } from "react";
import { useSellerAuth } from "@/lib/sellerAuth";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { useToast } from "@/hooks/use-toast";
import { GoogleAuthButton } from "@/components/google-auth-button";
import { useSellerGoogleAuthHandler } from "@/utils/google-auth-handler";
import { Eye, EyeOff, DollarSign, TrendingUp, Users, BarChart3, CheckCircle, Zap, Shield, Headphones, Award, Clock } from "lucide-react";
import Header from "@/components/header";
import Footer from "@/components/footer";
import { Helmet } from 'react-helmet-async';

export default function SellerAuth() {
  const [isLogin, setIsLogin] = useState(true);
  const [showPassword, setShowPassword] = useState(false);
  const [formData, setFormData] = useState({
    email: "",
    password: "",
    name: "",
    phone: ""
  });
  const [isLoading, setIsLoading] = useState(false);
  
  const { login, register } = useSellerAuth();
  const { toast } = useToast();
  
  useSellerGoogleAuthHandler();

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsLoading(true);

    try {
      if (isLogin) {
        await login(formData.email, formData.password);
        toast({
          title: "Success",
          description: "Logged in successfully",
        });
      } else {
        await register(formData.email, formData.password, formData.name, formData.phone);
        toast({
          title: "Success",
          description: "Account created successfully. Awaiting admin approval.",
        });
      }
    } catch (error: any) {
      toast({
        title: "Error",
        description: error.message,
        variant: "destructive",
      });
    } finally {
      setIsLoading(false);
    }
  };

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setFormData({
      ...formData,
      [e.target.name]: e.target.value
    });
  };

  return (
    <>
      <Helmet>
        <title>{isLogin ? 'Partner Login - PremCq' : 'Become a Partner - PremCq Reseller Program'}</title>
        <meta 
          name="description" 
          content={isLogin 
            ? 'Sign in to your PremCq partner account to access your dashboard, track earnings, and manage your reseller business.'
            : 'Join the PremCq Partner Program and earn 10% commission on every sale. Get real-time analytics, dedicated support, and flexible payment options.'
          } 
        />
      </Helmet>
      
      <div className="min-h-screen bg-background">
        <Header />
        
        <div className="relative overflow-hidden bg-gradient-to-br from-primary/5 via-background to-primary/5 border-b">
          <div className="container mx-auto px-4 py-16 lg:py-24">
            <div className="max-w-4xl mx-auto text-center space-y-6">
              <div className="inline-flex items-center gap-2 bg-primary/10 text-primary px-4 py-2 rounded-full text-sm font-medium">
                <Award className="h-4 w-4" />
                PremCq Partner Program
              </div>
              <h1 className="text-4xl lg:text-6xl font-bold text-foreground">
                {isLogin ? 'Welcome Back, Partner' : 'Earn While You Empower'}
              </h1>
              <p className="text-lg lg:text-xl text-muted-foreground max-w-2xl mx-auto">
                {isLogin 
                  ? 'Access your partner dashboard to track earnings, manage referrals, and grow your business with PremCq.'
                  : 'Join thousands of partners earning passive income by helping professionals get certified. Start earning 10% commission on every sale today.'
                }
              </p>
              {!isLogin && (
                <div className="flex flex-wrap justify-center gap-8 pt-6">
                  <div className="text-center" data-testid="stat-commission">
                    <div className="text-3xl lg:text-4xl font-bold text-primary">10%</div>
                    <div className="text-sm text-muted-foreground">Commission Rate</div>
                  </div>
                  <div className="text-center" data-testid="stat-partners">
                    <div className="text-3xl lg:text-4xl font-bold text-primary">500+</div>
                    <div className="text-sm text-muted-foreground">Active Partners</div>
                  </div>
                  <div className="text-center" data-testid="stat-payout">
                    <div className="text-3xl lg:text-4xl font-bold text-primary">₹50L+</div>
                    <div className="text-sm text-muted-foreground">Total Payouts</div>
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>

        <div className="container mx-auto px-4 py-12 lg:py-16">
          <div className="grid lg:grid-cols-2 gap-12 max-w-7xl mx-auto items-start">
            <div className="space-y-8">
              {!isLogin && (
                <>
                  <div className="space-y-6">
                    <h2 className="text-3xl font-bold text-foreground">Why Partner With PremCq?</h2>
                    
                    <div className="grid gap-4">
                      <div className="flex gap-4" data-testid="benefit-commission">
                        <div className="h-12 w-12 rounded-md bg-primary/10 flex items-center justify-center flex-shrink-0">
                          <DollarSign className="h-6 w-6 text-primary" />
                        </div>
                        <div>
                          <h3 className="font-semibold text-foreground mb-1">Generous Commission Structure</h3>
                          <p className="text-sm text-muted-foreground">
                            Earn 10% commission on every certificate sale. The more you sell, the more you earn. Average partners make ₹50,000-₹2,00,000 per month.
                          </p>
                        </div>
                      </div>

                      <div className="flex gap-4" data-testid="benefit-analytics">
                        <div className="h-12 w-12 rounded-md bg-primary/10 flex items-center justify-center flex-shrink-0">
                          <BarChart3 className="h-6 w-6 text-primary" />
                        </div>
                        <div>
                          <h3 className="font-semibold text-foreground mb-1">Real-Time Analytics Dashboard</h3>
                          <p className="text-sm text-muted-foreground">
                            Track your sales, commissions, and customer engagement in real-time. Get detailed insights to optimize your marketing strategy.
                          </p>
                        </div>
                      </div>

                      <div className="flex gap-4" data-testid="benefit-support">
                        <div className="h-12 w-12 rounded-md bg-primary/10 flex items-center justify-center flex-shrink-0">
                          <Headphones className="h-6 w-6 text-primary" />
                        </div>
                        <div>
                          <h3 className="font-semibold text-foreground mb-1">Dedicated Partner Support</h3>
                          <p className="text-sm text-muted-foreground">
                            Get priority support from our partner success team. We help you with marketing materials, strategies, and technical questions.
                          </p>
                        </div>
                      </div>

                      <div className="flex gap-4" data-testid="benefit-payments">
                        <div className="h-12 w-12 rounded-md bg-primary/10 flex items-center justify-center flex-shrink-0">
                          <Zap className="h-6 w-6 text-primary" />
                        </div>
                        <div>
                          <h3 className="font-semibold text-foreground mb-1">Flexible Payment Options</h3>
                          <p className="text-sm text-muted-foreground">
                            Withdraw earnings via UPI, bank transfer, or Paytm. Minimum payout is just ₹1,000 with weekly payment cycles.
                          </p>
                        </div>
                      </div>

                      <div className="flex gap-4" data-testid="benefit-resources">
                        <div className="h-12 w-12 rounded-md bg-primary/10 flex items-center justify-center flex-shrink-0">
                          <Users className="h-6 w-6 text-primary" />
                        </div>
                        <div>
                          <h3 className="font-semibold text-foreground mb-1">Marketing Resources</h3>
                          <p className="text-sm text-muted-foreground">
                            Access pre-made banners, social media posts, email templates, and promotional materials to boost your sales.
                          </p>
                        </div>
                      </div>

                      <div className="flex gap-4" data-testid="benefit-lifetime">
                        <div className="h-12 w-12 rounded-md bg-primary/10 flex items-center justify-center flex-shrink-0">
                          <TrendingUp className="h-6 w-6 text-primary" />
                        </div>
                        <div>
                          <h3 className="font-semibold text-foreground mb-1">Lifetime Recurring Commissions</h3>
                          <p className="text-sm text-muted-foreground">
                            Earn commissions not just on first purchase, but on every future purchase made by your referred customers.
                          </p>
                        </div>
                      </div>
                    </div>
                  </div>

                  <Card className="bg-gradient-to-br from-primary/5 to-primary/10 border-primary/20">
                    <CardContent className="pt-6 space-y-4">
                      <h3 className="text-xl font-bold text-foreground">How It Works</h3>
                      <div className="space-y-3">
                        <div className="flex items-start gap-3">
                          <div className="h-8 w-8 rounded-full bg-primary text-primary-foreground flex items-center justify-center flex-shrink-0 text-sm font-bold">
                            1
                          </div>
                          <div>
                            <p className="font-medium text-foreground">Sign Up & Get Approved</p>
                            <p className="text-sm text-muted-foreground">Create your partner account and get verified within 24 hours</p>
                          </div>
                        </div>
                        <div className="flex items-start gap-3">
                          <div className="h-8 w-8 rounded-full bg-primary text-primary-foreground flex items-center justify-center flex-shrink-0 text-sm font-bold">
                            2
                          </div>
                          <div>
                            <p className="font-medium text-foreground">Share Your Unique Link</p>
                            <p className="text-sm text-muted-foreground">Promote certifications using your referral link on social media, website, or email</p>
                          </div>
                        </div>
                        <div className="flex items-start gap-3">
                          <div className="h-8 w-8 rounded-full bg-primary text-primary-foreground flex items-center justify-center flex-shrink-0 text-sm font-bold">
                            3
                          </div>
                          <div>
                            <p className="font-medium text-foreground">Earn Commissions</p>
                            <p className="text-sm text-muted-foreground">Get 10% commission on every certificate purchase made through your link</p>
                          </div>
                        </div>
                        <div className="flex items-start gap-3">
                          <div className="h-8 w-8 rounded-full bg-primary text-primary-foreground flex items-center justify-center flex-shrink-0 text-sm font-bold">
                            4
                          </div>
                          <div>
                            <p className="font-medium text-foreground">Get Paid Weekly</p>
                            <p className="text-sm text-muted-foreground">Withdraw earnings to your bank account, UPI, or Paytm every week</p>
                          </div>
                        </div>
                      </div>
                    </CardContent>
                  </Card>

                  <Card>
                    <CardContent className="pt-6 space-y-4">
                      <h3 className="text-lg font-bold text-foreground">Earnings Example</h3>
                      <div className="space-y-3 text-sm">
                        <div className="flex justify-between items-center pb-2 border-b">
                          <span className="text-muted-foreground">Certificate Price</span>
                          <span className="font-semibold text-foreground">₹999</span>
                        </div>
                        <div className="flex justify-between items-center pb-2 border-b">
                          <span className="text-muted-foreground">Your Commission (10%)</span>
                          <span className="font-semibold text-foreground">₹100</span>
                        </div>
                        <div className="flex justify-between items-center pb-2 border-b">
                          <span className="text-muted-foreground">10 Sales/Month</span>
                          <span className="font-semibold text-primary">₹1,000</span>
                        </div>
                        <div className="flex justify-between items-center pb-2 border-b">
                          <span className="text-muted-foreground">50 Sales/Month</span>
                          <span className="font-semibold text-primary">₹5,000</span>
                        </div>
                        <div className="flex justify-between items-center">
                          <span className="text-muted-foreground font-medium">200 Sales/Month</span>
                          <span className="font-bold text-xl text-primary">₹20,000</span>
                        </div>
                      </div>
                    </CardContent>
                  </Card>
                </>
              )}

              {isLogin && (
                <div className="space-y-6">
                  <h2 className="text-2xl font-bold text-foreground">Partner Dashboard Features</h2>
                  
                  <div className="grid gap-4">
                    <div className="flex gap-4">
                      <div className="h-10 w-10 rounded-md bg-primary/10 flex items-center justify-center flex-shrink-0">
                        <BarChart3 className="h-5 w-5 text-primary" />
                      </div>
                      <div>
                        <h3 className="font-semibold text-foreground">Track Your Performance</h3>
                        <p className="text-sm text-muted-foreground">View detailed analytics on sales, clicks, and conversion rates</p>
                      </div>
                    </div>

                    <div className="flex gap-4">
                      <div className="h-10 w-10 rounded-md bg-primary/10 flex items-center justify-center flex-shrink-0">
                        <DollarSign className="h-5 w-5 text-primary" />
                      </div>
                      <div>
                        <h3 className="font-semibold text-foreground">Manage Earnings</h3>
                        <p className="text-sm text-muted-foreground">View pending and paid commissions with detailed transaction history</p>
                      </div>
                    </div>

                    <div className="flex gap-4">
                      <div className="h-10 w-10 rounded-md bg-primary/10 flex items-center justify-center flex-shrink-0">
                        <Users className="h-5 w-5 text-primary" />
                      </div>
                      <div>
                        <h3 className="font-semibold text-foreground">Customer Insights</h3>
                        <p className="text-sm text-muted-foreground">See which courses perform best and optimize your marketing</p>
                      </div>
                    </div>
                  </div>
                </div>
              )}
            </div>

            <div className="lg:sticky lg:top-24">
              <Card>
                <CardHeader className="bg-gradient-to-br from-primary/10 to-primary/5">
                  <CardTitle className="text-2xl text-center">
                    {isLogin ? "Partner Login" : "Join the Partner Program"}
                  </CardTitle>
                  <p className="text-center text-sm text-muted-foreground mt-2">
                    {isLogin 
                      ? "Access your partner dashboard and track your earnings" 
                      : "Start earning commission today - it's free to join"
                    }
                  </p>
                </CardHeader>
                
                <CardContent className="pt-6 space-y-6">
                  <form onSubmit={handleSubmit} className="space-y-4">
                    {!isLogin && (
                      <>
                        <div className="space-y-2">
                          <Label htmlFor="name">
                            Full Name
                          </Label>
                          <Input
                            id="name"
                            name="name"
                            type="text"
                            value={formData.name}
                            onChange={handleInputChange}
                            required={!isLogin}
                            placeholder="Enter your full name"
                            data-testid="input-partner-name"
                          />
                        </div>
                        
                        <div className="space-y-2">
                          <Label htmlFor="phone">
                            Phone Number <span className="text-muted-foreground">(Optional)</span>
                          </Label>
                          <Input
                            id="phone"
                            name="phone"
                            type="tel"
                            value={formData.phone}
                            onChange={handleInputChange}
                            placeholder="+91 XXXXX XXXXX"
                            data-testid="input-partner-phone"
                          />
                        </div>
                      </>
                    )}
                    
                    <div className="space-y-2">
                      <Label htmlFor="email">
                        Email Address
                      </Label>
                      <Input
                        id="email"
                        name="email"
                        type="email"
                        value={formData.email}
                        onChange={handleInputChange}
                        required
                        placeholder="Enter your email"
                        data-testid="input-partner-email"
                      />
                    </div>
                    
                    <div className="space-y-2">
                      <Label htmlFor="password">
                        Password
                      </Label>
                      <div className="relative">
                        <Input
                          id="password"
                          name="password"
                          type={showPassword ? "text" : "password"}
                          value={formData.password}
                          onChange={handleInputChange}
                          required
                          className="pr-10"
                          placeholder="Enter your password"
                          data-testid="input-partner-password"
                        />
                        <button
                          type="button"
                          onClick={() => setShowPassword(!showPassword)}
                          className="absolute right-3 top-1/2 transform -translate-y-1/2 text-muted-foreground hover:text-foreground"
                          data-testid="button-toggle-partner-password"
                        >
                          {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                        </button>
                      </div>
                    </div>

                    <Button
                      type="submit"
                      disabled={isLoading}
                      className="w-full"
                      size="lg"
                      data-testid="button-partner-submit"
                    >
                      {isLoading ? "Processing..." : (isLogin ? "Sign In to Dashboard" : "Create Partner Account")}
                    </Button>
                  </form>

                  <div className="relative">
                    <div className="absolute inset-0 flex items-center">
                      <span className="w-full border-t" />
                    </div>
                    <div className="relative flex justify-center text-xs uppercase">
                      <span className="bg-card px-2 text-muted-foreground">Or continue with</span>
                    </div>
                  </div>
                  
                  <GoogleAuthButton type="seller" isLoading={isLoading} />

                  <div className="text-center">
                    <button
                      onClick={() => setIsLogin(!isLogin)}
                      className="text-sm text-primary hover:underline font-medium"
                      data-testid="button-toggle-partner-mode"
                    >
                      {isLogin 
                        ? "Don't have a partner account? Sign up" 
                        : "Already a partner? Sign in"
                      }
                    </button>
                  </div>

                  {!isLogin && (
                    <div className="bg-primary/5 border border-primary/20 rounded-md p-4 space-y-2">
                      <div className="flex items-center gap-2 text-primary">
                        <Shield className="h-5 w-5" />
                        <h4 className="font-semibold">What Happens Next?</h4>
                      </div>
                      <div className="space-y-1 text-sm text-muted-foreground">
                        <div className="flex items-start gap-2">
                          <CheckCircle className="h-4 w-4 text-primary mt-0.5 flex-shrink-0" />
                          <span>Account review within 24 hours</span>
                        </div>
                        <div className="flex items-start gap-2">
                          <CheckCircle className="h-4 w-4 text-primary mt-0.5 flex-shrink-0" />
                          <span>Receive your unique referral link</span>
                        </div>
                        <div className="flex items-start gap-2">
                          <CheckCircle className="h-4 w-4 text-primary mt-0.5 flex-shrink-0" />
                          <span>Start promoting and earning immediately</span>
                        </div>
                      </div>
                    </div>
                  )}

                  <div className="text-center text-xs text-muted-foreground">
                    By {isLogin ? 'signing in' : 'joining'}, you agree to our{' '}
                    <a href="/terms-of-service" className="text-primary hover:underline">
                      Partner Terms
                    </a>{' '}
                    and{' '}
                    <a href="/privacy-policy" className="text-primary hover:underline">
                      Privacy Policy
                    </a>
                  </div>
                </CardContent>
              </Card>
            </div>
          </div>
        </div>

        <Footer />
      </div>
    </>
  );
}
