# Octamy Platform - API Reference

## Base URL
```
Development: http://localhost:5000/api
Production: https://your-domain.com/api
```

## Authentication

### Headers
```
Authorization: Bearer <jwt_token>
Content-Type: application/json
```

### Token Management
```javascript
// Store token after login
localStorage.setItem('authToken', response.token);

// Include in requests
const token = localStorage.getItem('authToken');
headers: { 'Authorization': `Bearer ${token}` }
```

## User Authentication

### Register User
```http
POST /api/register
```

**Request Body:**
```json
{
  "email": "user@example.com",
  "password": "password123",
  "firstName": "John",
  "lastName": "Doe"
}
```

**Response:**
```json
{
  "message": "User registered successfully",
  "token": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...",
  "user": {
    "id": 1,
    "email": "user@example.com",
    "firstName": "John",
    "lastName": "Doe"
  }
}
```

### Login User
```http
POST /api/login
```

**Request Body:**
```json
{
  "email": "user@example.com",
  "password": "password123"
}
```

**Response:**
```json
{
  "message": "Login successful",
  "token": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...",
  "user": {
    "id": 1,
    "email": "user@example.com",
    "firstName": "John",
    "lastName": "Doe"
  }
}
```

### Get Current User
```http
GET /api/user
Authorization: Bearer <token>
```

**Response:**
```json
{
  "id": 1,
  "email": "user@example.com",
  "firstName": "John",
  "lastName": "Doe",
  "isAdmin": false
}
```

## Courses

### Get All Courses
```http
GET /api/courses
```

**Response:**
```json
[
  {
    "id": 1,
    "title": "AI Fundamentals",
    "description": "Learn the basics of AI",
    "category": "AI",
    "duration": 60,
    "price": 99,
    "passingScore": 60,
    "totalQuestions": 20
  }
]
```

### Get Course by ID
```http
GET /api/courses/:id
```

**Response:**
```json
{
  "id": 1,
  "title": "AI Fundamentals",
  "description": "Learn the basics of AI",
  "category": "AI",
  "duration": 60,
  "price": 99,
  "passingScore": 60,
  "totalQuestions": 20,
  "questions": [
    {
      "id": 1,
      "question": "What is AI?",
      "options": ["Artificial Intelligence", "Automated Intelligence", "Advanced Intelligence", "Applied Intelligence"],
      "correctAnswer": 0
    }
  ]
}
```

### Get Course Questions
```http
GET /api/courses/:id/questions
```

**Response:**
```json
[
  {
    "id": 1,
    "question": "What is AI?",
    "options": ["Artificial Intelligence", "Automated Intelligence", "Advanced Intelligence", "Applied Intelligence"]
  }
]
```

## Examinations

### Submit Exam
```http
POST /api/exam/submit
Authorization: Bearer <token> (optional)
```

**Request Body:**
```json
{
  "courseId": 1,
  "answers": [0, 1, 2, 0, 3],
  "timeSpent": 1800,
  "firstName": "John",
  "lastName": "Doe",
  "email": "john@example.com"
}
```

**Response:**
```json
{
  "success": true,
  "score": 85,
  "passed": true,
  "message": "Congratulations! You passed the exam.",
  "certificate": {
    "id": 1,
    "certificateNumber": "CERT-2024-001",
    "isPaid": false
  },
  "tempExamId": "temp_123456789"
}
```

### Get Exam Results
```http
GET /api/exam-results-temp/:tempExamId
```

**Response:**
```json
{
  "score": 85,
  "passed": true,
  "totalQuestions": 20,
  "correctAnswers": 17,
  "timeSpent": 1800,
  "course": {
    "title": "AI Fundamentals",
    "passingScore": 60
  },
  "certificate": {
    "certificateNumber": "CERT-2024-001",
    "isPaid": false
  }
}
```

## Certificates

### Get User Certificates
```http
GET /api/user/certificates
Authorization: Bearer <token>
```

**Response:**
```json
[
  {
    "id": 1,
    "certificateNumber": "CERT-2024-001",
    "courseName": "AI Fundamentals",
    "score": 85,
    "isPaid": true,
    "issuedDate": "2024-01-15T10:30:00Z"
  }
]
```

### Get Recent Certificates (Public)
```http
GET /api/recent-certificates
```

**Response:**
```json
[
  {
    "certificateNumber": "CERT-2024-001",
    "courseName": "AI Fundamentals",
    "recipientFirstName": "John",
    "recipientLastName": "Doe",
    "score": "••%",
    "issuedDate": "2024-01-15T10:30:00Z"
  }
]
```

### Verify Certificate
```http
GET /api/certificate/:certificateNumber
```

**Response:**
```json
{
  "valid": true,
  "certificate": {
    "certificateNumber": "CERT-2024-001",
    "courseName": "AI Fundamentals",
    "recipientFirstName": "John",
    "recipientLastName": "Doe",
    "score": 85,
    "issuedDate": "2024-01-15T10:30:00Z",
    "isPaid": true
  }
}
```

### Download Certificate
```http
GET /api/certificate/:certificateNumber/download
```

**Response:** PDF file download

## Payments

### Initiate Payment
```http
POST /api/payment/initiate
Authorization: Bearer <token> (optional)
```

**Request Body:**
```json
{
  "certificateId": 1,
  "amount": 99,
  "firstName": "John",
  "lastName": "Doe",
  "email": "john@example.com",
  "phone": "+1234567890"
}
```

**Response:**
```json
{
  "success": true,
  "transactionId": "TXN_123456789",
  "paymentForm": {
    "action": "https://secure.payu.in/_payment",
    "method": "POST",
    "fields": {
      "key": "merchant_key",
      "txnid": "TXN_123456789",
      "amount": "99.00",
      "hash": "generated_hash"
    }
  }
}
```

### Payment Success Callback
```http
POST /api/payment/success
```

**Request Body:** (PayUMoney response data)
```json
{
  "mihpayid": "12345",
  "status": "success",
  "txnid": "TXN_123456789",
  "amount": "99.00",
  "hash": "response_hash"
}
```

### Payment Failure Callback
```http
POST /api/payment/failure
```

### Get Payment Status
```http
GET /api/payment/status/:transactionId
```

**Response:**
```json
{
  "transactionId": "TXN_123456789",
  "status": "success",
  "amount": 99,
  "certificateId": 1
}
```

## Admin APIs

### Admin Login
```http
POST /api/admin/login
```

**Request Body:**
```json
{
  "email": "admin@octamy.com",
  "password": "admin123"
}
```

### Admin Analytics
```http
GET /api/admin/analytics
Authorization: Bearer <admin_token>
```

**Response:**
```json
{
  "totalUsers": 1250,
  "totalCourses": 15,
  "totalCertificates": 890,
  "totalRevenue": 75000,
  "recentActivity": [...]
}
```

### Admin Customers
```http
GET /api/admin/customers
Authorization: Bearer <admin_token>
```

### Admin Courses
```http
GET /api/admin/courses
Authorization: Bearer <admin_token>
```

### Admin Exam Attempts
```http
GET /api/admin/exam-attempts
Authorization: Bearer <admin_token>
```

### Admin Transactions
```http
GET /api/admin/transactions
Authorization: Bearer <admin_token>
```

## Seller/Partner APIs

### Seller Registration
```http
POST /api/sellers/register
```

**Request Body:**
```json
{
  "firstName": "Partner",
  "lastName": "Name",
  "email": "partner@example.com",
  "password": "password123",
  "phone": "+1234567890",
  "upiId": "partner@paytm"
}
```

### Seller Login
```http
POST /api/sellers/login
```

**Request Body:**
```json
{
  "email": "partner@example.com",
  "password": "password123"
}
```

### Seller Dashboard
```http
GET /api/sellers/dashboard
Authorization: Bearer <seller_token>
```

**Response:**
```json
{
  "totalEarnings": 1500,
  "pendingEarnings": 500,
  "totalSales": 150,
  "clickData": [...]
}
```

### Generate Referral URL
```http
POST /api/sellers/generate-referral-url
Authorization: Bearer <seller_token>
```

**Request Body:**
```json
{
  "type": "course",
  "itemId": 1
}
```

**Response:**
```json
{
  "referralUrl": "https://octamy.com/courses/1?ref=SELLER123"
}
```

## Contact & Support

### Submit Contact Form
```http
POST /api/contact
```

**Request Body:**
```json
{
  "name": "John Doe",
  "email": "john@example.com",
  "subject": "Technical Support",
  "message": "I need help with..."
}
```

### Track Referral Click
```http
POST /api/referral/track-click
```

**Request Body:**
```json
{
  "referralCode": "SELLER123",
  "courseId": 1,
  "ipAddress": "192.168.1.1",
  "userAgent": "Mozilla/5.0..."
}
```

## Sponsors

### Create Sponsor
```http
POST /api/sponsors
```

**Request Body:**
```json
{
  "name": "Sponsor Name",
  "email": "sponsor@example.com",
  "message": "Supporting education",
  "amount": 1000
}
```

## Error Responses

### Standard Error Format
```json
{
  "error": "Error message",
  "code": "ERROR_CODE",
  "details": "Additional error details"
}
```

### Common Error Codes
- `400` - Bad Request
- `401` - Unauthorized
- `403` - Forbidden
- `404` - Not Found
- `422` - Validation Error
- `500` - Internal Server Error

### Example Error Responses

#### Validation Error
```json
{
  "error": "Validation failed",
  "code": "VALIDATION_ERROR",
  "details": {
    "email": "Invalid email format",
    "password": "Password must be at least 8 characters"
  }
}
```

#### Authentication Error
```json
{
  "error": "Invalid credentials",
  "code": "AUTH_ERROR"
}
```

#### Not Found Error
```json
{
  "error": "Course not found",
  "code": "NOT_FOUND"
}
```

## Rate Limiting

### Limits
- **General API**: 100 requests per 15 minutes
- **Authentication**: 5 requests per 15 minutes
- **Payment**: 10 requests per hour

### Rate Limit Headers
```
X-RateLimit-Limit: 100
X-RateLimit-Remaining: 95
X-RateLimit-Reset: 1640995200
```

## SDKs and Examples

### JavaScript/Node.js Example
```javascript
const API_BASE = 'http://localhost:5000/api';

// Login
const login = async (email, password) => {
  const response = await fetch(`${API_BASE}/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email, password })
  });
  return response.json();
};

// Get courses with auth
const getCourses = async (token) => {
  const response = await fetch(`${API_BASE}/courses`, {
    headers: { 'Authorization': `Bearer ${token}` }
  });
  return response.json();
};
```

### React Hook Example
```javascript
import { useQuery, useMutation } from '@tanstack/react-query';

const useLogin = () => {
  return useMutation({
    mutationFn: async ({ email, password }) => {
      const response = await fetch('/api/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, password })
      });
      return response.json();
    }
  });
};

const useCourses = () => {
  return useQuery({
    queryKey: ['/api/courses'],
    queryFn: async () => {
      const response = await fetch('/api/courses');
      return response.json();
    }
  });
};
```

### Mobile (React Native) Example
```javascript
// API service
class ApiService {
  constructor() {
    this.baseURL = 'http://localhost:5000/api';
  }

  async request(endpoint, options = {}) {
    const token = await AsyncStorage.getItem('authToken');
    
    const response = await fetch(`${this.baseURL}${endpoint}`, {
      ...options,
      headers: {
        'Content-Type': 'application/json',
        ...(token && { 'Authorization': `Bearer ${token}` }),
        ...options.headers
      }
    });
    
    return response.json();
  }

  login(email, password) {
    return this.request('/login', {
      method: 'POST',
      body: JSON.stringify({ email, password })
    });
  }

  getCourses() {
    return this.request('/courses');
  }
}
```

## Testing

### Example Test Cases
```javascript
// Jest test example
describe('API Endpoints', () => {
  test('should register user successfully', async () => {
    const response = await request(app)
      .post('/api/register')
      .send({
        email: 'test@example.com',
        password: 'password123',
        firstName: 'Test',
        lastName: 'User'
      })
      .expect(201);
    
    expect(response.body.user.email).toBe('test@example.com');
    expect(response.body.token).toBeDefined();
  });
});
```

This API reference provides comprehensive documentation for all available endpoints in the Octamy platform. Use this as a reference for frontend development, mobile app integration, and third-party integrations.