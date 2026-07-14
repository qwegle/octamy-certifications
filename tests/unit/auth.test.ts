import { describe, it, expect, beforeEach } from '@jest/globals';
import bcrypt from 'bcrypt';
import { cleanupTestData } from '../setup';
import { DatabaseStorage } from '../../server/storage';

describe('Authentication storage contracts', () => {
  let storage: DatabaseStorage;

  beforeEach(async () => {
    await cleanupTestData();
    storage = new DatabaseStorage();
  });

  async function createPasswordUser(
    email: string,
    password: string,
    isAdmin = false,
  ) {
    const passwordHash = await bcrypt.hash(password, 10);
    const user = await storage.createUser({
      name: isAdmin ? 'Admin User' : 'John Doe',
      email,
      password: passwordHash,
      isAdmin,
    });

    return { user, passwordHash };
  }

  describe('Password accounts', () => {
    it('persists the password hash supplied by the authentication layer', async () => {
      const password = 'Password123!';
      const { user, passwordHash } = await createPasswordUser(
        'john@example.com',
        password,
      );

      expect(user.id).toBeDefined();
      expect(user.name).toBe('John Doe');
      expect(user.email).toBe('john@example.com');
      expect(user.isAdmin).toBe(false);
      expect(user.password).toBe(passwordHash);
      expect(user.password).not.toBe(password);
      await expect(bcrypt.compare(password, user.password!)).resolves.toBe(true);
    });

    it('enforces unique email addresses', async () => {
      await createPasswordUser('john@example.com', 'Password123!');

      await expect(
        createPasswordUser('john@example.com', 'AnotherPassword123!'),
      ).rejects.toThrow();
    });

    it('retrieves a password account by email for credential verification', async () => {
      const password = 'Password123!';
      const { user } = await createPasswordUser('john@example.com', password);

      const storedUser = await storage.getUserByEmail('john@example.com');

      expect(storedUser?.id).toBe(user.id);
      expect(storedUser?.password).toBeDefined();
      await expect(
        bcrypt.compare(password, storedUser!.password!),
      ).resolves.toBe(true);
    });

    it('does not validate an incorrect password against the stored hash', async () => {
      await createPasswordUser('john@example.com', 'Password123!');
      const storedUser = await storage.getUserByEmail('john@example.com');

      await expect(
        bcrypt.compare('WrongPassword123!', storedUser!.password!),
      ).resolves.toBe(false);
    });

    it('returns undefined for an unknown email address', async () => {
      await expect(
        storage.getUserByEmail('nonexistent@example.com'),
      ).resolves.toBeUndefined();
    });
  });

  describe('Google and admin accounts', () => {
    it('supports a Google-only user without a local password', async () => {
      const user = await storage.createUser({
        name: 'Google User',
        email: 'google@example.com',
        password: null,
        googleId: 'google-subject-123',
        isGoogleUser: true,
      });

      expect(user.password).toBeNull();
      expect(user.googleId).toBe('google-subject-123');
      expect(user.isGoogleUser).toBe(true);
    });

    it('preserves the administrator role used by the auth response', async () => {
      const { user } = await createPasswordUser(
        'admin@example.com',
        'AdminPassword123!',
        true,
      );

      const storedAdmin = await storage.getUserByEmail(user.email);
      expect(storedAdmin?.isAdmin).toBe(true);
    });
  });
});
