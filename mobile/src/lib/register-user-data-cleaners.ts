import { clearUserAttempts } from '@/features/certifications/attempt-repository';
import { deleteAllRecordings } from '@/features/interview/recordings';
import { clearAllPracticeDrafts } from '@/features/practice/practice-storage';
import { registerUserDataCleaner } from './user-data-cleanup';

registerUserDataCleaner(clearUserAttempts);
registerUserDataCleaner(deleteAllRecordings);
registerUserDataCleaner(clearAllPracticeDrafts);
