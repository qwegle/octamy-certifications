import { useState, useEffect } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useToast } from "@/hooks/use-toast";
import { Building2, Globe, Users, FileText, Save, Shield } from "lucide-react";
import { useRecruiterAuth } from "../auth/RecruiterAuthProvider";

export default function RecruiterSettings() {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const { user } = useRecruiterAuth();
  const [formData, setFormData] = useState({
    companyName: "",
    companyWebsite: "",
    companySize: "",
    industry: "",
    companyAddress: "",
    companyCity: "",
    companyState: "",
    companyCountry: "India",
    gstNumber: "",
    panNumber: "",
    companyRegistrationNumber: ""
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
        companyName: profile.companyName || "",
        companyWebsite: profile.companyWebsite || "",
        companySize: profile.companySize || "",
        industry: profile.industry || "",
        companyAddress: profile.companyAddress || "",
        companyCity: profile.companyCity || "",
        companyState: profile.companyState || "",
        companyCountry: profile.companyCountry || "India",
        gstNumber: profile.gstNumber || "",
        panNumber: profile.panNumber || "",
        companyRegistrationNumber: profile.companyRegistrationNumber || ""
      }));
    }
  }, [profile]);

  // Update company information mutation
  const updateCompanyMutation = useMutation({
    mutationFn: async (data: any) => {
      const response = await fetch("/api/recruiter/company", {
        method: "PUT",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${user?.token}`
        },
        body: JSON.stringify(data)
      });
      
      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.message || "Failed to update company information");
      }
      
      return response.json();
    },
    onSuccess: () => {
      toast({
        title: "Success",
        description: "Company information updated successfully"
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

  const handleCompanyUpdate = (e: React.FormEvent) => {
    e.preventDefault();
    updateCompanyMutation.mutate(formData);
  };

  const companySizes = [
    "1-10", "11-50", "51-200", "201-500", "501-1000", "1000+"
  ];

  const industries = [
    "Technology",
    "Healthcare",
    "Finance",
    "Education",
    "Manufacturing",
    "Retail",
    "Consulting",
    "Media & Entertainment",
    "Real Estate",
    "Government",
    "Non-profit",
    "Other"
  ];

  const indianStates = [
    "Andhra Pradesh", "Arunachal Pradesh", "Assam", "Bihar", "Chhattisgarh",
    "Goa", "Gujarat", "Haryana", "Himachal Pradesh", "Jharkhand", "Karnataka",
    "Kerala", "Madhya Pradesh", "Maharashtra", "Manipur", "Meghalaya", "Mizoram",
    "Nagaland", "Odisha", "Punjab", "Rajasthan", "Sikkim", "Tamil Nadu",
    "Telangana", "Tripura", "Uttar Pradesh", "Uttarakhand", "West Bengal",
    "Delhi", "Puducherry", "Chandigarh", "Dadra and Nagar Haveli and Daman and Diu",
    "Jammu and Kashmir", "Ladakh", "Lakshadweep", "Andaman and Nicobar Islands"
  ];

  if (isLoading) {
    return (
      <div className="min-h-screen bg-cream-soft dark:bg-black p-6">
        <div className="max-w-4xl mx-auto">
          <div className="animate-pulse space-y-6">
            <div className="h-8 bg-gray-200 dark:bg-gray-800 rounded w-1/4"></div>
            <div className="grid grid-cols-1 gap-6">
              <div className="h-96 bg-gray-200 dark:bg-gray-800 rounded"></div>
              <div className="h-96 bg-gray-200 dark:bg-gray-800 rounded"></div>
            </div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-cream-soft dark:bg-black p-6">
      <div className="max-w-4xl mx-auto space-y-6">
        <div className="flex items-center gap-3">
          <Building2 className="h-8 w-8 text-black dark:text-white" />
          <h1 className="text-3xl font-bold text-black dark:text-white">Company Settings</h1>
        </div>

        {/* Company Information */}
        <Card className="border-2 border-cream-deep dark:border-gray-800">
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-black dark:text-white">
              <Building2 className="h-5 w-5" />
              Company Information
            </CardTitle>
          </CardHeader>
          <CardContent>
            <form onSubmit={handleCompanyUpdate} className="space-y-4">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <Label htmlFor="companyName" className="text-black dark:text-white">Company Name *</Label>
                  <Input
                    id="companyName"
                    value={formData.companyName}
                    onChange={(e) => setFormData(prev => ({ ...prev, companyName: e.target.value }))}
                    className="border-gray-300 dark:border-gray-700"
                    required
                  />
                </div>
                <div>
                  <Label htmlFor="companyWebsite" className="text-black dark:text-white">Company Website</Label>
                  <Input
                    id="companyWebsite"
                    type="url"
                    value={formData.companyWebsite}
                    onChange={(e) => setFormData(prev => ({ ...prev, companyWebsite: e.target.value }))}
                    className="border-gray-300 dark:border-gray-700"
                    placeholder="https://yourcompany.com"
                  />
                </div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <Label htmlFor="companySize" className="text-black dark:text-white">Company Size *</Label>
                  <Select value={formData.companySize} onValueChange={(value) => setFormData(prev => ({ ...prev, companySize: value }))}>
                    <SelectTrigger className="border-gray-300 dark:border-gray-700">
                      <SelectValue placeholder="Select company size" />
                    </SelectTrigger>
                    <SelectContent>
                      {companySizes.map((size) => (
                        <SelectItem key={size} value={size}>{size} employees</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div>
                  <Label htmlFor="industry" className="text-black dark:text-white">Industry *</Label>
                  <Select value={formData.industry} onValueChange={(value) => setFormData(prev => ({ ...prev, industry: value }))}>
                    <SelectTrigger className="border-gray-300 dark:border-gray-700">
                      <SelectValue placeholder="Select industry" />
                    </SelectTrigger>
                    <SelectContent>
                      {industries.map((industry) => (
                        <SelectItem key={industry} value={industry}>{industry}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              </div>

              <div>
                <Label htmlFor="companyAddress" className="text-black dark:text-white">Company Address *</Label>
                <Textarea
                  id="companyAddress"
                  value={formData.companyAddress}
                  onChange={(e) => setFormData(prev => ({ ...prev, companyAddress: e.target.value }))}
                  className="border-gray-300 dark:border-gray-700"
                  rows={3}
                  required
                />
              </div>

              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <div>
                  <Label htmlFor="companyCity" className="text-black dark:text-white">City *</Label>
                  <Input
                    id="companyCity"
                    value={formData.companyCity}
                    onChange={(e) => setFormData(prev => ({ ...prev, companyCity: e.target.value }))}
                    className="border-gray-300 dark:border-gray-700"
                    required
                  />
                </div>
                <div>
                  <Label htmlFor="companyState" className="text-black dark:text-white">State *</Label>
                  <Select value={formData.companyState} onValueChange={(value) => setFormData(prev => ({ ...prev, companyState: value }))}>
                    <SelectTrigger className="border-gray-300 dark:border-gray-700">
                      <SelectValue placeholder="Select state" />
                    </SelectTrigger>
                    <SelectContent>
                      {indianStates.map((state) => (
                        <SelectItem key={state} value={state}>{state}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div>
                  <Label htmlFor="companyCountry" className="text-black dark:text-white">Country</Label>
                  <Input
                    id="companyCountry"
                    value={formData.companyCountry}
                    onChange={(e) => setFormData(prev => ({ ...prev, companyCountry: e.target.value }))}
                    className="border-gray-300 dark:border-gray-700"
                    readOnly
                  />
                </div>
              </div>

              <Button 
                type="submit" 
                className="bg-black hover:bg-gray-800 text-white"
                disabled={updateCompanyMutation.isPending}
              >
                <Save className="h-4 w-4 mr-2" />
                {updateCompanyMutation.isPending ? "Updating..." : "Update Company Information"}
              </Button>
            </form>
          </CardContent>
        </Card>

        {/* KYC Information */}
        <Card className="border-2 border-cream-deep dark:border-gray-800">
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-black dark:text-white">
              <Shield className="h-5 w-5" />
              KYC Documents
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <div>
                  <Label htmlFor="gstNumber" className="text-black dark:text-white">GST Number</Label>
                  <Input
                    id="gstNumber"
                    value={formData.gstNumber}
                    onChange={(e) => setFormData(prev => ({ ...prev, gstNumber: e.target.value }))}
                    className="border-gray-300 dark:border-gray-700"
                    placeholder="22AAAAA0000A1Z5"
                    readOnly
                  />
                </div>
                <div>
                  <Label htmlFor="panNumber" className="text-black dark:text-white">PAN Number</Label>
                  <Input
                    id="panNumber"
                    value={formData.panNumber}
                    onChange={(e) => setFormData(prev => ({ ...prev, panNumber: e.target.value }))}
                    className="border-gray-300 dark:border-gray-700"
                    placeholder="ABCDE1234F"
                    readOnly
                  />
                </div>
                <div>
                  <Label htmlFor="companyRegistrationNumber" className="text-black dark:text-white">Company Registration Number</Label>
                  <Input
                    id="companyRegistrationNumber"
                    value={formData.companyRegistrationNumber}
                    onChange={(e) => setFormData(prev => ({ ...prev, companyRegistrationNumber: e.target.value }))}
                    className="border-gray-300 dark:border-gray-700"
                    readOnly
                  />
                </div>
              </div>

              <div className="bg-cream-deep dark:bg-gray-900 p-4 rounded-lg">
                <div className="flex items-center gap-2 mb-2">
                  <Shield className="h-4 w-4 text-gray-600 dark:text-gray-400" />
                  <span className="text-sm font-medium text-gray-600 dark:text-gray-400">KYC Status</span>
                </div>
                <div className="flex items-center gap-2">
                  <div className={`h-3 w-3 rounded-full ${
                    profile?.kycStatus === 'approved' ? 'bg-green-500' :
                    profile?.kycStatus === 'under_review' ? 'bg-yellow-500' : 'bg-red-500'
                  }`}></div>
                  <span className="text-black dark:text-white font-medium capitalize">
                    {profile?.kycStatus?.replace('_', ' ')}
                  </span>
                </div>
                {profile?.kycStatus === 'pending' && (
                  <p className="text-sm text-gray-600 dark:text-gray-400 mt-2">
                    Please complete your registration process to enable KYC verification.
                  </p>
                )}
                {profile?.kycStatus === 'under_review' && (
                  <p className="text-sm text-gray-600 dark:text-gray-400 mt-2">
                    Your KYC documents are under review. You'll be notified once approved.
                  </p>
                )}
                {profile?.kycStatus === 'approved' && (
                  <p className="text-sm text-green-600 dark:text-green-400 mt-2">
                    Your KYC verification is complete. You can now access all platform features.
                  </p>
                )}
              </div>

              <div className="text-sm text-gray-600 dark:text-gray-400">
                <p className="font-medium mb-2">Note:</p>
                <ul className="list-disc list-inside space-y-1">
                  <li>KYC documents are provided during registration and cannot be modified here</li>
                  <li>To update KYC information, please contact our support team</li>
                  <li>KYC approval is required to search candidates and access profiles</li>
                </ul>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Account Status */}
        <Card className="border-2 border-cream-deep dark:border-gray-800">
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-black dark:text-white">
              <Users className="h-5 w-5" />
              Account Status
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
              <div className="text-center">
                <div className="text-2xl font-bold text-black dark:text-white">
                  {profile?.creditsBalance || "0"}
                </div>
                <div className="text-sm text-gray-600 dark:text-gray-400">Credits Balance</div>
              </div>
              <div className="text-center">
                <div className="text-2xl font-bold text-black dark:text-white">
                  {profile?.registrationStep || "1"}/4
                </div>
                <div className="text-sm text-gray-600 dark:text-gray-400">Registration Progress</div>
              </div>
              <div className="text-center">
                <div className={`text-2xl font-bold ${profile?.isActive ? 'text-green-600' : 'text-red-600'}`}>
                  {profile?.isActive ? "Active" : "Inactive"}
                </div>
                <div className="text-sm text-gray-600 dark:text-gray-400">Account Status</div>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}