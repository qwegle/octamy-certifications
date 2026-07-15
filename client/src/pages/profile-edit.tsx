import { useState, useEffect } from 'react';
import { useQuery, useMutation } from '@tanstack/react-query';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Badge } from '@/components/ui/badge';
import { useAuth } from '@/lib/auth.tsx';
import { useLocation } from 'wouter';
import DashboardLayout from '@/components/dashboard-layout';
import { SEO } from '@/components/seo';
import { User, Save, Upload, FileText, Building2, Sparkles, ShieldCheck, Eye } from 'lucide-react';
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
  evidencePassportPublic?: boolean;
  resume?: string;
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

  // Role flags drive the role-aware "Workspace" cards (institute, creator).
  const { data: roles } = useQuery<{ isCreator: boolean; isInstituteMember: boolean; isRecruiter: boolean }>({
    queryKey: ['/api/me/roles'],
    enabled: !!token,
    queryFn: async () => {
      const res = await fetch('/api/me/roles', { headers: { Authorization: `Bearer ${token}` } });
      if (!res.ok) return { isCreator: false, isInstituteMember: false, isRecruiter: false } as any;
      return res.json();
    },
  });
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
    profileVisibility: false,
    evidencePassportPublic: false,
    resume: '',
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
  const { data: profile, isLoading } = useQuery<UserProfile>({
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
            profileVisibility: false,
            evidencePassportPublic: false,
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
          profileVisibility: data.profileVisibility ?? false,
          evidencePassportPublic: data.evidencePassportPublic ?? false,
          resume: data.resume || '',
        });
        setUploadedCvUrl(data.resume || '');
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
      setFormData((current) => ({ ...current, resume: data.fileUrl }));
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
    onSuccess: () => {
      toast({
        title: 'Profile Updated',
        description: 'Your profile has been successfully updated.',
      });
      setLocation('/dashboard');
    },
    onError: (error: Error) => {
      toast({
        title: 'Update Failed',
        description: error.message || 'Failed to update profile. Please try again.',
        variant: 'destructive',
      });
    },
  });

  const handleInputChange = <K extends keyof UserProfile>(field: K, value: UserProfile[K]) => {
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

  const completionFields = [formData.name, formData.phone, formData.bio, formData.location, formData.currentRole, formData.skills?.length ? "skills" : "", formData.portfolioUrl, formData.resume];
  const completion = Math.round((completionFields.filter(Boolean).length / completionFields.length) * 100);

  if (!user) {
    return (
      <div className="grid min-h-screen place-items-center bg-slate-50 px-5">
        <Card className="w-full max-w-lg rounded-3xl"><CardContent className="p-10 text-center">
          <User className="mx-auto h-10 w-10 text-violet-700" />
          <div className="text-center">
            <h2 className="mt-4 text-2xl font-black text-slate-950">Sign in to manage your profile</h2>
            <p className="mt-2 text-slate-600">Your learner identity, evidence settings, and recruiter visibility stay behind your account.</p>
            <Button className="mt-6" onClick={() => setLocation('/login?next=/profile-edit')}>Sign in</Button>
          </div>
        </CardContent></Card>
      </div>
    );
  }

  if (isLoading) {
    return (
      <DashboardLayout role="learner" title="Profile" description="Loading your learner identity and visibility controls…" breadcrumbs={[{ label: "Learner", href: "/dashboard" }, { label: "Profile" }]}>
        <div className="max-w-5xl">
          <div className="animate-pulse">
            <div className="h-8 bg-gray-200 rounded w-1/3 mb-8"></div>
            <div className="space-y-6">
              {[1, 2, 3, 4].map((i) => (
                <div key={i} className="h-20 bg-gray-200 rounded"></div>
              ))}
            </div>
          </div>
        </div>
      </DashboardLayout>
    );
  }

  return (
    <DashboardLayout role="learner" title="Your learner profile" description="Manage your identity, career context, evidence sharing, and recruiter visibility." breadcrumbs={[{ label: "Learner", href: "/dashboard" }, { label: "Profile" }]} actions={<Button type="submit" form="learner-profile-form" disabled={updateProfileMutation.isPending} className="w-full rounded-xl sm:w-auto"><Save className="mr-2 h-4 w-4" />{updateProfileMutation.isPending ? 'Saving…' : 'Save profile'}</Button>}>
      <SEO title="Learner profile" description="Manage your private Octamy learner profile and evidence sharing preferences." path="/profile-edit" noIndex />
      <div className="max-w-6xl">
        <section className="mb-6 grid gap-3 sm:grid-cols-3" aria-label="Profile summary"><Card><CardContent className="flex items-center gap-4 p-5"><span className="grid h-11 w-11 place-items-center rounded-2xl bg-violet-50 text-violet-700"><User className="h-5 w-5" /></span><div><p className="text-sm text-slate-500">Profile completion</p><p className="text-2xl font-black">{completion}%</p></div></CardContent></Card><Card><CardContent className="flex items-center gap-4 p-5"><span className="grid h-11 w-11 place-items-center rounded-2xl bg-emerald-50 text-emerald-700"><Eye className="h-5 w-5" /></span><div><p className="text-sm text-slate-500">Recruiter visibility</p><p className="font-black">{formData.profileVisibility ? "Visible" : "Private"}</p></div></CardContent></Card><Card><CardContent className="flex items-center gap-4 p-5"><span className="grid h-11 w-11 place-items-center rounded-2xl bg-sky-50 text-sky-700"><ShieldCheck className="h-5 w-5" /></span><div><p className="text-sm text-slate-500">Evidence passport</p><p className="font-black">{formData.evidencePassportPublic ? "Share link on" : "Share link off"}</p></div></CardContent></Card></section>
        <form id="learner-profile-form" onSubmit={handleSubmit}>
          <div className="space-y-6">
            {/* Role-aware workspace cards: link out to org/creator dashboards */}
            {(roles?.isInstituteMember || roles?.isCreator) && (
              <Card className="border-cream-deep">
                <CardHeader>
                  <CardTitle className="flex items-center text-base">
                    <Building2 className="mr-2 h-5 w-5" /> Your workspaces
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <p className="text-sm text-slate-600 mb-3">
                    The fields below are your <strong>personal</strong> profile. Manage organisation- and creator-level settings from their own workspace.
                  </p>
                  <div className="flex flex-wrap gap-2">
                    {roles?.isInstituteMember && (
                      <Button type="button" variant="outline" onClick={() => setLocation('/institute/dashboard')}>
                        <Building2 className="mr-2 h-4 w-4" /> Open institute workspace
                      </Button>
                    )}
                    {roles?.isCreator && (
                      <Button type="button" variant="outline" onClick={() => setLocation('/creator/dashboard')}>
                        <Sparkles className="mr-2 h-4 w-4" /> Open creator workspace
                      </Button>
                    )}
                  </div>
                </CardContent>
              </Card>
            )}

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
                      readOnly
                      className="bg-slate-50 text-slate-500"
                      required
                    />
                    <p className="mt-1 text-xs text-slate-500">Your sign-in email cannot be changed from the public profile form.</p>
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
                  <div className="mt-2 grid gap-2 sm:grid-cols-2">
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
                  <div className="mt-2 grid gap-2 sm:grid-cols-2">
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
                <div><Label htmlFor="github">GitHub profile</Label><Input id="github" type="url" value={formData.github} onChange={(e) => handleInputChange('github', e.target.value)} placeholder="https://github.com/username" /></div>

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
                    checked={formData.profileVisibility ?? false}
                    onChange={(e) => handleInputChange('profileVisibility', e.target.checked)}
                    className="rounded border-gray-300 text-blue-600 focus:ring-blue-500"
                  />
                  <Label htmlFor="profileVisibility">
                    Make my profile visible to recruiters
                  </Label>
                </div>
                <div className="flex items-start space-x-2 rounded-xl border border-slate-200 bg-slate-50 p-4">
                  <input
                    type="checkbox"
                    id="evidencePassportPublic"
                    checked={formData.evidencePassportPublic ?? false}
                    onChange={(e) => handleInputChange('evidencePassportPublic', e.target.checked)}
                    className="mt-1 rounded border-gray-300 text-blue-600 focus:ring-blue-500"
                  />
                  <div>
                    <Label htmlFor="evidencePassportPublic">Enable my shareable Skill Evidence Passport</Label>
                    <p className="mt-1 text-xs leading-5 text-slate-500">Anyone with your private share link can see your name, profile summary, self-reported skills and activated assessment evidence. Your email, phone and CV stay hidden.</p>
                  </div>
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
                      <div className="flex items-center justify-between p-3 bg-cream-deep rounded-lg">
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
    </DashboardLayout>
  );
}
