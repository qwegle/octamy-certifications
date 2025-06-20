# Recruiter Portal - Quick Test Guide

## Step-by-Step Testing Instructions

### 1. Access Recruiter Portal
- Navigate to: `http://localhost:5000/recruiter-auth`
- You should see the Octamy Recruiter Portal login page

### 2. Login with Test Credentials
- Click the "Login" tab
- Enter:
  - **Email**: `test@recruiter.com`
  - **Password**: `password123`
- Click "Login"

### 3. Verify Dashboard Access
After successful login, you should be redirected to `/recruiter` with:
- Dashboard overview with candidate metrics
- Navigation tabs: Dashboard, Search Candidates, Shortlisted
- Company information displayed

### 4. Test AI Interactive Courses
The platform now has 3 AI-powered courses available:

#### AI Algorithm Master Class
- Duration: 90 minutes
- Passing Score: 70%
- Questions: Shortest path algorithms, Two Sum optimization
- Access: `/ai-exam/74` (use course ID from database)

#### Full Stack Technical Interview  
- Duration: 120 minutes
- Passing Score: 75%
- Questions: E-commerce architecture design
- Access: `/ai-exam/75`

#### System Design & Architecture
- Duration: 100 minutes
- Passing Score: 72% 
- Questions: Distributed cache system design
- Access: `/ai-exam/76`

### 5. Test Candidate Search
- Navigate to "Search Candidates" tab
- Use filters:
  - Skills: "React, Python, JavaScript"
  - Experience Level: "Mid-level"
  - Minimum Score: "70"
  - Assessment Type: "AI Interactive"

### 6. Expected Behavior
- Registration should work without URL validation errors
- Login should return JWT token and redirect to dashboard
- AI courses should be visible with "AI Interactive" badges
- Recruiter dashboard should show analytics and search functionality

## Troubleshooting

### If Login Fails:
1. Check browser console for errors
2. Verify server is running on port 5000
3. Confirm database tables exist for recruiters
4. Test with curl command to verify API response

### If URL Validation Errors:
- Company Website and LinkedIn URL fields are now optional
- Empty strings are accepted for these fields
- No URL format validation on optional fields

### If AI Courses Don't Appear:
- Check that `course_type = 'ai_interactive'` in database
- Verify `is_preferred = true` for recruiter-focused courses
- Ensure questions table has AI interactive questions

## Database Verification Commands

```sql
-- Check recruiter exists
SELECT * FROM recruiters WHERE email = 'test@recruiter.com';

-- Check AI courses  
SELECT id, title, course_type, is_preferred FROM courses WHERE course_type = 'ai_interactive';

-- Check AI questions
SELECT COUNT(*) FROM questions WHERE question_type = 'ai_interactive';
```

## Success Criteria
- Recruiter can register and login successfully
- Dashboard displays without errors
- AI interactive courses are visible and accessible
- Candidate search functionality works
- No console errors or validation issues