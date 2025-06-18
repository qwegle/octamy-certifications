import { useState, useEffect } from "react";
import { useLocation, useRoute } from "wouter";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { useToast } from "@/hooks/use-toast";
import { apiRequest } from "@/lib/queryClient";
import { Package, MapPin, Plus, Edit2, Trash2, Star } from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui/form";

const addressSchema = z.object({
  fullName: z.string().min(2, "Full name is required"),
  addressLine1: z.string().min(5, "Address line 1 is required"),
  addressLine2: z.string().optional(),
  city: z.string().min(2, "City is required"),
  state: z.string().min(2, "State is required"),
  postalCode: z.string().min(5, "Valid postal code is required"),
  country: z.string().min(2, "Country is required"),
  phone: z.string().min(10, "Valid phone number is required"),
  isDefault: z.boolean().default(false),
});

type AddressFormData = z.infer<typeof addressSchema>;

interface Address {
  id: number;
  fullName: string;
  addressLine1: string;
  addressLine2?: string;
  city: string;
  state: string;
  postalCode: string;
  country: string;
  phone: string;
  isDefault: boolean;
}

interface Course {
  id: number;
  title: string;
  description: string;
  price: string;
  categoryId: number;
  level: string;
  isActive: boolean;
  isInternship: boolean;
}

export default function EnhancedCheckout() {
  const [, navigate] = useLocation();
  const [match, params] = useRoute("/checkout/:courseId");
  const { toast } = useToast();
  const queryClient = useQueryClient();
  
  const [includesPhysicalCopy, setIncludesPhysicalCopy] = useState(false);
  const [selectedAddressId, setSelectedAddressId] = useState<number | null>(null);
  const [showAddressDialog, setShowAddressDialog] = useState(false);
  const [editingAddress, setEditingAddress] = useState<Address | null>(null);
  const [referralCode, setReferralCode] = useState<string | null>(null);

  const courseId = params?.courseId ? parseInt(params.courseId) : null;

  // Extract referral code from localStorage or URL parameters
  useEffect(() => {
    const urlParams = new URLSearchParams(window.location.search);
    const ref = urlParams.get('ref');
    if (ref) {
      setReferralCode(ref);
      localStorage.setItem('referralCode', ref);
    } else {
      const storedRef = localStorage.getItem('referralCode');
      if (storedRef) {
        setReferralCode(storedRef);
      }
    }
  }, []);

  // Fetch course details
  const { data: course, isLoading: courseLoading } = useQuery<Course>({
    queryKey: ["/api/courses", courseId],
    enabled: !!courseId,
    queryFn: async () => {
      const response = await fetch(`/api/courses/${courseId}`);
      if (!response.ok) {
        throw new Error('Course not found');
      }
      return response.json();
    },
  });

  // Fetch user addresses
  const { data: addresses = [], isLoading: addressesLoading } = useQuery<Address[]>({
    queryKey: ["/api/user/addresses"],
    retry: false,
  });

  // Check if user has a certificate for this course
  const { data: existingCertificate, isLoading: certificateLoading } = useQuery({
    queryKey: [`/api/user/certificate-for-course/${courseId}`],
    enabled: !!courseId,
    retry: false,
  });

  // Find default address
  useEffect(() => {
    const defaultAddress = addresses.find(addr => addr.isDefault);
    if (defaultAddress && !selectedAddressId) {
      setSelectedAddressId(defaultAddress.id);
    }
  }, [addresses, selectedAddressId]);

  const form = useForm<AddressFormData>({
    resolver: zodResolver(addressSchema),
    defaultValues: {
      fullName: "",
      addressLine1: "",
      addressLine2: "",
      city: "",
      state: "",
      postalCode: "",
      country: "India",
      phone: "",
      isDefault: false,
    },
  });

  // Create address mutation
  const createAddressMutation = useMutation({
    mutationFn: async (data: AddressFormData) => {
      return await apiRequest("/api/user/addresses", "POST", data);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/user/addresses"] });
      setShowAddressDialog(false);
      form.reset();
      toast({
        title: "Success",
        description: "Address added successfully",
      });
    },
    onError: (error) => {
      toast({
        title: "Error",
        description: "Failed to add address",
        variant: "destructive",
      });
    },
  });

  // Update address mutation
  const updateAddressMutation = useMutation({
    mutationFn: async ({ id, data }: { id: number; data: AddressFormData }) => {
      return await apiRequest(`/api/user/addresses/${id}`, "PUT", data);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/user/addresses"] });
      setShowAddressDialog(false);
      setEditingAddress(null);
      form.reset();
      toast({
        title: "Success",
        description: "Address updated successfully",
      });
    },
    onError: (error) => {
      toast({
        title: "Error",
        description: "Failed to update address",
        variant: "destructive",
      });
    },
  });

  // Delete address mutation
  const deleteAddressMutation = useMutation({
    mutationFn: async (id: number) => {
      return await apiRequest(`/api/user/addresses/${id}`, "DELETE");
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/user/addresses"] });
      toast({
        title: "Success",
        description: "Address deleted successfully",
      });
    },
    onError: (error) => {
      toast({
        title: "Error",
        description: "Failed to delete address",
        variant: "destructive",
      });
    },
  });

  const handleAddressSubmit = (data: AddressFormData) => {
    if (editingAddress) {
      updateAddressMutation.mutate({ id: editingAddress.id, data });
    } else {
      createAddressMutation.mutate(data);
    }
  };

  const handleEditAddress = (address: Address) => {
    setEditingAddress(address);
    form.reset({
      fullName: address.fullName,
      addressLine1: address.addressLine1,
      addressLine2: address.addressLine2 || "",
      city: address.city,
      state: address.state,
      postalCode: address.postalCode,
      country: address.country,
      phone: address.phone,
      isDefault: address.isDefault,
    });
    setShowAddressDialog(true);
  };

  const handleDeleteAddress = (id: number) => {
    if (confirm("Are you sure you want to delete this address?")) {
      deleteAddressMutation.mutate(id);
    }
  };

  const handleProceedToPayment = async () => {
    if (!course) return;

    const basePrice = 99; // Base certificate price
    const shippingCost = includesPhysicalCopy ? 50 : 0;
    const totalAmount = basePrice + shippingCost;

    try {
      // Check if user has passed the exam first
      const examStatusResponse = await apiRequest('GET', `/api/courses/${course.id}/exam-status`);
      
      if (examStatusResponse.ok) {
        const examStatus = await examStatusResponse.json();
        
        if (examStatus.hasPassed) {
          // User has passed, proceed directly to payment with exam attempt ID
          const paymentData = {
            courseId: course.id,
            examAttemptId: examStatus.latestAttemptId,
            amount: totalAmount,
            includesPhysicalCopy,
            shippingAddressId: includesPhysicalCopy ? selectedAddressId : null,
            sellerCode: referralCode,
          };

          // Store payment data in sessionStorage
          sessionStorage.setItem('paymentData', JSON.stringify(paymentData));
          
          // Navigate to payment page with exam attempt ID
          navigate(`/payment/exam/${examStatus.latestAttemptId}?amount=${totalAmount}&physical=${includesPhysicalCopy}&address=${selectedAddressId || ''}&ref=${referralCode || ''}`);
        } else {
          // User needs to take exam first
          toast({
            title: "Complete Exam First", 
            description: "You need to take and pass the exam before purchasing a certificate.",
            variant: "destructive",
          });
          navigate(`/exam/${course.id}`);
        }
      } else {
        // User needs to take exam first
        toast({
          title: "Complete Exam First", 
          description: "You need to take and pass the exam before purchasing a certificate.",
          variant: "destructive",
        });
        navigate(`/exam/${course.id}`);
      }
    } catch (error) {
      toast({
        title: "Error",
        description: "Failed to process checkout. Please try again.",
        variant: "destructive",
      });
    }
  };

  if (courseLoading || certificateLoading) {
    return (
      <div className="min-h-screen bg-black text-white flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin w-8 h-8 border-2 border-white border-t-transparent rounded-full mx-auto mb-4"></div>
          <p>Loading checkout details...</p>
        </div>
      </div>
    );
  }

  if (!course) {
    return (
      <div className="min-h-screen bg-black text-white flex items-center justify-center">
        <div className="text-center">
          <h1 className="text-2xl font-bold mb-4">Course Not Found</h1>
          <Button onClick={() => navigate("/courses")} variant="outline">
            Browse Courses
          </Button>
        </div>
      </div>
    );
  }

  const basePrice = 99;
  const shippingCost = includesPhysicalCopy ? 50 : 0;
  const totalAmount = basePrice + shippingCost;

  return (
    <div className="min-h-screen bg-black text-white">
      <div className="container mx-auto px-4 py-8">
        <div className="max-w-4xl mx-auto">
          <h1 className="text-3xl font-bold mb-8">Checkout</h1>
          
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
            {/* Left Column - Order Details */}
            <div className="space-y-6">
              <Card className="bg-gray-900 border-gray-800">
                <CardHeader>
                  <CardTitle className="text-white">Course Details</CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="space-y-4">
                    <div>
                      <h3 className="font-semibold text-lg text-white">{course.title}</h3>
                      <Badge variant="secondary" className="mt-2">
                        {course.level}
                      </Badge>
                    </div>
                  </div>
                </CardContent>
              </Card>

              {/* Physical Certificate Option */}
              <Card className="bg-gray-900 border-gray-800">
                <CardHeader>
                  <CardTitle className="text-white flex items-center gap-2">
                    <Package className="w-5 h-5" />
                    Certificate Options
                  </CardTitle>
                  <CardDescription className="text-gray-400">
                    Choose your certificate delivery method
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  <div className="space-y-4">
                    <div className="flex items-center space-x-2">
                      <Checkbox
                        id="physical-copy"
                        checked={includesPhysicalCopy}
                        onCheckedChange={(checked) => setIncludesPhysicalCopy(checked as boolean)}
                      />
                      <Label htmlFor="physical-copy" className="text-white">
                        Include physical certificate paper (+₹50)
                      </Label>
                    </div>
                    
                    {includesPhysicalCopy && (
                      <div className="mt-4 p-4 bg-gray-800 rounded-lg">
                        <p className="text-sm text-gray-300 mb-4">
                          Premium quality certificate paper will be shipped to your address within 7-10 business days.
                        </p>
                        
                        {/* Address Selection */}
                        <div className="space-y-4">
                          <div className="flex items-center justify-between">
                            <h4 className="font-medium text-white flex items-center gap-2">
                              <MapPin className="w-4 h-4" />
                              Shipping Address
                            </h4>
                            <Dialog open={showAddressDialog} onOpenChange={setShowAddressDialog}>
                              <DialogTrigger asChild>
                                <Button
                                  variant="outline"
                                  size="sm"
                                  onClick={() => {
                                    setEditingAddress(null);
                                    form.reset();
                                  }}
                                >
                                  <Plus className="w-4 h-4 mr-1" />
                                  Add Address
                                </Button>
                              </DialogTrigger>
                              <DialogContent className="bg-gray-900 border-gray-800 text-white max-w-md">
                                <DialogHeader>
                                  <DialogTitle>
                                    {editingAddress ? "Edit Address" : "Add New Address"}
                                  </DialogTitle>
                                  <DialogDescription className="text-gray-400">
                                    {editingAddress ? "Update your address details" : "Add a new shipping address"}
                                  </DialogDescription>
                                </DialogHeader>
                                
                                <Form {...form}>
                                  <form onSubmit={form.handleSubmit(handleAddressSubmit)} className="space-y-4">
                                    <FormField
                                      control={form.control}
                                      name="fullName"
                                      render={({ field }) => (
                                        <FormItem>
                                          <FormLabel className="text-white">Full Name</FormLabel>
                                          <FormControl>
                                            <Input {...field} className="bg-gray-800 border-gray-700 text-white" />
                                          </FormControl>
                                          <FormMessage />
                                        </FormItem>
                                      )}
                                    />
                                    
                                    <FormField
                                      control={form.control}
                                      name="addressLine1"
                                      render={({ field }) => (
                                        <FormItem>
                                          <FormLabel className="text-white">Address Line 1</FormLabel>
                                          <FormControl>
                                            <Input {...field} className="bg-gray-800 border-gray-700 text-white" />
                                          </FormControl>
                                          <FormMessage />
                                        </FormItem>
                                      )}
                                    />
                                    
                                    <FormField
                                      control={form.control}
                                      name="addressLine2"
                                      render={({ field }) => (
                                        <FormItem>
                                          <FormLabel className="text-white">Address Line 2 (Optional)</FormLabel>
                                          <FormControl>
                                            <Input {...field} className="bg-gray-800 border-gray-700 text-white" />
                                          </FormControl>
                                          <FormMessage />
                                        </FormItem>
                                      )}
                                    />
                                    
                                    <div className="grid grid-cols-2 gap-4">
                                      <FormField
                                        control={form.control}
                                        name="city"
                                        render={({ field }) => (
                                          <FormItem>
                                            <FormLabel className="text-white">City</FormLabel>
                                            <FormControl>
                                              <Input {...field} className="bg-gray-800 border-gray-700 text-white" />
                                            </FormControl>
                                            <FormMessage />
                                          </FormItem>
                                        )}
                                      />
                                      
                                      <FormField
                                        control={form.control}
                                        name="state"
                                        render={({ field }) => (
                                          <FormItem>
                                            <FormLabel className="text-white">State</FormLabel>
                                            <FormControl>
                                              <Input {...field} className="bg-gray-800 border-gray-700 text-white" />
                                            </FormControl>
                                            <FormMessage />
                                          </FormItem>
                                        )}
                                      />
                                    </div>
                                    
                                    <div className="grid grid-cols-2 gap-4">
                                      <FormField
                                        control={form.control}
                                        name="postalCode"
                                        render={({ field }) => (
                                          <FormItem>
                                            <FormLabel className="text-white">Postal Code</FormLabel>
                                            <FormControl>
                                              <Input {...field} className="bg-gray-800 border-gray-700 text-white" />
                                            </FormControl>
                                            <FormMessage />
                                          </FormItem>
                                        )}
                                      />
                                      
                                      <FormField
                                        control={form.control}
                                        name="country"
                                        render={({ field }) => (
                                          <FormItem>
                                            <FormLabel className="text-white">Country</FormLabel>
                                            <FormControl>
                                              <Input {...field} className="bg-gray-800 border-gray-700 text-white" />
                                            </FormControl>
                                            <FormMessage />
                                          </FormItem>
                                        )}
                                      />
                                    </div>
                                    
                                    <FormField
                                      control={form.control}
                                      name="phone"
                                      render={({ field }) => (
                                        <FormItem>
                                          <FormLabel className="text-white">Phone Number</FormLabel>
                                          <FormControl>
                                            <Input {...field} className="bg-gray-800 border-gray-700 text-white" />
                                          </FormControl>
                                          <FormMessage />
                                        </FormItem>
                                      )}
                                    />
                                    
                                    <FormField
                                      control={form.control}
                                      name="isDefault"
                                      render={({ field }) => (
                                        <FormItem className="flex flex-row items-start space-x-3 space-y-0">
                                          <FormControl>
                                            <Checkbox
                                              checked={field.value}
                                              onCheckedChange={field.onChange}
                                            />
                                          </FormControl>
                                          <div className="space-y-1 leading-none">
                                            <FormLabel className="text-white">Set as default address</FormLabel>
                                          </div>
                                        </FormItem>
                                      )}
                                    />
                                    
                                    <DialogFooter>
                                      <Button
                                        type="button"
                                        variant="outline"
                                        onClick={() => setShowAddressDialog(false)}
                                      >
                                        Cancel
                                      </Button>
                                      <Button 
                                        type="submit"
                                        disabled={createAddressMutation.isPending || updateAddressMutation.isPending}
                                      >
                                        {createAddressMutation.isPending || updateAddressMutation.isPending
                                          ? "Saving..." 
                                          : editingAddress ? "Update Address" : "Add Address"
                                        }
                                      </Button>
                                    </DialogFooter>
                                  </form>
                                </Form>
                              </DialogContent>
                            </Dialog>
                          </div>
                          
                          {addressesLoading ? (
                            <div className="text-center py-4">
                              <div className="animate-spin w-6 h-6 border-2 border-white border-t-transparent rounded-full mx-auto mb-2"></div>
                              <p className="text-sm text-gray-400">Loading addresses...</p>
                            </div>
                          ) : addresses.length > 0 ? (
                            <div className="space-y-3">
                              {addresses.map((address) => (
                                <div
                                  key={address.id}
                                  className={`p-3 rounded-lg border cursor-pointer transition-colors ${
                                    selectedAddressId === address.id
                                      ? "border-white bg-gray-800"
                                      : "border-gray-700 hover:border-gray-600"
                                  }`}
                                  onClick={() => setSelectedAddressId(address.id)}
                                >
                                  <div className="flex items-start justify-between">
                                    <div className="flex-1">
                                      <div className="flex items-center gap-2 mb-1">
                                        <span className="font-medium text-white">{address.fullName}</span>
                                        {address.isDefault && (
                                          <Badge variant="secondary" className="text-xs">
                                            <Star className="w-3 h-3 mr-1" />
                                            Default
                                          </Badge>
                                        )}
                                      </div>
                                      <p className="text-sm text-gray-300">
                                        {address.addressLine1}
                                        {address.addressLine2 && `, ${address.addressLine2}`}
                                      </p>
                                      <p className="text-sm text-gray-300">
                                        {address.city}, {address.state} {address.postalCode}
                                      </p>
                                      <p className="text-sm text-gray-300">{address.country}</p>
                                      <p className="text-sm text-gray-400">{address.phone}</p>
                                    </div>
                                    <div className="flex gap-2 ml-2">
                                      <Button
                                        variant="ghost"
                                        size="sm"
                                        onClick={(e) => {
                                          e.stopPropagation();
                                          handleEditAddress(address);
                                        }}
                                      >
                                        <Edit2 className="w-4 h-4" />
                                      </Button>
                                      <Button
                                        variant="ghost"
                                        size="sm"
                                        onClick={(e) => {
                                          e.stopPropagation();
                                          handleDeleteAddress(address.id);
                                        }}
                                      >
                                        <Trash2 className="w-4 h-4" />
                                      </Button>
                                    </div>
                                  </div>
                                </div>
                              ))}
                            </div>
                          ) : (
                            <div className="text-center py-4">
                              <p className="text-sm text-gray-400 mb-2">No addresses found</p>
                              <p className="text-xs text-gray-500">Add an address to enable physical certificate shipping</p>
                            </div>
                          )}
                        </div>
                      </div>
                    )}
                  </div>
                </CardContent>
              </Card>
            </div>

            {/* Right Column - Order Summary */}
            <div className="space-y-6">
              <Card className="bg-gray-900 border-gray-800">
                <CardHeader>
                  <CardTitle className="text-white">Order Summary</CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="space-y-4">
                    <div className="flex justify-between">
                      <span className="text-gray-300">Digital Certificate</span>
                      <span className="text-white">₹{basePrice}</span>
                    </div>
                    
                    {includesPhysicalCopy && (
                      <div className="flex justify-between">
                        <span className="text-gray-300">Physical Certificate Shipping</span>
                        <span className="text-white">₹{shippingCost}</span>
                      </div>
                    )}
                    
                    <Separator className="bg-gray-700" />
                    
                    <div className="flex justify-between text-lg font-semibold">
                      <span className="text-white">Total</span>
                      <span className="text-white">₹{totalAmount}</span>
                    </div>
                    
                    <Button
                      className="w-full bg-white text-black hover:bg-gray-200"
                      size="lg"
                      onClick={handleProceedToPayment}
                      disabled={includesPhysicalCopy && (!selectedAddressId || addresses.length === 0)}
                    >
                      Proceed to Payment
                    </Button>
                    
                    {includesPhysicalCopy && (!selectedAddressId || addresses.length === 0) && (
                      <p className="text-sm text-red-400 text-center">
                        Please select a shipping address to continue
                      </p>
                    )}
                  </div>
                </CardContent>
              </Card>
              
              <Card className="bg-gray-900 border-gray-800">
                <CardContent className="pt-6">
                  <div className="space-y-2 text-sm text-gray-400">
                    <p>✓ Instant digital certificate download</p>
                    <p>✓ Lifetime validity with verification</p>
                    <p>✓ LinkedIn integration ready</p>
                    {includesPhysicalCopy && (
                      <p>✓ Premium certificate paper delivered in 7-10 days</p>
                    )}
                  </div>
                </CardContent>
              </Card>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}