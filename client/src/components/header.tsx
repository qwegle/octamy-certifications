import { Link, useLocation } from "wouter";
import { Button } from "@/components/ui/button";
import { useAuth } from "@/lib/auth.tsx";
import { useState } from "react";
import { Menu, X } from "lucide-react";
import premcqLogoDark from "@/assets/image_1750054456482.png";
import premcqLogoLight from "@/assets/image_1750054465427.png";
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
    <header className="bg-white border-b-2 border-gray-200 sticky top-0 z-50">
      <div className="max-w-7xl mx-auto px-6 py-4">
        <div className="flex justify-between items-center">
          {/* Logo */}
          <Link href="/" className="flex items-center">
            <span className="text-2xl font-bold">
              <img
                src={premcqLogoDark}
                alt="PremCq"
                className="h-8"
              />
            </span>
          </Link>

          {/* Desktop Navigation */}
          <nav className="hidden md:flex space-x-6">
            <Link href="/exams" className="text-black hover:text-gray-600">
              Practice Exams
            </Link>
            <Link href="/public-sector-exams" className="text-black hover:text-gray-600">
              Public Sector
            </Link>
            <Link href="/leaderboard" className="text-black hover:text-gray-600">
              Leaderboard
            </Link>
            <Link href="/virtual-internships" className="text-black hover:text-gray-600">
              Internships
            </Link>
            <Link href="/sponsor" className="text-black hover:text-gray-600">
              Sponsors
            </Link>
            <Link
              href="/business-certifications"
              className="text-black hover:text-gray-600"
            >
              Business
            </Link>
            <Link href="/help-center" className="text-black hover:text-gray-600">
              Help
            </Link>
          </nav>

          {/* Auth Buttons */}
          <div className="hidden md:flex items-center space-x-4">
            {!isLoading && !isAuthenticated ? (
              <>
                <Link href="/auth">
                  <Button
                    variant="outline"
                    className="border-black text-black hover:bg-black hover:text-white"
                  >
                    Login
                  </Button>
                </Link>
                <Link href="/seller-auth">
                  <Button className="bg-black text-white hover:bg-gray-800">
                    Become a Reseller
                  </Button>
                </Link>
              </>
            ) : (
              <>
                <Link href="/dashboard">
                  <Button
                    variant="outline"
                    className="border-black text-black hover:bg-black hover:text-white"
                  >
                    Dashboard
                  </Button>
                </Link>
                <Button
                  onClick={handleLogout}
                  className="bg-black text-white hover:bg-gray-800"
                >
                  Logout
                </Button>
              </>
            )}
          </div>

          {/* Mobile menu button */}
          <button
            className="md:hidden text-black"
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
          <div className="md:hidden bg-white border-t border-gray-200">
            <div className="px-4 py-4 space-y-2">
              <Link
                href="/exams"
                className="block text-black hover:text-gray-600 font-medium py-2"
                onClick={() => setMobileMenuOpen(false)}
              >
                Practice Exams
              </Link>
              <Link
                href="/public-sector-exams"
                className="block text-black hover:text-gray-600 font-medium py-2"
                onClick={() => setMobileMenuOpen(false)}
              >
                Public Sector
              </Link>
              <Link
                href="/leaderboard"
                className="block text-black hover:text-gray-600 font-medium py-2"
                onClick={() => setMobileMenuOpen(false)}
              >
                Leaderboard
              </Link>
              <Link
                href="/virtual-internships"
                className="block text-black hover:text-gray-600 font-medium py-2"
                onClick={() => setMobileMenuOpen(false)}
              >
                Internships
              </Link>
              <Link
                href="/sponsor"
                className="block text-black hover:text-gray-600 font-medium py-2"
                onClick={() => setMobileMenuOpen(false)}
              >
                Sponsors
              </Link>
              <Link
                href="/business-certifications"
                className="block text-black hover:text-gray-600 font-medium py-2"
                onClick={() => setMobileMenuOpen(false)}
              >
                Business
              </Link>
              <Link
                href="/help-center"
                className="block text-black hover:text-gray-600 font-medium py-2"
                onClick={() => setMobileMenuOpen(false)}
              >
                Help
              </Link>
              <div className="pt-4 border-t border-gray-200">
                {!isLoading && !isAuthenticated ? (
                  <div className="space-y-2">
                    <Link href="/auth" onClick={() => setMobileMenuOpen(false)}>
                      <Button
                        variant="outline"
                        className="w-full border-black text-black hover:bg-black hover:text-white"
                      >
                        Login
                      </Button>
                    </Link>
                    <Link
                      href="/seller-auth"
                      onClick={() => setMobileMenuOpen(false)}
                    >
                      <Button className="w-full bg-black text-white hover:bg-gray-800">
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
                        className="w-full border-black text-black hover:bg-black hover:text-white"
                      >
                        Dashboard
                      </Button>
                    </Link>
                    <Button
                      onClick={() => {
                        handleLogout();
                        setMobileMenuOpen(false);
                      }}
                      className="w-full bg-black text-white hover:bg-gray-800"
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
