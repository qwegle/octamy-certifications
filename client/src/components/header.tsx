import { Link, useLocation } from "wouter";
import { Button } from "@/components/ui/button";
import { useAuth } from "@/hooks/useAuth";
import { useState } from "react";
import { Menu, X } from "lucide-react";

export default function Header() {
  const { user, isAuthenticated, isLoading } = useAuth();
  const [location] = useLocation();
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

  const logout = () => {
    localStorage.removeItem('authToken');
    window.location.href = '/';
  };

  const isActive = (path: string) => location === path;

  return (
    <header className="bg-black text-white sticky top-0 z-50">
      <div className="max-w-7xl mx-auto px-6 py-4">
        <div className="flex justify-between items-center">
          {/* Logo */}
          <Link href="/" className="flex items-center">
            <span className="text-2xl font-bold">OCTAMY</span>
          </Link>

          {/* Desktop Navigation */}
          <nav className="hidden md:flex space-x-6">
            <Link href="/courses" className="hover:text-gray-300">Courses</Link>
            <Link href="/learning-paths" className="hover:text-gray-300">Learning Paths</Link>
            <Link href="/virtual-internships" className="hover:text-gray-300">Internships</Link>
            <Link href="/sponsor" className="hover:text-gray-300">Sponsors</Link>
            <Link href="/partners" className="hover:text-gray-300">Partners</Link>
            <Link href="/help-center" className="hover:text-gray-300">Help</Link>
          </nav>

          {/* Auth Buttons */}
          <div className="flex items-center space-x-4">
            {!isLoading && !isAuthenticated ? (
              <>
                <Link href="/auth">
                  <Button variant="outline" className="border-white text-white hover:bg-white hover:text-black">
                    Login
                  </Button>
                </Link>
                <Link href="/demo-certificate">
                  <Button className="bg-white text-black hover:bg-gray-200">
                    View Demo Certificate
                  </Button>
                </Link>
              </>
            ) : (
              <>
                <Link href="/dashboard">
                  <Button variant="outline" className="border-white text-white hover:bg-white hover:text-black">
                    Dashboard
                  </Button>
                </Link>
                <Button onClick={logout} className="bg-white text-black hover:bg-gray-200">
                  Logout
                </Button>
              </>
            )}
          </div>

          {/* Mobile menu button */}
          <button
            className="md:hidden"
            onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
          >
            {mobileMenuOpen ? (
              <X className="h-6 w-6" />
            ) : (
              <Menu className="h-6 w-6" />
            )}
          </button>
        </div>

        {/* Mobile Navigation */}
        {mobileMenuOpen && (
          <div className="md:hidden bg-black border-t border-gray-700">
            <div className="px-4 py-4 space-y-2">
              <Link
                href="/courses"
                className="block text-white hover:text-gray-300 font-medium py-2"
                onClick={() => setMobileMenuOpen(false)}
              >
                Courses
              </Link>
              <Link
                href="/learning-paths"
                className="block text-white hover:text-gray-300 font-medium py-2"
                onClick={() => setMobileMenuOpen(false)}
              >
                Learning Paths
              </Link>
              <Link
                href="/virtual-internships"
                className="block text-white hover:text-gray-300 font-medium py-2"
                onClick={() => setMobileMenuOpen(false)}
              >
                Internships
              </Link>
              <Link
                href="/sponsor"
                className="block text-white hover:text-gray-300 font-medium py-2"
                onClick={() => setMobileMenuOpen(false)}
              >
                Sponsors
              </Link>
              <Link
                href="/partners"
                className="block text-white hover:text-gray-300 font-medium py-2"
                onClick={() => setMobileMenuOpen(false)}
              >
                Partners
              </Link>
              <Link
                href="/help-center"
                className="block text-white hover:text-gray-300 font-medium py-2"
                onClick={() => setMobileMenuOpen(false)}
              >
                Help
              </Link>
              <div className="pt-4 border-t border-gray-700">
                {!isLoading && !isAuthenticated ? (
                  <div className="space-y-2">
                    <Link href="/auth" onClick={() => setMobileMenuOpen(false)}>
                      <Button variant="outline" className="w-full border-white text-white hover:bg-white hover:text-black">
                        Login
                      </Button>
                    </Link>
                    <Link href="/demo-certificate" onClick={() => setMobileMenuOpen(false)}>
                      <Button className="w-full bg-white text-black hover:bg-gray-200">
                        View Demo Certificate
                      </Button>
                    </Link>
                  </div>
                ) : (
                  <div className="space-y-2">
                    <Link href="/dashboard" onClick={() => setMobileMenuOpen(false)}>
                      <Button variant="outline" className="w-full border-white text-white hover:bg-white hover:text-black">
                        Dashboard
                      </Button>
                    </Link>
                    <Button
                      onClick={() => {
                        logout();
                        setMobileMenuOpen(false);
                      }}
                      className="w-full bg-white text-black hover:bg-gray-200"
                    >
                      Logout
                    </Button>
                  </div>
                )}
              </div>
            </div>
          </div>
        )}
      </div>
    </header>
  );
}
