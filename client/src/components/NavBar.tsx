import { Link } from "wouter";
import { Button } from "@/components/ui/button";
import { Users, Brain, Building2 } from "lucide-react";

export default function NavBar() {
  return (
    <nav className="bg-black border-b border-gray-800">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex justify-between h-16">
          <div className="flex items-center">
            <Link href="/" className="flex-shrink-0">
              <h1 className="text-xl font-bold text-white">Octamy</h1>
            </Link>
            <div className="hidden md:ml-6 md:flex md:space-x-8">
              <Link href="/courses" className="text-gray-300 hover:text-white px-3 py-2 text-sm font-medium">
                Courses
              </Link>
              <Link href="/learning-paths" className="text-gray-300 hover:text-white px-3 py-2 text-sm font-medium">
                Learning Paths
              </Link>
              <Link href="/sponsors" className="text-gray-300 hover:text-white px-3 py-2 text-sm font-medium">
                Sponsors
              </Link>
            </div>
          </div>
          
          <div className="flex items-center space-x-4">
            <Link href="/recruiter-auth">
              <Button variant="outline" className="border-purple-500 text-purple-400 hover:bg-purple-500 hover:text-white">
                <Building2 className="w-4 h-4 mr-2" />
                For Recruiters
              </Button>
            </Link>
            <Link href="/seller-auth">
              <Button variant="outline" className="border-blue-500 text-blue-400 hover:bg-blue-500 hover:text-white">
                <Users className="w-4 h-4 mr-2" />
                Partners
              </Button>
            </Link>
          </div>
        </div>
      </div>
    </nav>
  );
}