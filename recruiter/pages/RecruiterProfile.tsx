import { useState, useEffect } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useToast } from "@/hooks/use-toast";
import { User, Building2, Mail, Phone, Save, Eye, EyeOff } from "lucide-react";
import { useRecruiterAuth } from "../auth/RecruiterAuthProvider";

export default function RecruiterProfile() {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const { user } = useRecruiterAuth();
  const [showPassword, setShowPassword] = useState(false);
  const [formData, setFormData] = useState({
    firstName: "",
    lastName: "",
    phone: "",
    designation: "",
    linkedinProfile: "",
    currentPassword: "",
    newPassword: "",
    confirmPassword: ""
  });

  // Fetch recruiter profile data
  const { data: profile, isLoading } = useQuery({
    queryKey: ["/api/recruiter/profile"],
    enabled: !!user?.token,
    meta: {
      headers: {
        Authorization: `Bearer ${user?.token}`
      }
    }
  });

  useEffect(() => {
    if (profile) {
      setFormData(prev => ({
        ...prev,
        firstName: profile.firstName || "",
        lastName: profile.lastName || "",
        phone: profile.phone || "",
        designation: profile.designation || "",
        linkedinProfile: profile.linkedinProfile || ""
      }));
    }
  }, [profile]);

  // Update profile mutation
  const updateProfileMutation = useMutation({
    mutationFn: async (data: any) => {
      const response = await fetch("/api/recruiter/profile", {
        method: "PUT",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${user?.token}`
        },
        body: JSON.stringify(data)
      });
      
      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.message || "Failed to update profile");
      }
      
      return response.json();
    },
    onSuccess: () => {
      toast({
        title: "Success",
        description: "Profile updated successfully"
      });
      queryClient.invalidateQueries({ queryKey: ["/api/recruiter/profile"] });
    },
    onError: (error: any) => {
      toast({
        title: "Error",
        description: error.message,
        variant: "destructive"
      });
    }
  });

  // Change password mutation
  const changePasswordMutation = useMutation({
    mutationFn: async (data: any) => {
      const response = await fetch("/api/recruiter/change-password", {
        method: "PUT",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${user?.token}`
        },
        body: JSON.stringify(data)
      });
      
      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.message || "Failed to change password");
      }
      
      return response.json();
    },
    onSuccess: () => {
      toast({
        title: "Success",
        description: "Password changed successfully"
      });
      setFormData(prev => ({
        ...prev,
        currentPassword: "",
        newPassword: "",
        confirmPassword: ""
      }));
    },
    onError: (error: any) => {
      toast({
        title: "Error",
        description: error.message,
        variant: "destructive"
      });
    }
  });

  const handleProfileUpdate = (e: React.FormEvent) => {
    e.preventDefault();
    
    const profileData = {
      firstName: formData.firstName,
      lastName: formData.lastName,
      phone: formData.phone,
      designation: formData.designation,
      linkedinProfile: formData.linkedinProfile
    };
    
    updateProfileMutation.mutate(profileData);
  };

  const handlePasswordChange = (e: React.FormEvent) => {
    e.preventDefault();
    
    if (formData.newPassword !== formData.confirmPassword) {
      toast({
        title: "Error",
        description: "New passwords do not match",
        variant: "destructive"
      });
      return;
    }
    
    if (formData.newPassword.length < 6) {
      toast({
        title: "Error",
        description: "Password must be at least 6 characters long",
        variant: "destructive"
      });
      return;
    }
    
    const passwordData = {
      currentPassword: formData.currentPassword,
      newPassword: formData.newPassword
    };
    
    changePasswordMutation.mutate(passwordData);
  };

  if (isLoading) {
    return (
      <div className="min-h-screen bg-white dark:bg-black p-6">
        <div className="max-w-4xl mx-auto">
          <div className="animate-pulse space-y-6">
            <div className="h-8 bg-gray-200 dark:bg-gray-800 rounded w-1/4"></div>
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              <div className="h-96 bg-gray-200 dark:bg-gray-800 rounded"></div>
              <div className="h-96 bg-gray-200 dark:bg-gray-800 rounded"></div>
            </div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-white dark:bg-black p-6">
      <div className="max-w-4xl mx-auto space-y-6">
        <div className="flex items-center gap-3">
          <User className="h-8 w-8 text-black dark:text-white" />
          <h1 className="text-3xl font-bold text-black dark:text-white">My Profile</h1>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {/* Profile Information */}
          <Card className="border-2 border-gray-200 dark:border-gray-800">
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-black dark:text-white">
                <User className="h-5 w-5" />
                Personal Information
              </CardTitle>
            </CardHeader>
            <CardContent>
              <form onSubmit={handleProfileUpdate} className="space-y-4">
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <Label htmlFor="firstName" className="text-black dark:text-white">First Name</Label>
                    <Input
                      id="firstName"
                      value={formData.firstName}
                      onChange={(e) => setFormData(prev => ({ ...prev, firstName: e.target.value }))}
                      className="border-gray-300 dark:border-gray-700"
                      required
                    />
                  </div>
                  <div>
                    <Label htmlFor="lastName" className="text-black dark:text-white">Last Name</Label>
                    <Input
                      id="lastName"
                      value={formData.lastName}
                      onChange={(e) => setFormData(prev => ({ ...prev, lastName: e.target.value }))}
                      className="border-gray-300 dark:border-gray-700"
                      required
                    />
                  </div>
                </div>

                <div>
                  <Label htmlFor="phone" className="text-black dark:text-white">Phone Number</Label>
                  <Input
                    id="phone"
                    type="tel"
                    value={formData.phone}
                    onChange={(e) => setFormData(prev => ({ ...prev, phone: e.target.value }))}
                    className="border-gray-300 dark:border-gray-700"
                    required
                  />
                </div>

                <div>
                  <Label htmlFor="designation" className="text-black dark:text-white">Designation</Label>
                  <Input
                    id="designation"
                    value={formData.designation}
                    onChange={(e) => setFormData(prev => ({ ...prev, designation: e.target.value }))}
                    className="border-gray-300 dark:border-gray-700"
                    placeholder="e.g., HR Manager, Talent Acquisition Lead"
                    required
                  />
                </div>

                <div>
                  <Label htmlFor="linkedinProfile" className="text-black dark:text-white">LinkedIn Profile</Label>
                  <Input
                    id="linkedinProfile"
                    type="url"
                    value={formData.linkedinProfile}
                    onChange={(e) => setFormData(prev => ({ ...prev, linkedinProfile: e.target.value }))}
                    className="border-gray-300 dark:border-gray-700"
                    placeholder="https://linkedin.com/in/your-profile"
                  />
                </div>

                <Button 
                  type="submit" 
                  className="w-full bg-black hover:bg-gray-800 text-white"
                  disabled={updateProfileMutation.isPending}
                >
                  <Save className="h-4 w-4 mr-2" />
                  {updateProfileMutation.isPending ? "Updating..." : "Update Profile"}
                </Button>
              </form>
            </CardContent>
          </Card>

          {/* Password Change */}
          <Card className="border-2 border-gray-200 dark:border-gray-800">
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-black dark:text-white">
                <Eye className="h-5 w-5" />
                Change Password
              </CardTitle>
            </CardHeader>
            <CardContent>
              <form onSubmit={handlePasswordChange} className="space-y-4">
                <div>
                  <Label htmlFor="currentPassword" className="text-black dark:text-white">Current Password</Label>
                  <div className="relative">
                    <Input
                      id="currentPassword"
                      type={showPassword ? "text" : "password"}
                      value={formData.currentPassword}
                      onChange={(e) => setFormData(prev => ({ ...prev, currentPassword: e.target.value }))}
                      className="border-gray-300 dark:border-gray-700 pr-10"
                      required
                    />
                    <Button
                      type="button"
                      variant="ghost"
                      size="sm"
                      className="absolute right-2 top-1/2 -translate-y-1/2 h-8 w-8 p-0"
                      onClick={() => setShowPassword(!showPassword)}
                    >
                      {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                    </Button>
                  </div>
                </div>

                <div>
                  <Label htmlFor="newPassword" className="text-black dark:text-white">New Password</Label>
                  <Input
                    id="newPassword"
                    type={showPassword ? "text" : "password"}
                    value={formData.newPassword}
                    onChange={(e) => setFormData(prev => ({ ...prev, newPassword: e.target.value }))}
                    className="border-gray-300 dark:border-gray-700"
                    minLength={6}
                    required
                  />
                </div>

                <div>
                  <Label htmlFor="confirmPassword" className="text-black dark:text-white">Confirm New Password</Label>
                  <Input
                    id="confirmPassword"
                    type={showPassword ? "text" : "password"}
                    value={formData.confirmPassword}
                    onChange={(e) => setFormData(prev => ({ ...prev, confirmPassword: e.target.value }))}
                    className="border-gray-300 dark:border-gray-700"
                    minLength={6}
                    required
                  />
                </div>

                <Button 
                  type="submit" 
                  className="w-full bg-black hover:bg-gray-800 text-white"
                  disabled={changePasswordMutation.isPending}
                >
                  <Save className="h-4 w-4 mr-2" />
                  {changePasswordMutation.isPending ? "Changing..." : "Change Password"}
                </Button>
              </form>
            </CardContent>
          </Card>
        </div>

        {/* Account Information */}
        <Card className="border-2 border-gray-200 dark:border-gray-800">
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-black dark:text-white">
              <Mail className="h-5 w-5" />
              Account Information
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div>
                <Label className="text-sm font-medium text-gray-600 dark:text-gray-400">Email</Label>
                <p className="text-black dark:text-white font-medium">{profile?.email}</p>
              </div>
              <div>
                <Label className="text-sm font-medium text-gray-600 dark:text-gray-400">KYC Status</Label>
                <div className="flex items-center gap-2">
                  <div className={`h-2 w-2 rounded-full ${
                    profile?.kycStatus === 'approved' ? 'bg-green-500' :
                    profile?.kycStatus === 'under_review' ? 'bg-yellow-500' : 'bg-red-500'
                  }`}></div>
                  <span className="text-black dark:text-white font-medium capitalize">
                    {profile?.kycStatus?.replace('_', ' ')}
                  </span>
                </div>
              </div>
              <div>
                <Label className="text-sm font-medium text-gray-600 dark:text-gray-400">Credits Balance</Label>
                <p className="text-black dark:text-white font-medium">{profile?.creditsBalance || "0"} credits</p>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}