import { Link, useLocation } from "wouter";
import { Button } from "@/components/ui/button";
import { useAuth } from "@/lib/auth";
import { useState } from "react";
import { Menu, X } from "lucide-react";

export default function Header() {
  const { user, logout } = useAuth();
  const [location] = useLocation();
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

  const isActive = (path: string) => location === path;

  return (
    <header className="bg-white border-b border-octamy-gray-200 sticky top-0 z-50">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex justify-between items-center h-16">
          {/* Logo */}
          <Link href="/" className="flex items-center">
            <span className="text-2xl font-bold text-octamy-black">octamy</span>
          </Link>

          {/* Desktop Navigation */}
          <nav className="hidden md:flex space-x-8">
            <Link
              href="/"
              className={`font-medium transition-colors ${
                isActive("/")
                  ? "text-octamy-black"
                  : "text-octamy-gray-600 hover:text-octamy-black"
              }`}
            >
              Courses
            </Link>
            <Link
              href="/verify"
              className={`font-medium transition-colors ${
                isActive("/verify")
                  ? "text-octamy-black"
                  : "text-octamy-gray-600 hover:text-octamy-black"
              }`}
            >
              Verify Certificate
            </Link>
            {user && (
              <Link
                href="/dashboard"
                className={`font-medium transition-colors ${
                  isActive("/dashboard")
                    ? "text-octamy-black"
                    : "text-octamy-gray-600 hover:text-octamy-black"
                }`}
              >
                Dashboard
              </Link>
            )}
            {user?.isAdmin && (
              <Link
                href="/admin"
                className={`font-medium transition-colors ${
                  isActive("/admin")
                    ? "text-octamy-black"
                    : "text-octamy-gray-600 hover:text-octamy-black"
                }`}
              >
                Admin
              </Link>
            )}
          </nav>

          {/* Auth Buttons */}
          <div className="hidden md:flex items-center space-x-4">
            {user ? (
              <div className="flex items-center space-x-4">
                <span className="text-octamy-gray-600">Welcome, {user.name}</span>
                <Button
                  variant="outline"
                  onClick={logout}
                  className="text-octamy-gray-600 hover:text-octamy-black"
                >
                  Logout
                </Button>
              </div>
            ) : (
              <>
                <Link href="/auth">
                  <Button
                    variant="ghost"
                    className="text-octamy-gray-600 hover:text-octamy-black"
                  >
                    Login
                  </Button>
                </Link>
                <Link href="/auth?mode=register">
                  <Button className="bg-octamy-black text-white hover:bg-octamy-gray-800">
                    Sign Up
                  </Button>
                </Link>
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
          <div className="md:hidden bg-white border-t border-octamy-gray-200">
            <div className="px-4 py-4 space-y-2">
              <Link
                href="/"
                className="block text-octamy-gray-600 hover:text-octamy-black font-medium py-2"
                onClick={() => setMobileMenuOpen(false)}
              >
                Courses
              </Link>
              <Link
                href="/verify"
                className="block text-octamy-gray-600 hover:text-octamy-black font-medium py-2"
                onClick={() => setMobileMenuOpen(false)}
              >
                Verify Certificate
              </Link>
              {user && (
                <Link
                  href="/dashboard"
                  className="block text-octamy-gray-600 hover:text-octamy-black font-medium py-2"
                  onClick={() => setMobileMenuOpen(false)}
                >
                  Dashboard
                </Link>
              )}
              {user?.isAdmin && (
                <Link
                  href="/admin"
                  className="block text-octamy-gray-600 hover:text-octamy-black font-medium py-2"
                  onClick={() => setMobileMenuOpen(false)}
                >
                  Admin
                </Link>
              )}
              <div className="pt-4 border-t border-octamy-gray-200">
                {user ? (
                  <div className="space-y-2">
                    <div className="text-octamy-gray-600 py-2">Welcome, {user.name}</div>
                    <Button
                      variant="outline"
                      onClick={() => {
                        logout();
                        setMobileMenuOpen(false);
                      }}
                      className="w-full"
                    >
                      Logout
                    </Button>
                  </div>
                ) : (
                  <div className="space-y-2">
                    <Link href="/auth" onClick={() => setMobileMenuOpen(false)}>
                      <Button variant="ghost" className="w-full">
                        Login
                      </Button>
                    </Link>
                    <Link href="/auth?mode=register" onClick={() => setMobileMenuOpen(false)}>
                      <Button className="w-full bg-octamy-black text-white hover:bg-octamy-gray-800">
                        Sign Up
                      </Button>
                    </Link>
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
