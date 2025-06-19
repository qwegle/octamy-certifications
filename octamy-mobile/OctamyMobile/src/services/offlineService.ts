import * as FileSystem from 'expo-file-system';
import { Course, Certificate, ExamAttempt } from '../types';

interface OfflineData {
  courses: Course[];
  certificates: Certificate[];
  examAttempts: ExamAttempt[];
  lastSync: string;
}

class OfflineService {
  private readonly OFFLINE_DATA_KEY = 'octamy_offline_data';
  private readonly OFFLINE_DIR = `${FileSystem.documentDirectory}octamy/`;

  async initialize() {
    // Create offline directory if it doesn't exist
    const dirInfo = await FileSystem.getInfoAsync(this.OFFLINE_DIR);
    if (!dirInfo.exists) {
      await FileSystem.makeDirectoryAsync(this.OFFLINE_DIR, { intermediates: true });
    }
  }

  async saveOfflineData(data: Partial<OfflineData>) {
    try {
      const existingData = await this.getOfflineData();
      const updatedData = {
        ...existingData,
        ...data,
        lastSync: new Date().toISOString(),
      };

      const filePath = `${this.OFFLINE_DIR}offline_data.json`;
      await FileSystem.writeAsStringAsync(filePath, JSON.stringify(updatedData));
      
      console.log('Offline data saved successfully');
    } catch (error) {
      console.error('Error saving offline data:', error);
    }
  }

  async getOfflineData(): Promise<OfflineData> {
    try {
      const filePath = `${this.OFFLINE_DIR}offline_data.json`;
      const fileInfo = await FileSystem.getInfoAsync(filePath);
      
      if (fileInfo.exists) {
        const data = await FileSystem.readAsStringAsync(filePath);
        return JSON.parse(data);
      }
    } catch (error) {
      console.error('Error reading offline data:', error);
    }

    // Return default empty data
    return {
      courses: [],
      certificates: [],
      examAttempts: [],
      lastSync: '',
    };
  }

  async getCourses(): Promise<Course[]> {
    const data = await this.getOfflineData();
    return data.courses;
  }

  async saveCourses(courses: Course[]) {
    await this.saveOfflineData({ courses });
  }

  async getCertificates(): Promise<Certificate[]> {
    const data = await this.getOfflineData();
    return data.certificates;
  }

  async saveCertificates(certificates: Certificate[]) {
    await this.saveOfflineData({ certificates });
  }

  async getExamAttempts(): Promise<ExamAttempt[]> {
    const data = await this.getOfflineData();
    return data.examAttempts;
  }

  async saveExamAttempt(examAttempt: ExamAttempt) {
    const data = await this.getOfflineData();
    const updatedAttempts = [...data.examAttempts, examAttempt];
    await this.saveOfflineData({ examAttempts: updatedAttempts });
  }

  async getLastSyncTime(): Promise<string> {
    const data = await this.getOfflineData();
    return data.lastSync;
  }

  async clearOfflineData() {
    try {
      const filePath = `${this.OFFLINE_DIR}offline_data.json`;
      const fileInfo = await FileSystem.getInfoAsync(filePath);
      
      if (fileInfo.exists) {
        await FileSystem.deleteAsync(filePath);
        console.log('Offline data cleared');
      }
    } catch (error) {
      console.error('Error clearing offline data:', error);
    }
  }

  async downloadCertificate(certificateId: string, certificateData: string): Promise<string> {
    try {
      const filePath = `${this.OFFLINE_DIR}certificate_${certificateId}.pdf`;
      await FileSystem.writeAsStringAsync(filePath, certificateData, {
        encoding: FileSystem.EncodingType.Base64,
      });
      
      console.log(`Certificate ${certificateId} downloaded offline`);
      return filePath;
    } catch (error) {
      console.error('Error downloading certificate:', error);
      throw error;
    }
  }

  async getCertificateFilePath(certificateId: string): Promise<string | null> {
    try {
      const filePath = `${this.OFFLINE_DIR}certificate_${certificateId}.pdf`;
      const fileInfo = await FileSystem.getInfoAsync(filePath);
      
      return fileInfo.exists ? filePath : null;
    } catch (error) {
      console.error('Error checking certificate file:', error);
      return null;
    }
  }

  async getStorageInfo() {
    try {
      const freeDiskStorage = await FileSystem.getFreeDiskStorageAsync();
      const totalDiskCapacity = await FileSystem.getTotalDiskCapacityAsync();
      
      return {
        freeSpace: freeDiskStorage,
        totalSpace: totalDiskCapacity,
        usedSpace: totalDiskCapacity - freeDiskStorage,
        freeSpaceFormatted: this.formatBytes(freeDiskStorage),
        totalSpaceFormatted: this.formatBytes(totalDiskCapacity),
      };
    } catch (error) {
      console.error('Error getting storage info:', error);
      return null;
    }
  }

  private formatBytes(bytes: number): string {
    if (bytes === 0) return '0 Bytes';
    
    const k = 1024;
    const sizes = ['Bytes', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
  }

  async syncData(onlineData: Partial<OfflineData>) {
    try {
      await this.saveOfflineData(onlineData);
      console.log('Data synced successfully');
    } catch (error) {
      console.error('Error syncing data:', error);
      throw error;
    }
  }
}

export const offlineService = new OfflineService();