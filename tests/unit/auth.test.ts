import { describe, it, expect, beforeEach } from '@jest/globals';
import { cleanupTestData, setupTestData, testDb } from '../setup';
import { DatabaseStorage } from '../../server/storage';
import bcrypt from 'bcrypt';

describe('Authentication Tests', () => {
  let storage: DatabaseStorage;

  beforeEach(async () => {
    await cleanupTestData();
    storage = new DatabaseStorage();
  });

  describe('User Registration', () => {
    it('should create a new user with hashed password', async () => {
      const userData = {
        name: 'John Doe',
        email: 'john@example.com',
        password: 'password123',
        isAdmin: false
      };

      const user = await storage.createUser(userData);

      expect(user.id).toBeDefined();
      expect(user.name).toBe(userData.name);
      expect(user.email).toBe(userData.email);
      expect(user.isAdmin).toBe(false);
      expect(user.password).not.toBe(userData.password); // Should be hashed
    });

    it('should not allow duplicate email registration', async () => {
      const userData = {
        name: 'John Doe',
        email: 'john@example.com',
        password: 'password123',
        isAdmin: false
      };

      await storage.createUser(userData);

      await expect(storage.createUser(userData)).rejects.toThrow();
    });
  });

  describe('User Login', () => {
    it('should authenticate user with correct credentials', async () => {
      const password = 'password123';
      const hashedPassword = await bcrypt.hash(password, 10);
      
      const userData = {
        name: 'John Doe',
        email: 'john@example.com',
        password: hashedPassword,
        isAdmin: false
      };

      const user = await storage.createUser(userData);
      const authenticatedUser = await storage.authenticateUser('john@example.com', password);

      expect(authenticatedUser).toBeDefined();
      expect(authenticatedUser?.id).toBe(user.id);
      expect(authenticatedUser?.email).toBe(user.email);
    });

    it('should reject login with incorrect password', async () => {
      const hashedPassword = await bcrypt.hash('password123', 10);
      
      const userData = {
        name: 'John Doe',
        email: 'john@example.com',
        password: hashedPassword,
        isAdmin: false
      };

      await storage.createUser(userData);
      const authenticatedUser = await storage.authenticateUser('john@example.com', 'wrongpassword');

      expect(authenticatedUser).toBeNull();
    });

    it('should reject login with non-existent email', async () => {
      const authenticatedUser = await storage.authenticateUser('nonexistent@example.com', 'password123');
      expect(authenticatedUser).toBeNull();
    });
  });

  describe('Admin Authentication', () => {
    it('should authenticate admin user', async () => {
      const password = 'admin123';
      const hashedPassword = await bcrypt.hash(password, 10);
      
      const adminData = {
        name: 'Admin User',
        email: 'admin@example.com',
        password: hashedPassword,
        isAdmin: true
      };

      const admin = await storage.createUser(adminData);
      const authenticatedAdmin = await storage.authenticateUser('admin@example.com', password);

      expect(authenticatedAdmin).toBeDefined();
      expect(authenticatedAdmin?.isAdmin).toBe(true);
    });
  });
});