import { useState, useEffect } from 'react';
import { useLocation } from 'wouter';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Textarea } from '@/components/ui/textarea';
import { useToast } from '@/hooks/use-toast';
import { useRecruiterAuth } from '../auth/RecruiterAuthProvider';
import { apiRequest } from '@/lib/queryClient';
import { 
  User, 
  Building2, 
  FileText, 
  CheckCircle, 
  Upload,
  ArrowLeft,
  ArrowRight
} from 'lucide-react';
import { step1Schema, step2Schema, step3Schema, type Step1Data, type Step2Data, type Step3Data } from '../schema';

const COMPANY_SIZES = [
  { value: '1-10', label: '1-10 employees' },
  { value: '11-50', label: '11-50 employees' },
  { value: '51-200', label: '51-200 employees' },
  { value: '201-500', label: '201-500 employees' },
  { value: '500+', label: '500+ employees' },
];

const INDUSTRIES = [
  'Technology', 'Healthcare', 'Finance', 'Education', 'Manufacturing',
  'Retail', 'Consulting', 'Media', 'Real Estate', 'Transportation',
  'Energy', 'Government', 'Non-profit', 'Other'
];

export default function RecruiterOnboarding() {
  const [, setLocation] = useLocation();
  const { recruiter, updateRegistrationStep, token } = useRecruiterAuth();
  const { toast } = useToast();
  
  const [currentStep, setCurrentStep] = useState(1);
  const [isLoading, setIsLoading] = useState(false);
  const [uploadingFiles, setUploadingFiles] = useState<{ [key: string]: boolean }>({});
  
  // Form data for each step
  const [step1Data, setStep1Data] = useState<Step1Data>({
    firstName: '',
    lastName: '',
    phone: '',
    designation: '',
    linkedinProfile: '',
  });
  
  const [step2Data, setStep2Data] = useState<Step2Data>({
    companyName: '',
    companyWebsite: '',
    companySize: '1-10',
    industry: '',
    companyAddress: '',
    companyCity: '',
    companyState: '',
    companyCountry: 'India',
  });
  
  const [step3Data, setStep3Data] = useState<Step3Data>({
    gstNumber: '',
    panNumber: '',
    companyRegistrationNumber: '',
    gstCertificate: '',
    panCard: '',
    companyRegistrationCertificate: '',
  });

  useEffect(() => {
    if (recruiter) {
      setCurrentStep(recruiter.registrationStep || 1);
      
      // If registration is complete, redirect to dashboard
      if (recruiter.registrationStep >= 4) {
        setLocation('/recruiter/dashboard');
      }
    }
  }, [recruiter, setLocation]);

  const handleFileUpload = async (file: File, fieldName: string) => {
    if (!file) return;

    setUploadingFiles(prev => ({ ...prev, [fieldName]: true }));

    const formData = new FormData();
    formData.append('file', file);
    formData.append('upload_preset', 'recruiter_kyc');

    try {
      const response = await fetch(`https://api.cloudinary.com/v1_1/${process.env.CLOUDINARY_CLOUD_NAME}/upload`, {
        method: 'POST',
        body: formData,
      });

      if (!response.ok) {
        throw new Error('Upload failed');
      }

      const data = await response.json();
      
      setStep3Data(prev => ({
        ...prev,
        [fieldName]: data.secure_url,
      }));

      toast({
        title: "Upload Successful",
        description: `${fieldName.replace(/([A-Z])/g, ' $1').toLowerCase()} uploaded successfully.`,
      });
    } catch (error) {
      toast({
        title: "Upload Failed",
        description: "Failed to upload file. Please try again.",
        variant: "destructive",
      });
    } finally {
      setUploadingFiles(prev => ({ ...prev, [fieldName]: false }));
    }
  };

  const validateCurrentStep = () => {
    try {
      switch (currentStep) {
        case 1:
          step1Schema.parse(step1Data);
          return true;
        case 2:
          step2Schema.parse(step2Data);
          return true;
        case 3:
          step3Schema.parse(step3Data);
          return true;
        default:
          return false;
      }
    } catch (error) {
      if (error instanceof Error) {
        toast({
          title: "Validation Error",
          description: error.message,
          variant: "destructive",
        });
      }
      return false;
    }
  };

  const handleNext = async () => {
    if (!validateCurrentStep()) return;

    setIsLoading(true);

    try {
      let dataToSend;
      let endpoint;

      switch (currentStep) {
        case 1:
          dataToSend = step1Data;
          endpoint = '/api/recruiter/onboarding/step1';
          break;
        case 2:
          dataToSend = step2Data;
          endpoint = '/api/recruiter/onboarding/step2';
          break;
        case 3:
          dataToSend = step3Data;
          endpoint = '/api/recruiter/onboarding/step3';
          break;
        default:
          return;
      }

      const response = await apiRequest('POST', endpoint, dataToSend);
      
      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.message || 'Failed to save data');
      }

      const nextStep = currentStep + 1;
      setCurrentStep(nextStep);
      updateRegistrationStep(nextStep);

      if (currentStep === 3) {
        toast({
          title: "Registration Complete!",
          description: "Your profile has been submitted for KYC review.",
        });
        setTimeout(() => setLocation('/recruiter/dashboard'), 2000);
      } else {
        toast({
          title: "Step Completed",
          description: `Step ${currentStep} completed successfully.`,
        });
      }
    } catch (error) {
      toast({
        title: "Error",
        description: error instanceof Error ? error.message : "Failed to save data. Please try again.",
        variant: "destructive",
      });
    } finally {
      setIsLoading(false);
    }
  };

  const handlePrevious = () => {
    if (currentStep > 1) {
      setCurrentStep(currentStep - 1);
    }
  };

  const renderStep1 = () => (
    <div className="space-y-6">
      <div className="grid grid-cols-2 gap-4">
        <div className="space-y-2">
          <Label htmlFor="firstName">First Name *</Label>
          <Input
            id="firstName"
            value={step1Data.firstName}
            onChange={(e) => setStep1Data({ ...step1Data, firstName: e.target.value })}
            placeholder="John"
          />
        </div>
        <div className="space-y-2">
          <Label htmlFor="lastName">Last Name *</Label>
          <Input
            id="lastName"
            value={step1Data.lastName}
            onChange={(e) => setStep1Data({ ...step1Data, lastName: e.target.value })}
            placeholder="Doe"
          />
        </div>
      </div>

      <div className="space-y-2">
        <Label htmlFor="phone">Phone Number *</Label>
        <Input
          id="phone"
          value={step1Data.phone}
          onChange={(e) => setStep1Data({ ...step1Data, phone: e.target.value })}
          placeholder="+91 9876543210"
        />
      </div>

      <div className="space-y-2">
        <Label htmlFor="designation">Designation *</Label>
        <Input
          id="designation"
          value={step1Data.designation}
          onChange={(e) => setStep1Data({ ...step1Data, designation: e.target.value })}
          placeholder="HR Manager / Talent Acquisition Lead"
        />
      </div>

      <div className="space-y-2">
        <Label htmlFor="linkedinProfile">LinkedIn Profile</Label>
        <Input
          id="linkedinProfile"
          value={step1Data.linkedinProfile}
          onChange={(e) => setStep1Data({ ...step1Data, linkedinProfile: e.target.value })}
          placeholder="https://linkedin.com/in/yourprofile"
        />
      </div>
    </div>
  );

  const renderStep2 = () => (
    <div className="space-y-6">
      <div className="space-y-2">
        <Label htmlFor="companyName">Company Name *</Label>
        <Input
          id="companyName"
          value={step2Data.companyName}
          onChange={(e) => setStep2Data({ ...step2Data, companyName: e.target.value })}
          placeholder="Tech Corp Pvt Ltd"
        />
      </div>

      <div className="space-y-2">
        <Label htmlFor="companyWebsite">Company Website</Label>
        <Input
          id="companyWebsite"
          value={step2Data.companyWebsite}
          onChange={(e) => setStep2Data({ ...step2Data, companyWebsite: e.target.value })}
          placeholder="https://www.company.com"
        />
      </div>

      <div className="grid grid-cols-2 gap-4">
        <div className="space-y-2">
          <Label htmlFor="companySize">Company Size *</Label>
          <Select value={step2Data.companySize} onValueChange={(value) => setStep2Data({ ...step2Data, companySize: value as any })}>
            <SelectTrigger>
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {COMPANY_SIZES.map((size) => (
                <SelectItem key={size.value} value={size.value}>
                  {size.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        <div className="space-y-2">
          <Label htmlFor="industry">Industry *</Label>
          <Select value={step2Data.industry} onValueChange={(value) => setStep2Data({ ...step2Data, industry: value })}>
            <SelectTrigger>
              <SelectValue placeholder="Select industry" />
            </SelectTrigger>
            <SelectContent>
              {INDUSTRIES.map((industry) => (
                <SelectItem key={industry} value={industry}>
                  {industry}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      </div>

      <div className="space-y-2">
        <Label htmlFor="companyAddress">Company Address *</Label>
        <Textarea
          id="companyAddress"
          value={step2Data.companyAddress}
          onChange={(e) => setStep2Data({ ...step2Data, companyAddress: e.target.value })}
          placeholder="Complete address with building name/number"
          rows={3}
        />
      </div>

      <div className="grid grid-cols-3 gap-4">
        <div className="space-y-2">
          <Label htmlFor="companyCity">City *</Label>
          <Input
            id="companyCity"
            value={step2Data.companyCity}
            onChange={(e) => setStep2Data({ ...step2Data, companyCity: e.target.value })}
            placeholder="Mumbai"
          />
        </div>
        <div className="space-y-2">
          <Label htmlFor="companyState">State *</Label>
          <Input
            id="companyState"
            value={step2Data.companyState}
            onChange={(e) => setStep2Data({ ...step2Data, companyState: e.target.value })}
            placeholder="Maharashtra"
          />
        </div>
        <div className="space-y-2">
          <Label htmlFor="companyCountry">Country *</Label>
          <Input
            id="companyCountry"
            value={step2Data.companyCountry}
            onChange={(e) => setStep2Data({ ...step2Data, companyCountry: e.target.value })}
            placeholder="India"
          />
        </div>
      </div>
    </div>
  );

  const renderStep3 = () => (
    <div className="space-y-6">
      <div className="bg-gray-100 p-6 rounded-lg border-l-4 border-black">
        <div className="flex items-start space-x-3">
          <Shield className="h-6 w-6 text-black mt-1" />
          <div>
            <h4 className="font-semibold text-black mb-2">Secure Business Verification</h4>
            <p className="text-sm text-gray-700">
              Upload your company documents for KYC verification. This ensures platform security and builds trust with candidates.
            </p>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-2 gap-6">
        <div className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="gstNumber">GST Number</Label>
            <Input
              id="gstNumber"
              value={step3Data.gstNumber}
              onChange={(e) => setStep3Data({ ...step3Data, gstNumber: e.target.value })}
              placeholder="22AAAAA0000A1Z5"
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="panNumber">PAN Number</Label>
            <Input
              id="panNumber"
              value={step3Data.panNumber}
              onChange={(e) => setStep3Data({ ...step3Data, panNumber: e.target.value })}
              placeholder="AAAAA0000A"
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="companyRegistrationNumber">Company Registration Number</Label>
            <Input
              id="companyRegistrationNumber"
              value={step3Data.companyRegistrationNumber}
              onChange={(e) => setStep3Data({ ...step3Data, companyRegistrationNumber: e.target.value })}
              placeholder="U72900DL2019PTC350071"
            />
          </div>
        </div>

        <div className="space-y-4">
          {[
            { key: 'gstCertificate', label: 'GST Certificate' },
            { key: 'panCard', label: 'PAN Card' },
            { key: 'companyRegistrationCertificate', label: 'Company Registration Certificate' },
          ].map(({ key, label }) => (
            <div key={key} className="space-y-2">
              <Label htmlFor={key}>{label}</Label>
              <div className="flex items-center space-x-2">
                <Input
                  type="file"
                  accept=".pdf,.jpg,.jpeg,.png"
                  onChange={(e) => {
                    const file = e.target.files?.[0];
                    if (file) handleFileUpload(file, key);
                  }}
                  className="flex-1"
                />
                {uploadingFiles[key] && (
                  <div className="animate-spin w-4 h-4 border-2 border-blue-600 border-t-transparent rounded-full" />
                )}
                {step3Data[key as keyof Step3Data] && (
                  <CheckCircle className="h-4 w-4 text-green-600" />
                )}
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );

  const steps = [
    { number: 1, title: 'Personal Information', icon: User, component: renderStep1 },
    { number: 2, title: 'Company Details', icon: Building2, component: renderStep2 },
    { number: 3, title: 'KYC Documents', icon: FileText, component: renderStep3 },
  ];

  return (
    <div className="min-h-screen bg-black text-white py-8" style={{ fontFamily: 'Poppins, sans-serif' }}>
      <div className="max-w-5xl mx-auto px-4">
        <div className="text-center mb-8">
          <div className="flex items-center justify-center space-x-2 mb-4">
            <Building2 className="h-8 w-8 text-white" />
            <h1 className="text-3xl font-bold text-white">Welcome to Octamy AI Recruiter</h1>
          </div>
          <p className="text-gray-300 text-lg">Let's set up your premium recruitment experience</p>
        </div>

        {/* Progress Steps */}
        <div className="flex items-center justify-center mb-12">
          {steps.map((step, index) => {
            const Icon = step.icon;
            const isActive = currentStep === step.number;
            const isCompleted = currentStep > step.number;
            
            return (
              <div key={step.number} className="flex items-center">
                <div className={`flex items-center space-x-3 px-6 py-3 rounded-full border-2 transition-all ${
                  isActive ? 'bg-white text-black border-white' : 
                  isCompleted ? 'bg-gray-800 text-white border-gray-600' : 
                  'bg-transparent text-gray-400 border-gray-600'
                }`}>
                  <div className={`flex items-center justify-center w-8 h-8 rounded-full ${
                    isActive ? 'bg-black text-white' : 
                    isCompleted ? 'bg-white text-black' : 
                    'bg-gray-700 text-gray-400'
                  }`}>
                    {isCompleted ? <CheckCircle className="h-5 w-5" /> : <Icon className="h-4 w-4" />}
                  </div>
                  <span className="font-medium text-sm">{step.title}</span>
                </div>
                {index < steps.length - 1 && (
                  <div className={`h-0.5 w-16 mx-4 ${
                    isCompleted ? 'bg-white' : 'bg-gray-600'
                  }`} />
                )}
              </div>
            );
          })}
        </div>

        {/* Form Card */}
        <Card className="bg-white text-black shadow-2xl border-0">
          <CardHeader className="bg-gray-50 border-b">
            <CardTitle className="text-2xl font-bold text-center">
              {steps[currentStep - 1]?.title}
            </CardTitle>
            <p className="text-gray-600 text-center mt-2">
              {currentStep === 1 && "Tell us about yourself"}
              {currentStep === 2 && "Share your company details"}  
              {currentStep === 3 && "Verify your business credentials"}
            </p>
          </CardHeader>
          <CardContent className="p-8">
            {steps[currentStep - 1]?.component()}

            <div className="flex justify-between mt-10">
              <Button
                variant="outline"
                onClick={handlePrevious}
                disabled={currentStep === 1}
                className="flex items-center space-x-2 border-gray-300 text-gray-700 hover:bg-gray-50"
              >
                <ArrowLeft className="h-4 w-4" />
                <span>Previous</span>
              </Button>

              <Button
                onClick={handleNext}
                disabled={isLoading}
                className="bg-black hover:bg-gray-800 text-white flex items-center space-x-2 px-8"
              >
                {isLoading ? (
                  <div className="animate-spin w-4 h-4 border-2 border-white border-t-transparent rounded-full" />
                ) : (
                  <>
                    <span>{currentStep === 3 ? 'Complete Setup' : 'Continue'}</span>
                    <ArrowRight className="h-4 w-4" />
                  </>
                )}
              </Button>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}