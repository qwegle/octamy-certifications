import { Link } from "wouter";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { ArrowLeft, Award, Calendar, Shield, Download, Share2, Building } from "lucide-react";

export default function DemoBusinessCertificate() {
  return (
    <div className="min-h-screen bg-gray-50">
      {/* Navigation */}
      <nav className="bg-black text-white px-6 py-4">
        <div className="max-w-7xl mx-auto flex items-center justify-between">
          <div className="flex items-center space-x-8">
            <Link href="/" className="text-2xl font-bold">PREMCQ</Link>
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
            <div className="relative group">
              <Button className="bg-white text-black hover:bg-gray-200">
                View Demo Certificates ↓
              </Button>
              <div className="absolute right-0 mt-2 w-64 bg-white rounded-lg shadow-xl border opacity-0 invisible group-hover:opacity-100 group-hover:visible transition-all duration-200 z-50">
                <div className="p-2">
                  <Link href="/demo-certificate">
                    <div className="p-3 hover:bg-gray-50 rounded-lg cursor-pointer">
                      <div className="font-medium text-black">Professional Certificate</div>
                      <div className="text-sm text-gray-600">Standard course completion certificate</div>
                    </div>
                  </Link>
                  <Link href="/demo-business-certificate">
                    <div className="p-3 hover:bg-gray-50 rounded-lg cursor-pointer bg-gray-50">
                      <div className="font-medium text-black">Business Certificate</div>
                      <div className="text-sm text-gray-600">Company-branded team certificate</div>
                    </div>
                  </Link>
                  <Link href="/demo-internship-certificate">
                    <div className="p-3 hover:bg-gray-50 rounded-lg cursor-pointer">
                      <div className="font-medium text-black">Internship Certificate</div>
                      <div className="text-sm text-gray-600">Virtual internship completion</div>
                    </div>
                  </Link>
                </div>
              </div>
            </div>
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
          <h1 className="text-4xl font-bold text-black mb-2">Business Certificate</h1>
          <p className="text-gray-600">Premium company-branded certificate for team certification programs.</p>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
          {/* Certificate Display */}
          <div className="lg:col-span-2">
            <Card className="bg-white shadow-2xl border-4 border-gray-300 overflow-hidden">
              <div className="bg-gradient-to-r from-black via-gray-800 to-black p-8 text-white">
                <div className="flex items-center justify-between mb-6">
                  <div className="flex items-center space-x-3">
                    <Building className="w-8 h-8" />
                    <div>
                      <span className="font-bold text-lg">BUSINESS CERTIFICATE</span>
                      <p className="text-sm opacity-90">Corporate Training Program</p>
                    </div>
                  </div>
                  <div className="text-right">
                    <p className="text-sm opacity-90">Certificate No.</p>
                    <p className="font-mono font-bold text-lg">BCO-20250616-AI8Y2M</p>
                  </div>
                </div>
                <div className="border-t border-gray-600 pt-4">
                  <h2 className="text-3xl font-bold mb-2">PREMCQ SOLUTIONS PRIVATE LIMITED</h2>
                  <p className="text-sm opacity-90 mb-2">ISO 9001:2015 Certified Training Provider</p>
                  <div className="flex items-center space-x-4">
                    <Shield className="w-5 h-5" />
                    <span className="text-sm">Authorized Business Training Partner</span>
                  </div>
                </div>
              </div>

              <CardContent className="p-16 bg-gradient-to-br from-white to-gray-50">
                <div className="text-center mb-10">
                  <div className="mb-8">
                    <div className="w-32 h-32 bg-black rounded-full flex items-center justify-center mx-auto mb-6">
                      <Building className="w-16 h-16 text-white" />
                    </div>
                    <h3 className="text-4xl font-bold text-black mb-4">BUSINESS CERTIFICATE</h3>
                    <div className="w-32 h-2 bg-black mx-auto mb-8"></div>
                  </div>
                  
                  <p className="text-xl text-gray-700 mb-6">This is to certify that</p>
                  
                  <div className="bg-black text-white p-6 rounded-lg mb-8">
                    <h1 className="text-5xl font-bold mb-2">TECH INNOVATIONS PVT LTD</h1>
                    <p className="text-xl opacity-90">Employee: PRIYA SHARMA</p>
                  </div>
                  
                  <p className="text-xl text-gray-700 mb-4">has successfully completed the corporate training program</p>
                  
                  <h2 className="text-3xl font-bold text-black mb-8">ARTIFICIAL INTELLIGENCE FOR BUSINESS</h2>
                  
                  <div className="flex justify-center mb-8">
                    <Badge className="bg-blue-600 text-white text-xl px-8 py-3 font-bold">
                      💎 PLATINUM BUSINESS BADGE
                    </Badge>
                  </div>
                  
                  <div className="bg-gray-100 p-6 rounded-lg mb-8">
                    <p className="text-lg text-gray-700 mb-2">Corporate Training Score: <span className="font-bold text-black">95%</span></p>
                    <p className="text-gray-600">Excellence in AI implementation and business strategy</p>
                  </div>
                </div>

                <div className="grid grid-cols-3 gap-8 items-end">
                  <div className="text-center">
                    <div className="w-40 h-1 bg-black mb-3"></div>
                    <p className="text-sm font-bold">CORPORATE LIAISON</p>
                    <p className="text-xs text-gray-600">Business Development</p>
                  </div>
                  
                  <div className="text-center">
                    <div className="w-24 h-24 bg-black rounded-full flex items-center justify-center mb-3 mx-auto">
                      <Award className="w-14 h-14 text-white" />
                    </div>
                    <p className="text-xs text-gray-600 font-bold">PREMIUM BUSINESS SEAL</p>
                  </div>
                  
                  <div className="text-center">
                    <div className="w-40 h-1 bg-black mb-3"></div>
                    <p className="text-sm font-bold">DATE ISSUED</p>
                    <p className="text-xs text-gray-600">June 16, 2025</p>
                  </div>
                </div>

                <div className="mt-12 pt-8 border-t-2 border-gray-200">
                  <div className="grid grid-cols-2 gap-8 text-xs text-gray-500">
                    <div>
                      <p className="font-bold mb-2">Business Certification Features:</p>
                      <ul className="space-y-1">
                        <li>• Company branding integration</li>
                        <li>• Team performance analytics</li>
                        <li>• Corporate compliance verified</li>
                      </ul>
                    </div>
                    <div className="text-right">
                      <p><span className="font-bold">Valid until:</span> June 16, 2027</p>
                      <p><span className="font-bold">Verify at:</span> premcq.com/verify/BCO-20250616-AI8Y2M</p>
                      <p><span className="font-bold">Business ID:</span> TECH-INNOVATIONS-2025</p>
                    </div>
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
                  <Building className="w-5 h-5 mr-2" />
                  Business Certificate Details
                </h3>
                <div className="space-y-3 text-sm">
                  <div className="flex justify-between">
                    <span className="text-gray-600">Company:</span>
                    <span className="font-medium">Tech Innovations Pvt Ltd</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-gray-600">Employee:</span>
                    <span className="font-medium">Priya Sharma</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-gray-600">Program:</span>
                    <span className="font-medium">AI for Business</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-gray-600">Score:</span>
                    <span className="font-medium">95%</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-gray-600">Badge:</span>
                    <Badge className="bg-blue-600 text-white">Platinum Business</Badge>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-gray-600">Certified By:</span>
                    <span className="font-medium">PremCQ Solutions</span>
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
                <h3 className="font-bold text-lg mb-4">Business Features</h3>
                <div className="space-y-3 text-sm">
                  <div className="flex items-center space-x-3 p-3 bg-blue-50 rounded-lg">
                    <Building className="w-5 h-5 text-blue-600" />
                    <div>
                      <p className="font-medium">Company Branding</p>
                      <p className="text-gray-600">Full company logo and details</p>
                    </div>
                  </div>
                  <div className="flex items-center space-x-3 p-3 bg-green-50 rounded-lg">
                    <Award className="w-5 h-5 text-green-600" />
                    <div>
                      <p className="font-medium">Premium Design</p>
                      <p className="text-gray-600">Enhanced certificate layout</p>
                    </div>
                  </div>
                  <div className="flex items-center space-x-3 p-3 bg-purple-50 rounded-lg">
                    <Shield className="w-5 h-5 text-purple-600" />
                    <div>
                      <p className="font-medium">Corporate Compliance</p>
                      <p className="text-gray-600">Business verification included</p>
                    </div>
                  </div>
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardContent className="p-6">
                <h3 className="font-bold text-lg mb-4">Support Our Project</h3>
                <p className="text-sm text-gray-600 mb-4">
                  Help us continue developing innovative certification solutions. Your support enables us to build better features and reach more learners.
                </p>
                <div className="space-y-2">
                  <Link href="/sponsors">
                    <Button className="w-full bg-black text-white hover:bg-gray-800">
                      Become a Sponsor
                    </Button>
                  </Link>
                  <Link href="/">
                    <Button variant="outline" className="w-full border-black text-black hover:bg-black hover:text-white">
                      View All Courses
                    </Button>
                  </Link>
                </div>
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
              <h3 className="text-2xl font-bold mb-4">PREMCQ</h3>
              <p className="text-gray-400">Professional certification platform for the modern workforce.</p>
            </div>
            <div>
              <h4 className="font-semibold mb-4">Business Solutions</h4>
              <ul className="space-y-2 text-gray-400">
                <li><Link href="/business-certificates" className="hover:text-white">Team Certifications</Link></li>
                <li><Link href="/business-certificates" className="hover:text-white">Company Branding</Link></li>
                <li><Link href="/business-certificates" className="hover:text-white">Bulk Pricing</Link></li>
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
              <p className="text-gray-400 mb-4">ISO Certified by PremCQ Solutions Private Limited</p>
            </div>
          </div>
          <div className="border-t border-gray-800 mt-8 pt-8 text-center text-gray-400">
            <p>&copy; 2025 PremCQ Solutions Private Limited. All rights reserved.</p>
          </div>
        </div>
      </footer>
    </div>
  );
}