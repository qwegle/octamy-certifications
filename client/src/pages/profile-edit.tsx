import { useState, useEffect } from 'react';
import { useQuery, useMutation } from '@tanstack/react-query';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { useAuth } from '@/lib/auth.tsx';
import { useLocation } from 'wouter';
import Header from '@/components/header';
import Footer from '@/components/footer';
import { User, Save, ArrowLeft, Upload, FileText } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';

interface UserProfile {
  name: string;
  email: string;
  phone?: string;
  bio?: string;
  company?: string;
  position?: string;
  linkedin?: string;
  github?: string;
  // Professional fields for recruiter search
  location?: string;
  experience?: number;
  currentRole?: string;
  skills?: string[];
  availability?: string;
  noticePeriod?: string;
  expectedSalary?: string;
  workType?: string[];
  category?: string[];
  linkedinProfile?: string;
  portfolioUrl?: string;
  careerGoals?: string;
  profileVisibility?: boolean;
}

interface FileUploadResponse {
  success: boolean;
  fileUrl: string;
  fileName: string;
}

export default function ProfileEdit() {
  const { user } = useAuth();
  const token = localStorage.getItem('token');
  const [, setLocation] = useLocation();
  const { toast } = useToast();
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [uploadedCvUrl, setUploadedCvUrl] = useState<string>('');
  const [formData, setFormData] = useState<UserProfile>({
    name: user?.name || '',
    email: user?.email || '',
    phone: user?.phone || '',
    bio: '',
    company: '',
    position: '',
    linkedin: '',
    github: '',
    // Professional fields for recruiter search
    location: '',
    experience: 0,
    currentRole: '',
    skills: [],
    availability: '',
    noticePeriod: '',
    expectedSalary: '',
    workType: [],
    category: [],
    linkedinProfile: '',
    portfolioUrl: '',
    careerGoals: '',
    profileVisibility: true,
  });

  // Initialize form with user data when user context loads
  useEffect(() => {
    if (user) {
      setFormData(prev => ({
        ...prev,
        name: user.name || '',
        email: user.email || '',
        phone: user.phone || '',
      }));
    }
  }, [user]);

  // Fetch current profile data - Use existing user data as fallback
  const { data: profile, isLoading } = useQuery({
    queryKey: ['/api/user/profile'],
    enabled: !!user && !!token,
    queryFn: async () => {
      try {
        const response = await fetch('/api/user/profile', {
          headers: { 'Authorization': `Bearer ${token}` },
        });
        if (!response.ok) {
          // If profile endpoint fails, use user data from auth context
          console.log('Profile endpoint failed, using user data from auth context');
          return {
            name: user?.name || '',
            email: user?.email || '',
            phone: user?.phone || '',
            bio: '',
            company: '',
            position: '',
            linkedin: '',
            github: '',
            location: '',
            experience: 0,
            currentRole: '',
            skills: [],
            availability: '',
            noticePeriod: '',
            expectedSalary: '',
            workType: [],
            category: [],
            linkedinProfile: '',
            portfolioUrl: '',
            careerGoals: '',
            profileVisibility: true,
          };
        }
        const data = await response.json();
        setFormData({
          name: data.name || '',
          email: data.email || '',
          phone: data.phone || '',
          bio: data.bio || '',
          company: data.company || '',
          position: data.position || '',
          linkedin: data.linkedin || '',
          github: data.github || '',
          // Professional fields for recruiter search
          location: data.location || '',
          experience: data.experience || 0,
          currentRole: data.currentRole || '',
          skills: data.skills || [],
          availability: data.availability || '',
          noticePeriod: data.noticePeriod || '',
          expectedSalary: data.expectedSalary || '',
          workType: data.workType || [],
          category: data.category || [],
          linkedinProfile: data.linkedinProfile || '',
          portfolioUrl: data.portfolioUrl || '',
          careerGoals: data.careerGoals || '',
          profileVisibility: data.profileVisibility ?? true,
        });
        return data;
      } catch (error) {
        console.error('Error fetching profile:', error);
        throw error;
      }
    },
  });

  // File upload mutation
  const uploadFileMutation = useMutation({
    mutationFn: async (file: File): Promise<FileUploadResponse> => {
      const formData = new FormData();
      formData.append('file', file);
      formData.append('type', 'resume');
      
      const response = await fetch('/api/upload', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${token}`,
        },
        body: formData,
      });
      
      if (!response.ok) throw new Error('Failed to upload file');
      return response.json();
    },
    onSuccess: (data) => {
      setUploadedCvUrl(data.fileUrl);
      toast({
        title: 'File Uploaded',
        description: 'Your CV/Resume has been uploaded successfully.',
      });
    },
    onError: () => {
      toast({
        title: 'Upload Failed',
        description: 'Failed to upload file. Please try again.',
        variant: 'destructive',
      });
    },
  });

  // Update profile mutation
  const updateProfileMutation = useMutation({
    mutationFn: async (profileData: UserProfile) => {
      const response = await fetch('/api/user/profile', {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`,
        },
        body: JSON.stringify(profileData),
      });
      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || 'Failed to update profile');
      }
      return response.json();
    },
    onSuccess: (data) => {
      if (data.success && data.user) {
        toast({
          title: 'Profile Updated',
          description: 'Your profile has been successfully updated.',
        });
        setLocation('/dashboard');
      }
    },
    onError: (error: Error) => {
      toast({
        title: 'Update Failed',
        description: error.message || 'Failed to update profile. Please try again.',
        variant: 'destructive',
      });
    },
  });

  const handleInputChange = (field: keyof UserProfile, value: string) => {
    setFormData(prev => ({ ...prev, [field]: value }));
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      // Validate file type
      const allowedTypes = ['application/pdf', 'application/msword', 'application/vnd.openxmlformats-officedocument.wordprocessingml.document'];
      if (!allowedTypes.includes(file.type)) {
        toast({
          title: 'Invalid File Type',
          description: 'Please upload a PDF or Word document.',
          variant: 'destructive',
        });
        return;
      }
      
      // Validate file size (5MB limit)
      if (file.size > 5 * 1024 * 1024) {
        toast({
          title: 'File Too Large',
          description: 'File size should be less than 5MB.',
          variant: 'destructive',
        });
        return;
      }
      
      setSelectedFile(file);
    }
  };

  const handleFileUpload = () => {
    if (selectedFile) {
      uploadFileMutation.mutate(selectedFile);
    }
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    
    // Basic validation
    if (!formData.name.trim()) {
      toast({
        title: 'Validation Error',
        description: 'Name is required.',
        variant: 'destructive',
      });
      return;
    }
    
    if (!formData.email.trim()) {
      toast({
        title: 'Validation Error',
        description: 'Email is required.',
        variant: 'destructive',
      });
      return;
    }
    
    updateProfileMutation.mutate(formData);
  };

  if (!user) {
    return (
      <div className="min-h-screen bg-white">
        <Header />
        <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-12">
          <div className="text-center">
            <h2 className="text-2xl font-bold text-octamy-black mb-4">Login Required</h2>
            <p className="text-octamy-gray-600">Please log in to edit your profile.</p>
          </div>
        </div>
        <Footer />
      </div>
    );
  }

  if (isLoading) {
    return (
      <div className="min-h-screen bg-white">
        <Header />
        <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-12">
          <div className="animate-pulse">
            <div className="h-8 bg-gray-200 rounded w-1/3 mb-8"></div>
            <div className="space-y-6">
              {[1, 2, 3, 4].map((i) => (
                <div key={i} className="h-20 bg-gray-200 rounded"></div>
              ))}
            </div>
          </div>
        </div>
        <Footer />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-white">
      <Header />
      <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-12">
        {/* Header */}
        <div className="mb-8">
          <Button
            variant="outline"
            onClick={() => setLocation('/dashboard')}
            className="mb-4"
          >
            <ArrowLeft className="mr-2 h-4 w-4" />
            Back to Dashboard
          </Button>
          <h1 className="text-4xl font-bold text-octamy-black mb-2">
            Edit Profile
          </h1>
          <p className="text-xl text-octamy-gray-600">
            Update your personal information and professional details
          </p>
        </div>

        <form onSubmit={handleSubmit}>
          <div className="space-y-6">
            {/* Basic Information */}
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center">
                  <User className="mr-2 h-5 w-5" />
                  Basic Information
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div>
                    <Label htmlFor="name">Full Name *</Label>
                    <Input
                      id="name"
                      value={formData.name}
                      onChange={(e) => handleInputChange('name', e.target.value)}
                      required
                    />
                  </div>
                  <div>
                    <Label htmlFor="email">Email Address *</Label>
                    <Input
                      id="email"
                      type="email"
                      value={formData.email}
                      onChange={(e) => handleInputChange('email', e.target.value)}
                      required
                    />
                  </div>
                </div>
                <div>
                  <Label htmlFor="phone">Phone Number</Label>
                  <Input
                    id="phone"
                    value={formData.phone}
                    onChange={(e) => handleInputChange('phone', e.target.value)}
                    placeholder="+91 9876543210"
                  />
                </div>
                <div>
                  <Label htmlFor="bio">Bio</Label>
                  <Textarea
                    id="bio"
                    value={formData.bio}
                    onChange={(e) => handleInputChange('bio', e.target.value)}
                    placeholder="Tell us about yourself..."
                    rows={3}
                  />
                </div>
              </CardContent>
            </Card>

            {/* Professional Information */}
            <Card>
              <CardHeader>
                <CardTitle>Professional Information</CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div>
                    <Label htmlFor="company">Company</Label>
                    <Input
                      id="company"
                      value={formData.company}
                      onChange={(e) => handleInputChange('company', e.target.value)}
                      placeholder="Your current company"
                    />
                  </div>
                  <div>
                    <Label htmlFor="position">Position</Label>
                    <Input
                      id="position"
                      value={formData.position}
                      onChange={(e) => handleInputChange('position', e.target.value)}
                      placeholder="Your job title"
                    />
                  </div>
                </div>

                {/* Enhanced Professional Fields for Recruiter Search */}
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div>
                    <Label htmlFor="location">Location</Label>
                    <Input
                      id="location"
                      value={formData.location}
                      onChange={(e) => handleInputChange('location', e.target.value)}
                      placeholder="e.g., Mumbai, India"
                    />
                  </div>
                  <div>
                    <Label htmlFor="experience">Years of Experience</Label>
                    <Input
                      id="experience"
                      type="number"
                      min="0"
                      max="50"
                      value={formData.experience}
                      onChange={(e) => handleInputChange('experience', parseInt(e.target.value) || 0)}
                      placeholder="0"
                    />
                  </div>
                </div>

                <div>
                  <Label htmlFor="currentRole">Current Role</Label>
                  <Input
                    id="currentRole"
                    value={formData.currentRole}
                    onChange={(e) => handleInputChange('currentRole', e.target.value)}
                    placeholder="e.g., Senior Software Engineer"
                  />
                </div>

                <div>
                  <Label htmlFor="skills">Skills (Press Enter to add)</Label>
                  <div className="mt-2">
                    <div className="flex flex-wrap gap-2 mb-2">
                      {formData.skills?.map((skill, index) => (
                        <Badge 
                          key={index} 
                          variant="secondary" 
                          className="flex items-center gap-1"
                        >
                          {skill}
                          <button
                            type="button"
                            onClick={() => {
                              const newSkills = [...(formData.skills || [])];
                              newSkills.splice(index, 1);
                              handleInputChange('skills', newSkills);
                            }}
                            className="ml-1 text-red-500 hover:text-red-700"
                          >
                            ×
                          </button>
                        </Badge>
                      ))}
                    </div>
                    <Input
                      placeholder="Add a skill and press Enter"
                      onKeyDown={(e) => {
                        if (e.key === 'Enter') {
                          e.preventDefault();
                          const input = e.target as HTMLInputElement;
                          const skill = input.value.trim();
                          if (skill && !formData.skills?.includes(skill)) {
                            handleInputChange('skills', [...(formData.skills || []), skill]);
                            input.value = '';
                          }
                        }
                      }}
                    />
                  </div>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div>
                    <Label htmlFor="availability">Availability</Label>
                    <select
                      id="availability"
                      value={formData.availability}
                      onChange={(e) => handleInputChange('availability', e.target.value)}
                      className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                    >
                      <option value="">Select Availability</option>
                      <option value="Immediately Available">Immediately Available</option>
                      <option value="Available in 1 month">Available in 1 month</option>
                      <option value="Available in 2-3 months">Available in 2-3 months</option>
                      <option value="Open to opportunities">Open to opportunities</option>
                      <option value="Not actively looking">Not actively looking</option>
                    </select>
                  </div>
                  <div>
                    <Label htmlFor="noticePeriod">Notice Period</Label>
                    <select
                      id="noticePeriod"
                      value={formData.noticePeriod}
                      onChange={(e) => handleInputChange('noticePeriod', e.target.value)}
                      className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                    >
                      <option value="">Select Notice Period</option>
                      <option value="Immediate">Immediate</option>
                      <option value="1 week">1 week</option>
                      <option value="2 weeks">2 weeks</option>
                      <option value="1 month">1 month</option>
                      <option value="2 months">2 months</option>
                      <option value="3 months">3 months</option>
                    </select>
                  </div>
                </div>

                <div>
                  <Label htmlFor="expectedSalary">Expected Salary (Optional)</Label>
                  <Input
                    id="expectedSalary"
                    value={formData.expectedSalary}
                    onChange={(e) => handleInputChange('expectedSalary', e.target.value)}
                    placeholder="e.g., ₹12-15 LPA"
                  />
                </div>

                <div>
                  <Label>Work Type Preferences</Label>
                  <div className="mt-2 space-y-2">
                    {['Remote', 'Hybrid', 'On-site', 'Flexible'].map((type) => (
                      <label key={type} className="flex items-center space-x-2">
                        <input
                          type="checkbox"
                          checked={formData.workType?.includes(type) || false}
                          onChange={(e) => {
                            const currentWorkTypes = formData.workType || [];
                            if (e.target.checked) {
                              handleInputChange('workType', [...currentWorkTypes, type]);
                            } else {
                              handleInputChange('workType', currentWorkTypes.filter(t => t !== type));
                            }
                          }}
                          className="rounded border-gray-300 text-blue-600 focus:ring-blue-500"
                        />
                        <span>{type}</span>
                      </label>
                    ))}
                  </div>
                </div>

                <div>
                  <Label>Professional Categories</Label>
                  <div className="mt-2 space-y-2">
                    {['Software Development', 'Data Science', 'Product Management', 'Design', 'Marketing', 'Sales', 'Operations', 'HR', 'Finance', 'Consulting'].map((category) => (
                      <label key={category} className="flex items-center space-x-2">
                        <input
                          type="checkbox"
                          checked={formData.category?.includes(category) || false}
                          onChange={(e) => {
                            const currentCategories = formData.category || [];
                            if (e.target.checked) {
                              handleInputChange('category', [...currentCategories, category]);
                            } else {
                              handleInputChange('category', currentCategories.filter(c => c !== category));
                            }
                          }}
                          className="rounded border-gray-300 text-blue-600 focus:ring-blue-500"
                        />
                        <span>{category}</span>
                      </label>
                    ))}
                  </div>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div>
                    <Label htmlFor="linkedinProfile">LinkedIn Profile URL</Label>
                    <Input
                      id="linkedinProfile"
                      type="url"
                      value={formData.linkedinProfile}
                      onChange={(e) => handleInputChange('linkedinProfile', e.target.value)}
                      placeholder="https://linkedin.com/in/your-profile"
                    />
                  </div>
                  <div>
                    <Label htmlFor="portfolioUrl">Portfolio/Website URL</Label>
                    <Input
                      id="portfolioUrl"
                      type="url"
                      value={formData.portfolioUrl}
                      onChange={(e) => handleInputChange('portfolioUrl', e.target.value)}
                      placeholder="https://your-portfolio.com"
                    />
                  </div>
                </div>

                <div>
                  <Label htmlFor="careerGoals">Career Goals & Aspirations</Label>
                  <Textarea
                    id="careerGoals"
                    value={formData.careerGoals}
                    onChange={(e) => handleInputChange('careerGoals', e.target.value)}
                    placeholder="Describe your career objectives and where you want to be in the next few years..."
                    rows={3}
                  />
                </div>

                <div className="flex items-center space-x-2">
                  <input
                    type="checkbox"
                    id="profileVisibility"
                    checked={formData.profileVisibility ?? true}
                    onChange={(e) => handleInputChange('profileVisibility', e.target.checked)}
                    className="rounded border-gray-300 text-blue-600 focus:ring-blue-500"
                  />
                  <Label htmlFor="profileVisibility">
                    Make my profile visible to recruiters
                  </Label>
                </div>
              </CardContent>
            </Card>

            {/* CV/Resume Upload */}
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center">
                  <FileText className="mr-2 h-5 w-5" />
                  CV/Resume Upload
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div>
                  <Label htmlFor="cv-upload">Upload CV/Resume (PDF or Word format, max 5MB)</Label>
                  <div className="mt-2 space-y-4">
                    <Input
                      id="cv-upload"
                      type="file"
                      accept=".pdf,.doc,.docx"
                      onChange={handleFileChange}
                      className="file:mr-4 file:py-2 file:px-4 file:rounded-full file:border-0 file:text-sm file:font-semibold file:bg-black file:text-white hover:file:bg-gray-800"
                    />
                    
                    {selectedFile && (
                      <div className="flex items-center justify-between p-3 bg-gray-50 rounded-lg">
                        <div className="flex items-center">
                          <FileText className="h-4 w-4 mr-2 text-gray-600" />
                          <span className="text-sm font-medium">{selectedFile.name}</span>
                          <span className="text-xs text-gray-500 ml-2">
                            ({(selectedFile.size / 1024 / 1024).toFixed(2)} MB)
                          </span>
                        </div>
                        <Button
                          type="button"
                          size="sm"
                          onClick={handleFileUpload}
                          disabled={uploadFileMutation.isPending}
                          className="bg-black text-white hover:bg-gray-800"
                        >
                          <Upload className="h-4 w-4 mr-1" />
                          {uploadFileMutation.isPending ? 'Uploading...' : 'Upload'}
                        </Button>
                      </div>
                    )}
                    
                    {uploadedCvUrl && (
                      <div className="flex items-center p-3 bg-green-50 rounded-lg border border-green-200">
                        <FileText className="h-4 w-4 mr-2 text-green-600" />
                        <span className="text-sm text-green-800">CV uploaded successfully!</span>
                        <Button
                          type="button"
                          size="sm"
                          variant="outline"
                          onClick={() => window.open(uploadedCvUrl, '_blank')}
                          className="ml-auto border-green-300 text-green-700 hover:bg-green-100"
                        >
                          View
                        </Button>
                      </div>
                    )}
                  </div>
                </div>
              </CardContent>
            </Card>

            {/* Social Links */}
            <Card>
              <CardHeader>
                <CardTitle>Social Links</CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div>
                    <Label htmlFor="linkedin">LinkedIn Profile</Label>
                    <Input
                      id="linkedin"
                      value={formData.linkedin}
                      onChange={(e) => handleInputChange('linkedin', e.target.value)}
                      placeholder="https://linkedin.com/in/username"
                    />
                  </div>
                  <div>
                    <Label htmlFor="github">GitHub Profile</Label>
                    <Input
                      id="github"
                      value={formData.github}
                      onChange={(e) => handleInputChange('github', e.target.value)}
                      placeholder="https://github.com/username"
                    />
                  </div>
                </div>
              </CardContent>
            </Card>

            {/* Save Button */}
            <div className="flex justify-end">
              <Button
                type="submit"
                disabled={updateProfileMutation.isPending}
                className="px-8"
              >
                <Save className="mr-2 h-4 w-4" />
                {updateProfileMutation.isPending ? 'Saving...' : 'Save Changes'}
              </Button>
            </div>
          </div>
        </form>
      </div>
      <Footer />
    </div>
  );
}