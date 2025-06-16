import { Link } from "wouter";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { ArrowLeft, Award, Calendar, Shield, Download, Share2 } from "lucide-react";

export default function DemoCertificate() {
  return (
    <div className="min-h-screen bg-gray-50">
      {/* Navigation */}
      <nav className="bg-black text-white px-6 py-4">
        <div className="max-w-7xl mx-auto flex items-center justify-between">
          <div className="flex items-center space-x-8">
            <Link href="/" className="text-2xl font-bold">OCTAMY</Link>
            <div className="hidden md:flex space-x-6">
              <Link href="/" className="hover:text-gray-300">Courses</Link>
              <Link href="/partners" className="hover:text-gray-300">Partners</Link>
              <Link href="/help-center" className="hover:text-gray-300">Help</Link>
            </div>
          </div>
          <div className="flex items-center space-x-4">
            <Link href="/auth">
              <Button variant="outline" className="border-white text-white hover:bg-white hover:text-black">
                Login
              </Button>
            </Link>
          </div>
        </div>
      </nav>

      <div className="max-w-6xl mx-auto px-6 py-12">
        <div className="mb-8">
          <Link href="/">
            <Button variant="outline" className="border-black text-black hover:bg-black hover:text-white mb-4">
              <ArrowLeft className="w-4 h-4 mr-2" />
              Back to Home
            </Button>
          </Link>
          <h1 className="text-4xl font-bold text-black mb-2">Professional Certificate</h1>
          <p className="text-gray-600">This is a sample certificate showing the luxurious design and professional validation.</p>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
          {/* Certificate Display */}
          <div className="lg:col-span-2">
            <Card className="bg-white shadow-xl border-2 border-gray-200 overflow-hidden">
              <div className="bg-gradient-to-r from-black to-gray-800 p-6 text-white">
                <div className="flex items-center justify-between mb-4">
                  <div className="flex items-center space-x-2">
                    <Shield className="w-6 h-6" />
                    <span className="font-semibold">ISO CERTIFIED</span>
                  </div>
                  <div className="text-right">
                    <p className="text-sm opacity-90">Certificate No.</p>
                    <p className="font-mono font-bold">OCT-20250616-AI7X9K</p>
                  </div>
                </div>
                <h2 className="text-2xl font-bold">OCTAMY SOLUTIONS PRIVATE LIMITED</h2>
                <p className="text-sm opacity-90">ISO 9001:2015 Certified Organization</p>
              </div>

              <CardContent className="p-12">
                <div className="text-center mb-8">
                  <h3 className="text-3xl font-bold text-black mb-2">CERTIFICATE OF COMPLETION</h3>
                  <div className="w-24 h-1 bg-black mx-auto mb-6"></div>
                  
                  <p className="text-lg text-gray-700 mb-4">This is to certify that</p>
                  
                  <h1 className="text-4xl font-bold text-black mb-6">NITIKESH PATTANAYAK</h1>
                  
                  <p className="text-lg text-gray-700 mb-2">has successfully completed the professional certification course</p>
                  
                  <h2 className="text-2xl font-bold text-black mb-6">ARTIFICIAL INTELLIGENCE FUNDAMENTALS</h2>
                  
                  <div className="flex justify-center mb-6">
                    <Badge className="bg-yellow-500 text-black text-lg px-6 py-2 font-bold">
                      🥇 GOLD BADGE
                    </Badge>
                  </div>
                  
                  <p className="text-gray-600 mb-2">with a score of <span className="font-bold text-black">85%</span></p>
                  <p className="text-gray-600 mb-8">demonstrating excellence in artificial intelligence concepts</p>
                </div>

                <div className="flex justify-between items-end">
                  <div className="text-left">
                    <div className="w-32 h-0.5 bg-black mb-2"></div>
                    <p className="text-sm font-semibold">AUTHORIZED SIGNATURE</p>
                    <p className="text-xs text-gray-600">Chief Academic Officer</p>
                  </div>
                  
                  <div className="text-center">
                    <div className="w-20 h-20 bg-black rounded-full flex items-center justify-center mb-2 mx-auto">
                      <Award className="w-12 h-12 text-white" />
                    </div>
                    <p className="text-xs text-gray-600">OFFICIAL SEAL</p>
                  </div>
                  
                  <div className="text-right">
                    <div className="w-32 h-0.5 bg-black mb-2"></div>
                    <p className="text-sm font-semibold">DATE ISSUED</p>
                    <p className="text-xs text-gray-600">June 16, 2025</p>
                  </div>
                </div>

                <div className="mt-8 pt-6 border-t border-gray-200">
                  <div className="flex justify-between text-xs text-gray-500">
                    <span>Valid until: June 16, 2027</span>
                    <span>Verify at: octamy.com/verify/OCT-20250616-AI7X9K</span>
                  </div>
                </div>
              </CardContent>
            </Card>
          </div>

          {/* Certificate Information */}
          <div className="space-y-6">
            <Card>
              <CardContent className="p-6">
                <h3 className="font-bold text-lg mb-4 flex items-center">
                  <Award className="w-5 h-5 mr-2" />
                  Certificate Details
                </h3>
                <div className="space-y-3 text-sm">
                  <div className="flex justify-between">
                    <span className="text-gray-600">Recipient:</span>
                    <span className="font-medium">Nitikesh Pattanayak</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-gray-600">Course:</span>
                    <span className="font-medium">AI Fundamentals</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-gray-600">Score:</span>
                    <span className="font-medium">85%</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-gray-600">Badge:</span>
                    <Badge className="bg-yellow-500 text-black">Gold</Badge>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-gray-600">Issued By:</span>
                    <span className="font-medium">Octamy Solutions</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-gray-600">Date Issued:</span>
                    <span className="font-medium">June 16, 2025</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-gray-600">Valid Until:</span>
                    <span className="font-medium">June 16, 2027</span>
                  </div>
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardContent className="p-6">
                <h3 className="font-bold text-lg mb-4">Verification</h3>
                <p className="text-sm text-gray-600 mb-4">
                  This certificate can be verified using the unique certificate number. All certificates are blockchain-secured and tamper-proof.
                </p>
                <div className="space-y-2">
                  <Button className="w-full bg-black text-white hover:bg-gray-800">
                    <Shield className="w-4 h-4 mr-2" />
                    Verify Certificate
                  </Button>
                  <Button variant="outline" className="w-full border-black text-black hover:bg-black hover:text-white">
                    <Download className="w-4 h-4 mr-2" />
                    Download PDF
                  </Button>
                  <Button variant="outline" className="w-full border-black text-black hover:bg-black hover:text-white">
                    <Share2 className="w-4 h-4 mr-2" />
                    Share Certificate
                  </Button>
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardContent className="p-6">
                <h3 className="font-bold text-lg mb-4">Badge System</h3>
                <div className="space-y-3">
                  <div className="flex items-center space-x-3">
                    <span className="text-2xl">🥉</span>
                    <div>
                      <p className="font-medium">Bronze</p>
                      <p className="text-xs text-gray-600">50-70% Score</p>
                    </div>
                  </div>
                  <div className="flex items-center space-x-3">
                    <span className="text-2xl">🥈</span>
                    <div>
                      <p className="font-medium">Silver</p>
                      <p className="text-xs text-gray-600">70-80% Score</p>
                    </div>
                  </div>
                  <div className="flex items-center space-x-3 bg-yellow-50 p-2 rounded-lg border-2 border-yellow-200">
                    <span className="text-2xl">🥇</span>
                    <div>
                      <p className="font-medium">Gold</p>
                      <p className="text-xs text-gray-600">80-90% Score</p>
                    </div>
                  </div>
                  <div className="flex items-center space-x-3">
                    <span className="text-2xl">💎</span>
                    <div>
                      <p className="font-medium">Platinum</p>
                      <p className="text-xs text-gray-600">90-100% Score</p>
                    </div>
                  </div>
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardContent className="p-6">
                <h3 className="font-bold text-lg mb-4">Get Certified</h3>
                <p className="text-sm text-gray-600 mb-4">
                  Ready to earn your own professional certificate? Start learning today and join thousands of certified professionals.
                </p>
                <Link href="/">
                  <Button className="w-full bg-black text-white hover:bg-gray-800">
                    Start Learning
                  </Button>
                </Link>
              </CardContent>
            </Card>
          </div>
        </div>
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
              <h4 className="font-semibold mb-4">Courses</h4>
              <ul className="space-y-2 text-gray-400">
                <li><Link href="/" className="hover:text-white">AI & Machine Learning</Link></li>
                <li><Link href="/" className="hover:text-white">Development</Link></li>
                <li><Link href="/" className="hover:text-white">Business</Link></li>
                <li><Link href="/" className="hover:text-white">Data Science</Link></li>
              </ul>
            </div>
            <div>
              <h4 className="font-semibold mb-4">Company</h4>
              <ul className="space-y-2 text-gray-400">
                <li><Link href="/help-center" className="hover:text-white">Help Center</Link></li>
                <li><Link href="/partners" className="hover:text-white">Partners</Link></li>
                <li><Link href="/privacy-policy" className="hover:text-white">Privacy Policy</Link></li>
                <li><Link href="/terms-of-service" className="hover:text-white">Terms of Service</Link></li>
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