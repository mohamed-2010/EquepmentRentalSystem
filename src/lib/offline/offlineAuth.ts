// حفظ واسترجاع بيانات تسجيل الدخول للعمل offline
const AUTH_STORAGE_KEY = "offline_auth_data";
const USER_STORAGE_KEY = "offline_user_data";

export interface OfflineAuthData {
  email: string;
  hashedPassword: string; // مشفر
  lastLogin: string;
}

export interface OfflineUserData {
  id: string;
  email: string;
  full_name?: string;
  phone?: string;
  role?: string;
  branch_id?: string;
}

// حفظ بيانات المستخدم عند تسجيل الدخول بنجاح
export function saveOfflineAuth(email: string, password: string): void {
  try {
    // في production يجب استخدام تشفير حقيقي
    const hashedPassword = btoa(password); // Base64 للتجربة فقط

    const authData: OfflineAuthData = {
      email,
      hashedPassword,
      lastLogin: new Date().toISOString(),
    };

    localStorage.setItem(AUTH_STORAGE_KEY, JSON.stringify(authData));
  } catch (error) {
    console.error("Error saving offline auth:", error);
  }
}

// حفظ بيانات المستخدم الكاملة
export function saveOfflineUser(userData: OfflineUserData): void {
  try {
    localStorage.setItem(USER_STORAGE_KEY, JSON.stringify(userData));
  } catch (error) {
    console.error("Error saving offline user:", error);
  }
}

// التحقق من تسجيل الدخول offline
export function verifyOfflineAuth(email: string, password: string): boolean {
  try {
    const storedData = localStorage.getItem(AUTH_STORAGE_KEY);
    if (!storedData) return false;

    const authData: OfflineAuthData = JSON.parse(storedData);
    const hashedPassword = btoa(password);

    return (
      authData.email === email && authData.hashedPassword === hashedPassword
    );
  } catch (error) {
    console.error("Error verifying offline auth:", error);
    return false;
  }
}

// الحصول على بيانات المستخدم المحفوظة
export function getOfflineUser(): OfflineUserData | null {
  try {
    const userData = localStorage.getItem(USER_STORAGE_KEY);
    return userData ? JSON.parse(userData) : null;
  } catch (error) {
    console.error("Error getting offline user:", error);
    return null;
  }
}

// حذف بيانات التسجيل (عند تسجيل الخروج)
export function clearOfflineAuth(): void {
  try {
    localStorage.removeItem(AUTH_STORAGE_KEY);
    // لا نحذف USER_STORAGE_KEY لأننا قد نحتاجه للعرض
  } catch (error) {
    console.error("Error clearing offline auth:", error);
  }
}

// التحقق من وجود تسجيل دخول محفوظ
export function hasOfflineAuth(): boolean {
  return localStorage.getItem(AUTH_STORAGE_KEY) !== null;
}
