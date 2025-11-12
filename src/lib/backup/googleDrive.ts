// Google Drive Backup & Restore Integration

const GOOGLE_CLIENT_ID = import.meta.env.VITE_GOOGLE_CLIENT_ID || '';
const GOOGLE_API_KEY = import.meta.env.VITE_GOOGLE_API_KEY || '';
const DISCOVERY_DOCS = ['https://www.googleapis.com/discovery/v1/apis/drive/v3/rest'];
const SCOPES = 'https://www.googleapis.com/auth/drive.file';

let gapiInited = false;
let gisInited = false;
let tokenClient: any;

interface BackupData {
  version: string;
  timestamp: string;
  branches: any[];
  customers: any[];
  equipment: any[];
  rentals: any[];
  maintenance: any[];
  expenses: any[];
  offlineUsers: any[];
}

// تحميل Google API
export const loadGoogleAPI = (): Promise<void> => {
  return new Promise((resolve, reject) => {
    const script = document.createElement('script');
    script.src = 'https://apis.google.com/js/api.js';
    script.onload = () => {
      (window as any).gapi.load('client', async () => {
        try {
          await (window as any).gapi.client.init({
            apiKey: GOOGLE_API_KEY,
            discoveryDocs: DISCOVERY_DOCS,
          });
          gapiInited = true;
          resolve();
        } catch (error) {
          console.error('Error initializing GAPI:', error);
          reject(error);
        }
      });
    };
    script.onerror = reject;
    document.body.appendChild(script);
  });
};

// تحميل Google Identity Services
export const loadGoogleIdentity = (): Promise<void> => {
  return new Promise((resolve, reject) => {
    const script = document.createElement('script');
    script.src = 'https://accounts.google.com/gsi/client';
    script.onload = () => {
      tokenClient = (window as any).google.accounts.oauth2.initTokenClient({
        client_id: GOOGLE_CLIENT_ID,
        scope: SCOPES,
        callback: '',
      });
      gisInited = true;
      resolve();
    };
    script.onerror = reject;
    document.body.appendChild(script);
  });
};

// تهيئة Google APIs
export const initializeGoogleAPIs = async (): Promise<boolean> => {
  try {
    if (!GOOGLE_CLIENT_ID || !GOOGLE_API_KEY) {
      console.warn('Google API credentials not configured');
      return false;
    }
    
    await Promise.all([loadGoogleAPI(), loadGoogleIdentity()]);
    return true;
  } catch (error) {
    console.error('Failed to initialize Google APIs:', error);
    return false;
  }
};

// الحصول على Access Token
const getAccessToken = (): Promise<string> => {
  return new Promise((resolve, reject) => {
    if (!gisInited) {
      reject(new Error('Google Identity Services not initialized'));
      return;
    }

    tokenClient.callback = (response: any) => {
      if (response.error !== undefined) {
        reject(response);
        return;
      }
      resolve(response.access_token);
    };

    const token = (window as any).gapi.client.getToken();
    if (token === null) {
      tokenClient.requestAccessToken({ prompt: 'consent' });
    } else {
      tokenClient.requestAccessToken({ prompt: '' });
    }
  });
};

// جمع البيانات من IndexedDB
const collectBackupData = async (): Promise<BackupData> => {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open('branch_gear_db', 1);

    request.onsuccess = () => {
      const db = request.result;
      const data: BackupData = {
        version: '1.0.0',
        timestamp: new Date().toISOString(),
        branches: [],
        customers: [],
        equipment: [],
        rentals: [],
        maintenance: [],
        expenses: [],
        offlineUsers: [],
      };

      const storeNames = ['branches', 'customers', 'equipment', 'rentals', 'maintenance', 'expenses'];
      let completed = 0;

      storeNames.forEach((storeName) => {
        if (!db.objectStoreNames.contains(storeName)) {
          completed++;
          if (completed === storeNames.length) {
            try {
              const offlineUser = localStorage.getItem('offline.user');
              if (offlineUser) {
                data.offlineUsers.push(JSON.parse(offlineUser));
              }
            } catch (error) {
              console.error('Error reading offline user:', error);
            }
            resolve(data);
          }
          return;
        }

        const transaction = db.transaction(storeName, 'readonly');
        const store = transaction.objectStore(storeName);
        const getAllRequest = store.getAll();

        getAllRequest.onsuccess = () => {
          (data as any)[storeName] = getAllRequest.result;
          completed++;

          if (completed === storeNames.length) {
            try {
              const offlineUser = localStorage.getItem('offline.user');
              if (offlineUser) {
                data.offlineUsers.push(JSON.parse(offlineUser));
              }
            } catch (error) {
              console.error('Error reading offline user:', error);
            }
            resolve(data);
          }
        };

        getAllRequest.onerror = () => {
          console.error(`Error reading ${storeName}:`, getAllRequest.error);
          completed++;
          if (completed === storeNames.length) {
            resolve(data);
          }
        };
      });

      if (storeNames.length === 0) {
        resolve(data);
      }
    };

    request.onerror = () => {
      reject(request.error);
    };
  });
};

// رفع النسخة الاحتياطية إلى Google Drive
export const backupToGoogleDrive = async (): Promise<{ success: boolean; message: string; fileId?: string }> => {
  try {
    if (!gapiInited || !gisInited) {
      const initialized = await initializeGoogleAPIs();
      if (!initialized) {
        return { success: false, message: 'Google Drive غير مفعل. يرجى إضافة بيانات API.' };
      }
    }

    const accessToken = await getAccessToken();
    (window as any).gapi.client.setToken({ access_token: accessToken });

    const backupData = await collectBackupData();
    const fileName = `branch_gear_backup_${new Date().toISOString().split('T')[0]}.json`;
    
    const blob = new Blob([JSON.stringify(backupData, null, 2)], { type: 'application/json' });
    
    const metadata = {
      name: fileName,
      mimeType: 'application/json',
      description: 'Branch Gear System Backup',
    };

    const form = new FormData();
    form.append('metadata', new Blob([JSON.stringify(metadata)], { type: 'application/json' }));
    form.append('file', blob);

    const response = await fetch('https://www.googleapis.com/upload/drive/v3/files?uploadType=multipart', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${accessToken}`,
      },
      body: form,
    });

    if (!response.ok) {
      throw new Error('Failed to upload backup to Google Drive');
    }

    const result = await response.json();
    
    return {
      success: true,
      message: `تم حفظ النسخة الاحتياطية بنجاح: ${fileName}`,
      fileId: result.id,
    };
  } catch (error: any) {
    console.error('Backup error:', error);
    return {
      success: false,
      message: error.message || 'فشل حفظ النسخة الاحتياطية',
    };
  }
};

// استعادة البيانات من ملف
const restoreDataToIndexedDB = async (data: BackupData): Promise<void> => {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open('branch_gear_db', 1);

    request.onsuccess = () => {
      const db = request.result;
      const storeNames = ['branches', 'customers', 'equipment', 'rentals', 'maintenance', 'expenses'];
      
      let completed = 0;
      const errors: string[] = [];

      storeNames.forEach((storeName) => {
        if (!db.objectStoreNames.contains(storeName)) {
          completed++;
          if (completed === storeNames.length) {
            finishRestore();
          }
          return;
        }

        const transaction = db.transaction(storeName, 'readwrite');
        const store = transaction.objectStore(storeName);

        const clearRequest = store.clear();

        clearRequest.onsuccess = () => {
          const items = (data as any)[storeName] || [];
          
          items.forEach((item: any) => {
            try {
              store.add(item);
            } catch (error) {
              console.error(`Error adding item to ${storeName}:`, error);
            }
          });
        };

        transaction.oncomplete = () => {
          completed++;
          if (completed === storeNames.length) {
            finishRestore();
          }
        };

        transaction.onerror = () => {
          errors.push(`Error restoring ${storeName}`);
          completed++;
          if (completed === storeNames.length) {
            finishRestore();
          }
        };
      });

      const finishRestore = () => {
        if (data.offlineUsers && data.offlineUsers.length > 0) {
          try {
            localStorage.setItem('offline.user', JSON.stringify(data.offlineUsers[0]));
          } catch (error) {
            console.error('Error restoring offline user:', error);
          }
        }

        if (errors.length > 0) {
          reject(new Error(errors.join(', ')));
        } else {
          resolve();
        }
      };

      if (storeNames.length === 0) {
        finishRestore();
      }
    };

    request.onerror = () => {
      reject(request.error);
    };
  });
};

// قائمة النسخ الاحتياطية من Google Drive
export const listBackups = async (): Promise<{ success: boolean; files?: any[]; message?: string }> => {
  try {
    if (!gapiInited || !gisInited) {
      await initializeGoogleAPIs();
    }

    const accessToken = await getAccessToken();
    (window as any).gapi.client.setToken({ access_token: accessToken });

    const response = await (window as any).gapi.client.drive.files.list({
      q: "name contains 'branch_gear_backup' and mimeType='application/json'",
      fields: 'files(id, name, createdTime, size)',
      orderBy: 'createdTime desc',
      pageSize: 20,
    });

    return {
      success: true,
      files: response.result.files || [],
    };
  } catch (error: any) {
    console.error('List backups error:', error);
    return {
      success: false,
      message: error.message || 'فشل جلب قائمة النسخ الاحتياطية',
    };
  }
};

// استعادة من Google Drive
export const restoreFromGoogleDrive = async (fileId: string): Promise<{ success: boolean; message: string }> => {
  try {
    if (!gapiInited || !gisInited) {
      await initializeGoogleAPIs();
    }

    const accessToken = await getAccessToken();
    (window as any).gapi.client.setToken({ access_token: accessToken });

    const response = await fetch(`https://www.googleapis.com/drive/v3/files/${fileId}?alt=media`, {
      headers: {
        Authorization: `Bearer ${accessToken}`,
      },
    });

    if (!response.ok) {
      throw new Error('Failed to download backup from Google Drive');
    }

    const backupData: BackupData = await response.json();

    await restoreDataToIndexedDB(backupData);

    return {
      success: true,
      message: 'تم استعادة النسخة الاحتياطية بنجاح. يرجى إعادة تحميل الصفحة.',
    };
  } catch (error: any) {
    console.error('Restore error:', error);
    return {
      success: false,
      message: error.message || 'فشل استعادة النسخة الاحتياطية',
    };
  }
};

// حذف نسخة احتياطية
export const deleteBackup = async (fileId: string): Promise<{ success: boolean; message: string }> => {
  try {
    if (!gapiInited || !gisInited) {
      await initializeGoogleAPIs();
    }

    const accessToken = await getAccessToken();
    (window as any).gapi.client.setToken({ access_token: accessToken });

    await (window as any).gapi.client.drive.files.delete({
      fileId: fileId,
    });

    return {
      success: true,
      message: 'تم حذف النسخة الاحتياطية بنجاح',
    };
  } catch (error: any) {
    console.error('Delete backup error:', error);
    return {
      success: false,
      message: error.message || 'فشل حذف النسخة الاحتياطية',
    };
  }
};

// تصدير محلي (بدون Google Drive)
export const exportLocalBackup = async (): Promise<void> => {
  try {
    const backupData = await collectBackupData();
    const fileName = `branch_gear_backup_${new Date().toISOString().split('T')[0]}.json`;
    
    const blob = new Blob([JSON.stringify(backupData, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    
    const a = document.createElement('a');
    a.href = url;
    a.download = fileName;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  } catch (error) {
    console.error('Export local backup error:', error);
    throw error;
  }
};

// استيراد محلي (بدون Google Drive)
export const importLocalBackup = async (file: File): Promise<{ success: boolean; message: string }> => {
  try {
    const text = await file.text();
    const backupData: BackupData = JSON.parse(text);
    
    await restoreDataToIndexedDB(backupData);
    
    return {
      success: true,
      message: 'تم استعادة النسخة الاحتياطية بنجاح. يرجى إعادة تحميل الصفحة.',
    };
  } catch (error: any) {
    console.error('Import local backup error:', error);
    return {
      success: false,
      message: error.message || 'فشل استيراد النسخة الاحتياطية',
    };
  }
};
