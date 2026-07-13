import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { apiRequest } from "@/lib/queryClient";
import { useAuth } from "@/lib/auth.tsx";
import DashboardLayout from "@/components/dashboard-layout";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Checkbox } from "@/components/ui/checkbox";
import { useToast } from "@/hooks/use-toast";
import { Settings, Bell, Target, User, Save } from "lucide-react";
import type { Category } from "@shared/schema";
import { Link } from "wouter";

interface UserPreferences {
  id: number;
  userId: number;
  preferredCategories: string[];
  skillLevel: string;
  learningGoals: string[];
  notificationSettings: {
    email: boolean;
    push: boolean;
    frequency: string;
    courseRecommendations: boolean;
    newCourses: boolean;
    achievements: boolean;
  };
}

export default function Preferences() {
  const { user, token } = useAuth();
  const { toast } = useToast();
  const queryClient = useQueryClient();

  const { data: preferences, isLoading } = useQuery<UserPreferences>({
    queryKey: ["/api/preferences"],
    enabled: !!user && !!token,
  });

  const { data: categories = [] } = useQuery<Category[]>({
    queryKey: ["/api/categories"],
  });

  const [formData, setFormData] = useState<Partial<UserPreferences>>({});

  // Update preferences mutation
  const updatePreferences = useMutation({
    mutationFn: (data: Partial<UserPreferences>) => apiRequest("PUT", "/api/preferences", data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/preferences"] });
      toast({
        title: "Preferences Updated",
        description: "Your learning preferences have been saved successfully",
      });
    },
    onError: () => {
      toast({
        title: "Error",
        description: "Failed to update preferences",
        variant: "destructive",
      });
    },
  });

  const handleSave = () => {
    updatePreferences.mutate(formData);
  };

  if (!user) {
    return (
      <DashboardLayout role="learner" title="Login required">
        <div className="max-w-4xl mx-auto py-12">
          <div className="text-center">
            <h2 className="text-2xl font-bold text-octamy-black mb-4">Login Required</h2>
            <p className="text-octamy-gray-600">Please log in to access your preferences.</p>
            <Link href="/login"><Button className="mt-5">Log in</Button></Link>
          </div>
        </div>
      </DashboardLayout>
    );
  }

  if (isLoading) {
    return (
      <DashboardLayout role="learner" title="Learning preferences">
        <div className="max-w-4xl mx-auto py-8">
          <div className="animate-pulse">
            <div className="h-8 bg-gray-200 rounded w-1/3 mb-4"></div>
            <div className="space-y-4">
              {[1, 2, 3].map((i) => (
                <div key={i} className="h-32 bg-gray-200 rounded"></div>
              ))}
            </div>
          </div>
        </div>
      </DashboardLayout>
    );
  }

  const currentPrefs = preferences || {
    preferredCategories: [],
    skillLevel: 'novice',
    learningGoals: [],
    notificationSettings: {
      email: true,
      push: true,
      frequency: 'weekly',
      courseRecommendations: true,
      newCourses: true,
      achievements: true,
    },
  };

  return (
    <DashboardLayout role="learner" title="Learning preferences" description="Customize your learning experience and notification settings.">
      <div className="max-w-4xl mx-auto">
        <div className="space-y-6">
          {/* Personal Learning Profile */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <User className="w-5 h-5" />
                Personal Learning Profile
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-6">
              {/* Skill Level */}
              <div>
                <Label className="text-base font-medium">Current Skill Level</Label>
                <Select
                  value={formData.skillLevel || currentPrefs.skillLevel}
                  onValueChange={(value) => setFormData({ ...formData, skillLevel: value })}
                >
                  <SelectTrigger className="mt-2">
                    <SelectValue placeholder="Select your skill level" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="novice">Novice (Just starting out)</SelectItem>
                    <SelectItem value="beginner">Beginner (Some experience)</SelectItem>
                    <SelectItem value="intermediate">Intermediate (Comfortable with basics)</SelectItem>
                    <SelectItem value="advanced">Advanced (Experienced professional)</SelectItem>
                    <SelectItem value="expert">Expert (Industry leader)</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              {/* Preferred Categories */}
              <div>
                <Label className="text-base font-medium">Preferred Learning Categories</Label>
                <p className="text-sm text-octamy-gray-600 mb-3">
                  Select categories you're most interested in learning about
                </p>
                <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
                  {categories.map((category: any) => (
                    <div key={category.id} className="flex items-center space-x-2">
                      <Checkbox
                        id={`category-${category.id}`}
                        checked={(formData.preferredCategories || currentPrefs.preferredCategories || []).includes(category.name)}
                        onCheckedChange={(checked) => {
                          const current = formData.preferredCategories || currentPrefs.preferredCategories || [];
                          const updated = checked
                            ? [...current, category.name]
                            : current.filter(c => c !== category.name);
                          setFormData({ ...formData, preferredCategories: updated });
                        }}
                      />
                      <Label htmlFor={`category-${category.id}`} className="text-sm">
                        {category.name}
                      </Label>
                    </div>
                  ))}
                </div>
              </div>

              {/* Learning Goals */}
              <div>
                <Label className="text-base font-medium">Learning Goals</Label>
                <p className="text-sm text-octamy-gray-600 mb-3">
                  What do you want to achieve with your learning?
                </p>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                  {[
                    'Career Advancement',
                    'Skill Development',
                    'Professional Certification',
                    'Industry Knowledge',
                    'Personal Growth',
                    'Job Preparation',
                    'Entrepreneurship',
                    'Leadership Skills',
                  ].map((goal) => (
                    <div key={goal} className="flex items-center space-x-2">
                      <Checkbox
                        id={`goal-${goal}`}
                        checked={(formData.learningGoals || currentPrefs.learningGoals || []).includes(goal)}
                        onCheckedChange={(checked) => {
                          const current = formData.learningGoals || currentPrefs.learningGoals || [];
                          const updated = checked
                            ? [...current, goal]
                            : current.filter(g => g !== goal);
                          setFormData({ ...formData, learningGoals: updated });
                        }}
                      />
                      <Label htmlFor={`goal-${goal}`} className="text-sm">
                        {goal}
                      </Label>
                    </div>
                  ))}
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Notification Settings */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Bell className="w-5 h-5" />
                Notification Settings
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-6">
              {/* Notification Types */}
              <div>
                <Label className="text-base font-medium mb-4 block">Notification Types</Label>
                <div className="space-y-4">
                  <div className="flex items-center justify-between">
                    <div>
                      <Label className="font-medium">Course Recommendations</Label>
                      <p className="text-sm text-octamy-gray-600">Get personalized course suggestions</p>
                    </div>
                    <Switch
                      checked={formData.notificationSettings?.courseRecommendations ?? currentPrefs.notificationSettings.courseRecommendations}
                      onCheckedChange={(checked) => 
                        setFormData({
                          ...formData,
                          notificationSettings: {
                            ...currentPrefs.notificationSettings,
                            ...formData.notificationSettings,
                            courseRecommendations: checked,
                          },
                        })
                      }
                    />
                  </div>

                  <div className="flex items-center justify-between">
                    <div>
                      <Label className="font-medium">New Courses</Label>
                      <p className="text-sm text-octamy-gray-600">Be notified when new courses are added</p>
                    </div>
                    <Switch
                      checked={formData.notificationSettings?.newCourses ?? currentPrefs.notificationSettings.newCourses}
                      onCheckedChange={(checked) => 
                        setFormData({
                          ...formData,
                          notificationSettings: {
                            ...currentPrefs.notificationSettings,
                            ...formData.notificationSettings,
                            newCourses: checked,
                          },
                        })
                      }
                    />
                  </div>

                  <div className="flex items-center justify-between">
                    <div>
                      <Label className="font-medium">Achievements & Certificates</Label>
                      <p className="text-sm text-octamy-gray-600">Updates about your certifications and achievements</p>
                    </div>
                    <Switch
                      checked={formData.notificationSettings?.achievements ?? currentPrefs.notificationSettings.achievements}
                      onCheckedChange={(checked) => 
                        setFormData({
                          ...formData,
                          notificationSettings: {
                            ...currentPrefs.notificationSettings,
                            ...formData.notificationSettings,
                            achievements: checked,
                          },
                        })
                      }
                    />
                  </div>
                </div>
              </div>

              {/* Delivery Method */}
              <div>
                <Label className="text-base font-medium mb-4 block">Delivery Method</Label>
                <div className="space-y-4">
                  <div className="flex items-center justify-between">
                    <div>
                      <Label className="font-medium">Email Notifications</Label>
                      <p className="text-sm text-octamy-gray-600">Receive notifications via email</p>
                    </div>
                    <Switch
                      checked={formData.notificationSettings?.email ?? currentPrefs.notificationSettings.email}
                      onCheckedChange={(checked) => 
                        setFormData({
                          ...formData,
                          notificationSettings: {
                            ...currentPrefs.notificationSettings,
                            ...formData.notificationSettings,
                            email: checked,
                          },
                        })
                      }
                    />
                  </div>

                  <div className="flex items-center justify-between">
                    <div>
                      <Label className="font-medium">Push Notifications</Label>
                      <p className="text-sm text-octamy-gray-600">Receive in-app notifications</p>
                    </div>
                    <Switch
                      checked={formData.notificationSettings?.push ?? currentPrefs.notificationSettings.push}
                      onCheckedChange={(checked) => 
                        setFormData({
                          ...formData,
                          notificationSettings: {
                            ...currentPrefs.notificationSettings,
                            ...formData.notificationSettings,
                            push: checked,
                          },
                        })
                      }
                    />
                  </div>
                </div>
              </div>

              {/* Frequency */}
              <div>
                <Label className="text-base font-medium">Notification Frequency</Label>
                <Select
                  value={formData.notificationSettings?.frequency || currentPrefs.notificationSettings.frequency}
                  onValueChange={(value) => 
                    setFormData({
                      ...formData,
                      notificationSettings: {
                        ...currentPrefs.notificationSettings,
                        ...formData.notificationSettings,
                        frequency: value,
                      },
                    })
                  }
                >
                  <SelectTrigger className="mt-2">
                    <SelectValue placeholder="Select frequency" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="daily">Daily (Once per day)</SelectItem>
                    <SelectItem value="weekly">Weekly (Once per week)</SelectItem>
                    <SelectItem value="monthly">Monthly (Once per month)</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </CardContent>
          </Card>

          {/* Save Button */}
          <div className="flex justify-end">
            <Button
              onClick={handleSave}
              disabled={updatePreferences.isPending}
              className="bg-octamy-black text-white hover:bg-octamy-gray-800 flex items-center gap-2"
            >
              <Save className="w-4 h-4" />
              {updatePreferences.isPending ? "Saving..." : "Save Preferences"}
            </Button>
          </div>
        </div>
      </div>
    </DashboardLayout>
  );
}
