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
            {/* Professional Certificate Design */}
            <div 
              className="bg-white shadow-2xl relative w-full overflow-hidden"
              style={{ 
                aspectRatio: '1.414/1',
                background: 'linear-gradient(145deg, #ffffff 0%, #f8f9fa 100%)',
                border: '8px solid #000',
                borderRadius: '16px'
              }}
            >
              {/* Decorative borders */}
              <div 
                className="absolute inset-4"
                style={{
                  background: `
                    radial-gradient(circle at 0% 0%, #d4af37 2px, transparent 2px),
                    radial-gradient(circle at 100% 0%, #d4af37 2px, transparent 2px),
                    radial-gradient(circle at 0% 100%, #d4af37 2px, transparent 2px),
                    radial-gradient(circle at 100% 100%, #d4af37 2px, transparent 2px)
                  `,
                  backgroundSize: '40px 40px',
                  backgroundPosition: 'top left, top right, bottom left, bottom right',
                  backgroundRepeat: 'no-repeat'
                }}
              ></div>
              
              {/* Decorative corners */}
              <div className="absolute top-8 left-8 w-28 h-28" style={{ 
                background: `
                  linear-gradient(45deg, #d4af37 1px, transparent 1px 20px, transparent),
                  linear-gradient(-45deg, #d4af37 1px, transparent 1px 20px, transparent)
                `,
                clipPath: 'polygon(0 0, 100% 0, 0 100%)'
              }}></div>
              <div className="absolute top-8 right-8 w-28 h-28" style={{ 
                background: `
                  linear-gradient(135deg, #d4af37 1px, transparent 1px 20px, transparent),
                  linear-gradient(45deg, #d4af37 1px, transparent 1px 20px, transparent)
                `,
                clipPath: 'polygon(100% 0, 100% 100%, 0 0)'
              }}></div>
              <div className="absolute bottom-8 left-8 w-28 h-28" style={{ 
                background: `
                  linear-gradient(-45deg, #d4af37 1px, transparent 1px 20px, transparent),
                  linear-gradient(-135deg, #d4af37 1px, transparent 1px 20px, transparent)
                `,
                clipPath: 'polygon(0 0, 100% 100%, 0 100%)'
              }}></div>
              <div className="absolute bottom-8 right-8 w-28 h-28" style={{ 
                background: `
                  linear-gradient(45deg, #d4af37 1px, transparent 1px 20px, transparent),
                  linear-gradient(135deg, #d4af37 1px, transparent 1px 20px, transparent)
                `,
                clipPath: 'polygon(100% 0, 100% 100%, 0 100%)'
              }}></div>
              
              <div className="relative z-10 p-20 text-center h-full flex flex-col justify-center">
                {/* Header */}
                <div className="mb-16 relative">
                  <div 
                    className="absolute top-0 left-1/2 transform -translate-x-1/2 w-72 h-px"
                    style={{ background: 'linear-gradient(90deg, transparent, #d4af37, transparent)' }}
                  ></div>
                  <div 
                    className="absolute -bottom-5 left-1/2 transform -translate-x-1/2 w-48 h-px"
                    style={{ background: 'linear-gradient(90deg, transparent, #d4af37, transparent)' }}
                  ></div>
                  
                  <div className="inline-block bg-gradient-to-r from-yellow-500 via-yellow-400 to-yellow-500 text-gray-900 px-11 py-6 mb-6 relative"
                       style={{ clipPath: 'polygon(10% 0%, 90% 0%, 100% 25%, 100% 75%, 90% 100%, 10% 100%, 0% 75%, 0% 25%)' }}>
                    <div 
                      className="text-5xl font-bold uppercase tracking-widest"
                      style={{ 
                        fontFamily: "'Cormorant Garamond', serif",
                        letterSpacing: '8px',
                        textShadow: '0 2px 4px rgba(0,0,0,0.1)'
                      }}
                    >
                      OCTAMY
                    </div>
                  </div>
                  
                  <div 
                    className="text-sm font-medium text-gray-600 uppercase tracking-widest mb-4"
                    style={{ fontFamily: "'Inter', sans-serif", letterSpacing: '4px' }}
                  >
                    Solutions Private Limited
                  </div>
                  
                  <div 
                    className="text-xs text-gray-500 italic tracking-wide"
                    style={{ fontFamily: "'Crimson Text', serif", letterSpacing: '1px' }}
                  >
                    Authorized Certification Body
                  </div>
                </div>
                
                {/* Title */}
                <div className="mb-16 relative">
                  <h1 
                    className="text-8xl font-semibold text-gray-900 uppercase mb-5 relative"
                    style={{ 
                      fontFamily: "'Cormorant Garamond', serif",
                      letterSpacing: '16px',
                      textShadow: '0 4px 8px rgba(0,0,0,0.1)'
                    }}
                  >
                    <div 
                      className="absolute -top-4 left-1/2 transform -translate-x-1/2 w-20 h-1"
                      style={{ background: 'linear-gradient(90deg, #d4af37, #f4e09d, #d4af37)' }}
                    ></div>
                    Certificate
                    <div 
                      className="absolute -bottom-4 left-1/2 transform -translate-x-1/2 w-28 h-0.5"
                      style={{ background: 'linear-gradient(90deg, transparent, #d4af37, transparent)' }}
                    ></div>
                  </h1>
                  
                  <p 
                    className="text-3xl text-gray-600 italic tracking-wide"
                    style={{ fontFamily: "'Crimson Text', serif", letterSpacing: '2px' }}
                  >
                    of Professional Excellence
                  </p>
                </div>
                
                {/* Content */}
                <div className="mb-12">
                  <p 
                    className="text-2xl text-gray-700 mb-10 italic tracking-wide"
                    style={{ fontFamily: "'Crimson Text', serif", letterSpacing: '1px' }}
                  >
                    This is to certify that
                  </p>
                  
                  <div 
                    className="text-6xl font-semibold text-gray-900 my-12 py-8 relative tracking-wider"
                    style={{ 
                      fontFamily: "'Cormorant Garamond', serif",
                      letterSpacing: '6px'
                    }}
                  >
                    <div 
                      className="absolute top-0 left-1/2 transform -translate-x-1/2 w-96 h-px"
                      style={{ background: 'linear-gradient(90deg, transparent, #d4af37, transparent)' }}
                    ></div>
                    John Smith
                    <div 
                      className="absolute bottom-0 left-1/2 transform -translate-x-1/2 w-96 h-px"
                      style={{ background: 'linear-gradient(90deg, transparent, #d4af37, transparent)' }}
                    ></div>
                  </div>
                  
                  <p 
                    className="text-xl text-gray-600 my-10 leading-relaxed tracking-wide"
                    style={{ fontFamily: "'Crimson Text', serif", letterSpacing: '0.5px' }}
                  >
                    has successfully demonstrated mastery and completed the comprehensive<br />
                    professional certification program
                  </p>
                  
                  <div 
                    className="text-4xl font-semibold text-gray-900 my-10 uppercase tracking-widest inline-block px-12 py-6 border border-yellow-500 rounded bg-gradient-to-br from-yellow-50 via-yellow-25 to-yellow-50"
                    style={{ 
                      fontFamily: "'Cormorant Garamond', serif",
                      letterSpacing: '4px',
                      background: 'linear-gradient(145deg, rgba(212,175,55,0.1) 0%, rgba(244,224,157,0.15) 50%, rgba(212,175,55,0.1) 100%)',
                      borderColor: '#d4af37'
                    }}
                  >
                    Demo AI Certification Course
                  </div>
                  
                  <div className="flex justify-center items-center gap-10 my-12">
                    <div className="w-20 h-20 bg-gradient-to-br from-yellow-500 via-yellow-400 to-yellow-500 rounded-full flex items-center justify-center shadow-lg">
                      <Award className="w-10 h-10 text-gray-900" />
                    </div>
                    <div 
                      className="bg-gradient-to-br from-yellow-500 via-yellow-400 to-yellow-500 text-gray-900 px-11 py-6 text-2xl font-bold tracking-widest rounded shadow-lg"
                      style={{ 
                        fontFamily: "'Cormorant Garamond', serif",
                        letterSpacing: '3px',
                        boxShadow: '0 6px 12px rgba(212,175,55,0.3)'
                      }}
                    >
                      ACHIEVEMENT SCORE: 95%
                    </div>
                  </div>
                </div>
                
                {/* Details */}
                <div 
                  className="flex justify-between mt-16 pt-10 border-t border-b border-yellow-500 bg-gradient-to-r from-transparent via-yellow-50 to-transparent"
                  style={{ borderColor: '#d4af37' }}
                >
                  <div className="text-center flex-1">
                    <div 
                      className="text-xs text-gray-500 mb-2 uppercase tracking-widest font-semibold"
                      style={{ fontFamily: "'Inter', sans-serif", letterSpacing: '2px' }}
                    >
                      Certificate Number
                    </div>
                    <div 
                      className="text-lg font-semibold text-gray-700 tracking-wide"
                      style={{ fontFamily: "'Crimson Text', serif", letterSpacing: '1px' }}
                    >
                      OCT-2025-DEMO-001
                    </div>
                  </div>
                  <div className="text-center flex-1">
                    <div 
                      className="text-xs text-gray-500 mb-2 uppercase tracking-widest font-semibold"
                      style={{ fontFamily: "'Inter', sans-serif", letterSpacing: '2px' }}
                    >
                      Date of Issue
                    </div>
                    <div 
                      className="text-lg font-semibold text-gray-700 tracking-wide"
                      style={{ fontFamily: "'Crimson Text', serif", letterSpacing: '1px' }}
                    >
                      June 17, 2025
                    </div>
                  </div>
                  <div className="text-center flex-1">
                    <div 
                      className="text-xs text-gray-500 mb-2 uppercase tracking-widest font-semibold"
                      style={{ fontFamily: "'Inter', sans-serif", letterSpacing: '2px' }}
                    >
                      Validity
                    </div>
                    <div 
                      className="text-lg font-semibold text-gray-700 tracking-wide"
                      style={{ fontFamily: "'Crimson Text', serif", letterSpacing: '1px' }}
                    >
                      Lifetime
                    </div>
                  </div>
                </div>
                
                {/* Certification Logos */}
                <div className="flex justify-center items-center gap-8 mt-10 pt-6 border-t-2 border-yellow-500">
                  <img src="https://images.seeklogo.com/logo-png/55/2/iso-certified-company-stamp-logo-png_seeklogo-556487.png" alt="ISO Certified" className="h-12 w-auto object-contain" />
                  <img src="https://static.vecteezy.com/system/resources/previews/019/909/405/non_2x/make-in-india-transparent-make-in-india-free-free-png.png" alt="Make in India" className="h-12 w-auto object-contain" />
                  <img src="https://sudikshya.com/wp-content/uploads/2024/08/startup-and-odisha-combo.png" alt="Startup Odisha" className="h-12 w-auto object-contain" />
                  <img src="https://octamy.com/storage/optionbuilder/uploads/554402-14-2025_0143pmoctamy_logo_black.png" alt="Octamy Logo" className="h-12 w-auto object-contain" />
                </div>
              </div>
            </div>
          </div>

          {/* Certificate Information Sidebar */}
          <div className="space-y-6">
            <Card className="bg-white border-2 border-gray-200">
              <CardContent className="p-6">
                <div className="flex items-center mb-4">
                  <Shield className="w-6 h-6 text-green-600 mr-3" />
                  <h3 className="text-lg font-semibold text-black">Certificate Verification</h3>
                </div>
                <div className="space-y-3">
                  <div>
                    <p className="text-sm text-gray-600">Certificate ID</p>
                    <p className="font-mono text-sm font-semibold">OCT-2025-DEMO-001</p>
                  </div>
                  <div>
                    <p className="text-sm text-gray-600">Issue Date</p>
                    <p className="font-semibold">June 17, 2025</p>
                  </div>
                  <div>
                    <p className="text-sm text-gray-600">Status</p>
                    <Badge className="bg-green-100 text-green-800 border-green-200">
                      Verified & Valid
                    </Badge>
                  </div>
                </div>
              </CardContent>
            </Card>

            <Card className="bg-white border-2 border-gray-200">
              <CardContent className="p-6">
                <div className="flex items-center mb-4">
                  <Award className="w-6 h-6 text-yellow-600 mr-3" />
                  <h3 className="text-lg font-semibold text-black">Achievement Details</h3>
                </div>
                <div className="space-y-3">
                  <div>
                    <p className="text-sm text-gray-600">Course</p>
                    <p className="font-semibold">Demo AI Certification Course</p>
                  </div>
                  <div>
                    <p className="text-sm text-gray-600">Score</p>
                    <p className="font-semibold">95%</p>
                  </div>
                  <div>
                    <p className="text-sm text-gray-600">Badge Level</p>
                    <Badge className="bg-yellow-100 text-yellow-800 border-yellow-200">
                      Gold Badge
                    </Badge>
                  </div>
                </div>
              </CardContent>
            </Card>

            <Card className="bg-white border-2 border-gray-200">
              <CardContent className="p-6">
                <div className="flex items-center mb-4">
                  <Calendar className="w-6 h-6 text-blue-600 mr-3" />
                  <h3 className="text-lg font-semibold text-black">Certificate Actions</h3>
                </div>
                <div className="space-y-3">
                  <Button className="w-full bg-black text-white hover:bg-gray-800">
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

            <Card className="bg-gradient-to-br from-black to-gray-800 text-white border-2 border-gray-200">
              <CardContent className="p-6">
                <h3 className="text-lg font-semibold mb-4">Get Your Certificate</h3>
                <p className="text-sm text-gray-300 mb-4">
                  Take any of our professional courses and earn your own verified certificate.
                </p>
                <Link href="/">
                  <Button className="w-full bg-white text-black hover:bg-gray-100">
                    Browse Courses
                  </Button>
                </Link>
              </CardContent>
            </Card>
          </div>
        </div>

        {/* Professional Features Section */}
        <div className="mt-16 grid grid-cols-1 md:grid-cols-3 gap-8">
          <Card className="bg-white border-2 border-gray-200">
            <CardContent className="p-8 text-center">
              <Shield className="w-12 h-12 text-green-600 mx-auto mb-4" />
              <h3 className="text-xl font-semibold text-black mb-2">Blockchain Verified</h3>
              <p className="text-gray-600">Every certificate is secured and verified using blockchain technology for authenticity.</p>
            </CardContent>
          </Card>

          <Card className="bg-white border-2 border-gray-200">
            <CardContent className="p-8 text-center">
              <Award className="w-12 h-12 text-yellow-600 mx-auto mb-4" />
              <h3 className="text-xl font-semibold text-black mb-2">Industry Recognized</h3>
              <p className="text-gray-600">Our certificates are recognized by leading companies and organizations worldwide.</p>
            </CardContent>
          </Card>

          <Card className="bg-white border-2 border-gray-200">
            <CardContent className="p-8 text-center">
              <Download className="w-12 h-12 text-blue-600 mx-auto mb-4" />
              <h3 className="text-xl font-semibold text-black mb-2">Lifetime Access</h3>
              <p className="text-gray-600">Download and share your certificates anytime with permanent verification links.</p>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}
                      <div className="absolute -bottom-2 left-1/2 transform -translate-x-1/2 bg-yellow-500 text-white px-3 py-1 rounded-full text-xs font-bold">
                        GOLD
                      </div>
                    </div>
                  </div>
                  
                  <p className="text-gray-600 mb-8">demonstrating excellence in artificial intelligence concepts</p>
                </div>

                <div className="flex justify-between items-end">
                  <div className="text-left">
                    <div className="mb-4">
                      <div className="text-2xl font-cursive text-black mb-2" style={{fontFamily: 'cursive'}}>
                        Nitikesh Pattanayak
                      </div>
                      <div className="w-32 h-0.5 bg-black mb-2"></div>
                      <p className="text-sm font-semibold">NITIKESH PATTANAYAK</p>
                      <p className="text-xs text-gray-600">Authorized Signatory</p>
                    </div>
                  </div>
                  
                  <div className="text-center">
                    <div className="w-24 h-24 bg-black rounded-full flex items-center justify-center mb-2 mx-auto border-4 border-gray-300">
                      <div className="text-white text-center">
                        <div className="text-xs font-bold">OCTAMY</div>
                        <div className="text-xs">SOLUTIONS</div>
                        <div className="text-xs">PVT LTD</div>
                      </div>
                    </div>
                    <p className="text-xs text-gray-600 font-semibold">OFFICIAL STAMP</p>
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