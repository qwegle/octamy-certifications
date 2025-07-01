import { Link, useLocation } from "wouter";
import { Button } from "@/components/ui/button";
import { useAuth } from "@/lib/auth.tsx";
import { useState } from "react";
import { Menu, X } from "lucide-react";
import octamyLogoDark from "@/assets/image_1750054456482.png";
import octamyLogoLight from "@/assets/image_1750054465427.png";
export default function Header() {
  const { user, token, logout: authLogout, isLoading } = useAuth();
  const [location, setLocation] = useLocation();
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

  const handleLogout = () => {
    authLogout();
    setLocation("/");
  };
  
  const isAuthenticated = !!user && !!token;

  const isActive = (path: string) => location === path;

  return (
    <header className="bg-black text-white sticky top-0 z-50">
      <div className="max-w-7xl mx-auto px-6 py-4">
        <div className="flex justify-between items-center">
          {/* Logo */}
          <Link href="/" className="flex items-center">
            <span className="text-2xl font-bold">
              <Link href="/" className="text-2xl font-bold">
                <img
                  src={octamyLogoLight}
                  alt="Octamy"
                  className="h-8 dark:block"
                />
              </Link>
            </span>
          </Link>

          {/* Desktop Navigation */}
          <nav className="hidden md:flex space-x-6">
            <Link href="/exams" className="hover:text-gray-300">
              Exams
            </Link>
            {/* <Link href="/learning-paths" className="hover:text-gray-300">Learning Paths</Link> */}
            <Link href="/virtual-internships" className="hover:text-gray-300">
              Internships
            </Link>
            <Link href="/sponsor" className="hover:text-gray-300">
              Sponsors
            </Link>
            <Link
              href="/business-certifications"
              className="hover:text-gray-300"
            >
              Business
            </Link>
            <Link href="/help-center" className="hover:text-gray-300">
              Help
            </Link>
          </nav>

          {/* Auth Buttons */}
          <div className="flex items-center space-x-4">
            {!isLoading && !isAuthenticated ? (
              <>
                <Link href="/auth">
                  <Button
                    variant="outline"
                    className="border-black text-black hover:bg-white hover:text-black"
                  >
                    Login
                  </Button>
                </Link>
                <Link href="/seller-auth">
                  <Button className="bg-white text-black hover:bg-gray-200">
                    Become a Reseller
                  </Button>
                </Link>
              </>
            ) : (
              <>
                <Link href="/dashboard">
                  <Button
                    variant="outline"
                    className="border-white text-white hover:bg-white hover:text-black bg-black"
                  >
                    Dashboard
                  </Button>
                </Link>
                <Button
                  onClick={handleLogout}
                  className="bg-white text-black hover:bg-gray-200"
                >
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
                href="/business-certifications"
                className="hover:text-gray-300"
              >
                Business
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
                      <Button
                        variant="outline"
                        className="w-full border-black text-black hover:bg-white hover:text-black"
                      >
                        Login
                      </Button>
                    </Link>
                    <Link
                      href="/seller-auth"
                      onClick={() => setMobileMenuOpen(false)}
                    >
                      <Button className="w-full bg-white text-black hover:bg-gray-200">
                        Become Reseller
                      </Button>
                    </Link>
                  </div>
                ) : (
                  <div className="space-y-2">
                    <Link
                      href="/dashboard"
                      onClick={() => setMobileMenuOpen(false)}
                    >
                      <Button
                        variant="outline"
                        className="w-full border-white text-black hover:bg-white hover:text-black bg-black"
                      >
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
