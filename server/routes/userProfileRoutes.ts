import { Router } from 'express';
import { authenticateToken } from '../middleware/auth';
import { storage } from '../storage';
import { z } from 'zod';

const router = Router();

// Schema for profile updates
const updateProfileSchema = z.object({
  name: z.string().min(2, 'Name must be at least 2 characters').optional(),
  phone: z.string().optional(),
  location: z.string().optional(),
  experience: z.number().min(0).max(50).optional(),
  currentRole: z.string().optional(),
  skills: z.array(z.string()).optional(),
  availability: z.string().optional(),
  noticePeriod: z.string().optional(),
  expectedSalary: z.string().optional(),
  workType: z.array(z.string()).optional(),
  category: z.array(z.string()).optional(),
  linkedinProfile: z.string().url().optional().or(z.literal('')),
  portfolioUrl: z.string().url().optional().or(z.literal('')),
  bio: z.string().optional(),
  careerGoals: z.string().optional(),
  profileVisibility: z.boolean().optional(),
});

// GET /api/user/profile - Get current user's profile
router.get('/profile', authenticateToken, async (req, res) => {
  try {
    const userId = req.user!.userId;
    const user = await storage.getUser(userId);
    
    if (!user) {
      return res.status(404).json({ error: 'User not found' });
    }

    // Return user profile data
    const profileData = {
      name: user.name,
      email: user.email,
      phone: user.phone,
      location: user.location,
      experience: user.experience,
      currentRole: user.currentRole,
      skills: user.skills || [],
      availability: user.availability,
      noticePeriod: user.noticePeriod,
      expectedSalary: user.expectedSalary,
      workType: user.workType || [],
      category: user.category || [],
      linkedinProfile: user.linkedinProfile,
      portfolioUrl: user.portfolioUrl,
      bio: user.bio,
      careerGoals: user.careerGoals,
      profileVisibility: user.profileVisibility ?? true,
      profileCompleteness: user.profileCompleteness || 0,
    };

    res.json(profileData);
  } catch (error) {
    console.error('Error fetching user profile:', error);
    res.status(500).json({ error: 'Failed to fetch profile' });
  }
});

// PUT /api/user/profile - Update current user's profile
router.put('/profile', authenticateToken, async (req, res) => {
  try {
    const userId = req.user!.userId;
    
    // Validate request body
    const validationResult = updateProfileSchema.safeParse(req.body);
    if (!validationResult.success) {
      return res.status(400).json({ 
        error: 'Invalid data', 
        details: validationResult.error.issues 
      });
    }

    const updateData = validationResult.data;
    
    // Calculate profile completeness
    const profileCompleteness = calculateProfileCompleteness(updateData);
    
    // Update user profile
    const updatedUser = await storage.updateUserProfile(userId, {
      ...updateData,
      profileCompleteness,
      updatedAt: new Date(),
    });

    if (!updatedUser) {
      return res.status(404).json({ error: 'User not found' });
    }

    res.json({ 
      message: 'Profile updated successfully',
      profileCompleteness 
    });
  } catch (error) {
    console.error('Error updating user profile:', error);
    res.status(500).json({ error: 'Failed to update profile' });
  }
});

// Helper function to calculate profile completeness
function calculateProfileCompleteness(data: any): number {
  const fields = [
    'name', 'phone', 'location', 'experience', 'currentRole', 
    'skills', 'availability', 'noticePeriod', 'expectedSalary',
    'workType', 'category', 'bio', 'careerGoals'
  ];
  
  let completedFields = 0;
  const totalFields = fields.length;
  
  fields.forEach(field => {
    const value = data[field];
    if (value !== undefined && value !== null && value !== '') {
      if (Array.isArray(value) && value.length > 0) {
        completedFields++;
      } else if (!Array.isArray(value)) {
        completedFields++;
      }
    }
  });
  
  return Math.round((completedFields / totalFields) * 100);
}

export default router;