// Utility functions for Electron environment

export const isElectron = (): boolean => {
  return typeof window !== "undefined" && window.electron?.isElectron === true;
};

export const getElectronAPI = () => {
  if (!isElectron()) {
    console.warn("Electron API not available - running in browser");
    return null;
  }
  return window.electron;
};

export const getAppInfo = async () => {
  const electron = getElectronAPI();
  if (!electron) return null;

  try {
    return await electron.getAppInfo();
  } catch (error) {
    console.error("Failed to get app info:", error);
    return null;
  }
};

export const getPlatform = (): string => {
  if (isElectron()) {
    return window.electron?.platform || "unknown";
  }
  return "web";
};

// Log environment info
if (isElectron()) {
  console.log("🖥️ Running in Electron");
  getAppInfo().then((info) => {
    if (info) {
      console.log("📱 App Info:", info);
    }
  });
} else {
  console.log("🌐 Running in Browser");
}
