import { Link } from "wouter";
import { Button } from "@/components/ui/button";
import Header from "@/components/header";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { ArrowLeft, Award, Calendar, Shield, Download, Share2, Users, Briefcase } from "lucide-react";

export default function DemoInternshipCertificate() {
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
          <h1 className="text-4xl font-bold text-black mb-2">Internship Certificate</h1>
          <p className="text-gray-600">Professional virtual internship completion certificate with mentorship validation.</p>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
          {/* Certificate Display */}
          <div className="lg:col-span-2">
            <Card className="bg-cream-soft shadow-2xl border-4 border-blue-200 overflow-hidden">
              <div className="bg-gradient-to-r from-blue-900 via-blue-800 to-blue-900 p-8 text-white">
                <div className="flex items-center justify-between mb-6">
                  <div className="flex items-center space-x-3">
                    <Briefcase className="w-8 h-8" />
                    <div>
                      <span className="font-bold text-lg">VIRTUAL INTERNSHIP CERTIFICATE</span>
                      <p className="text-sm opacity-90">Professional Experience Program</p>
                    </div>
                  </div>
                  <div className="text-right">
                    <p className="text-sm opacity-90">Certificate No.</p>
                    <p className="font-mono font-bold text-lg">VIN-20250616-DS9X4K</p>
                  </div>
                </div>
                <div className="border-t border-blue-600 pt-4">
                  <h2 className="text-3xl font-bold mb-2">OCTAMY SOLUTIONS PRIVATE LIMITED</h2>
                  <p className="text-sm opacity-90 mb-2">ISO 9001:2015 Certified Virtual Internship Provider</p>
                  <div className="flex items-center space-x-4">
                    <Shield className="w-5 h-5" />
                    <span className="text-sm">Authorized Virtual Training Platform</span>
                  </div>
                </div>
              </div>

              <CardContent className="p-16 bg-gradient-to-br from-blue-50 to-white">
                <div className="text-center mb-10">
                  <div className="mb-8">
                    <div className="w-32 h-32 bg-blue-600 rounded-full flex items-center justify-center mx-auto mb-6">
                      <Users className="w-16 h-16 text-white" />
                    </div>
                    <h3 className="text-4xl font-bold text-black mb-4">INTERNSHIP CERTIFICATE</h3>
                    <div className="w-32 h-2 bg-blue-600 mx-auto mb-8"></div>
                  </div>
                  
                  <p className="text-xl text-gray-700 mb-6">This is to certify that</p>
                  
                  <h1 className="text-5xl font-bold text-black mb-6">RAHUL KUMAR</h1>
                  
                  <p className="text-xl text-gray-700 mb-4">has successfully completed the virtual internship program</p>
                  
                  <h2 className="text-3xl font-bold text-blue-600 mb-8">DATA SCIENCE VIRTUAL INTERNSHIP</h2>
                  
                  <div className="bg-blue-600 text-white p-6 rounded-lg mb-8">
                    <div className="grid grid-cols-2 gap-6">
                      <div>
                        <p className="text-lg font-bold">Duration</p>
                        <p className="text-2xl">12 Weeks</p>
                      </div>
                      <div>
                        <p className="text-lg font-bold">Performance</p>
                        <p className="text-2xl">Excellent</p>
                      </div>
                    </div>
                  </div>
                  
                  <div className="flex justify-center mb-8">
                    <Badge className="bg-green-600 text-white text-xl px-8 py-3 font-bold">
                      🎓 INTERNSHIP COMPLETED
                    </Badge>
                  </div>
                  
                  <div className="bg-gray-100 p-6 rounded-lg mb-8">
                    <p className="text-lg text-gray-700 mb-2">Projects Completed: <span className="font-bold text-black">5 Real-World Projects</span></p>
                    <p className="text-gray-600">Mentorship hours: 40+ | Skills demonstrated: Python, ML, Data Visualization</p>
                  </div>
                </div>

                <div className="grid grid-cols-3 gap-8 items-end">
                  <div className="text-center">
                    <div className="w-40 h-1 bg-blue-600 mb-3"></div>
                    <p className="text-sm font-bold">MENTOR SIGNATURE</p>
                    <p className="text-xs text-gray-600">Senior Data Scientist</p>
                  </div>
                  
                  <div className="text-center">
                    <div className="w-24 h-24 bg-blue-600 rounded-full flex items-center justify-center mb-3 mx-auto">
                      <Briefcase className="w-14 h-14 text-white" />
                    </div>
                    <p className="text-xs text-gray-600 font-bold">INTERNSHIP SEAL</p>
                  </div>
                  
                  <div className="text-center">
                    <div className="w-40 h-1 bg-blue-600 mb-3"></div>
                    <p className="text-sm font-bold">COMPLETION DATE</p>
                    <p className="text-xs text-gray-600">June 16, 2025</p>
                  </div>
                </div>

                <div className="mt-12 pt-8 border-t-2 border-blue-200">
                  <div className="grid grid-cols-2 gap-8 text-xs text-gray-500">
                    <div>
                      <p className="font-bold mb-2">Internship Program Includes:</p>
                      <ul className="space-y-1">
                        <li>• 1-on-1 mentorship sessions</li>
                        <li>• Real industry project experience</li>
                        <li>• LinkedIn recommendation letter</li>
                        <li>• Portfolio development guidance</li>
                      </ul>
                    </div>
                    <div className="text-right">
                      <p><span className="font-bold">Program Duration:</span> 12 weeks</p>
                      <p><span className="font-bold">Verify at:</span> octamy.com/verify/VIN-20250616-DS9X4K</p>
                      <p><span className="font-bold">Mentor:</span> Dr. Sarah Johnson, PhD</p>
                      <p><span className="font-bold">Industry Partner:</span> TechCorp Analytics</p>
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
                  <Briefcase className="w-5 h-5 mr-2" />
                  Internship Certificate Details
                </h3>
                <div className="space-y-3 text-sm">
                  <div className="flex justify-between">
                    <span className="text-gray-600">Intern:</span>
                    <span className="font-medium">Rahul Kumar</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-gray-600">Program:</span>
                    <span className="font-medium">Data Science Internship</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-gray-600">Duration:</span>
                    <span className="font-medium">12 Weeks</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-gray-600">Performance:</span>
                    <span className="font-medium">Excellent</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-gray-600">Projects:</span>
                    <span className="font-medium">5 Completed</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-gray-600">Mentor:</span>
                    <span className="font-medium">Dr. Sarah Johnson</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-gray-600">Completed:</span>
                    <span className="font-medium">June 16, 2025</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-gray-600">Industry Partner:</span>
                    <span className="font-medium">TechCorp Analytics</span>
                  </div>
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardContent className="p-6">
                <h3 className="font-bold text-lg mb-4">Internship Features</h3>
                <div className="space-y-3 text-sm">
                  <div className="flex items-center space-x-3 p-3 bg-blue-50 rounded-lg">
                    <Users className="w-5 h-5 text-blue-600" />
                    <div>
                      <p className="font-medium">1-on-1 Mentorship</p>
                      <p className="text-gray-600">Weekly sessions with experts</p>
                    </div>
                  </div>
                  <div className="flex items-center space-x-3 p-3 bg-green-50 rounded-lg">
                    <Briefcase className="w-5 h-5 text-green-600" />
                    <div>
                      <p className="font-medium">Real Projects</p>
                      <p className="text-gray-600">Industry-relevant experience</p>
                    </div>
                  </div>
                  <div className="flex items-center space-x-3 p-3 bg-purple-50 rounded-lg">
                    <Award className="w-5 h-5 text-purple-600" />
                    <div>
                      <p className="font-medium">Career Support</p>
                      <p className="text-gray-600">LinkedIn recommendations</p>
                    </div>
                  </div>
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardContent className="p-6">
                <h3 className="font-bold text-lg mb-4">Start Your Internship</h3>
                <p className="text-sm text-gray-600 mb-4">
                  Ready to gain real-world experience with our virtual internship program? Apply now and start your professional journey.
                </p>
                <div className="space-y-2">
                  <Link href="/">
                    <Button className="w-full bg-black text-white hover:bg-gray-800">
                      View Internship Programs
                    </Button>
                  </Link>
                  <Link href="/business-certificates">
                    <Button variant="outline" className="w-full border-black text-black hover:bg-black hover:text-white">
                      Business Internships
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