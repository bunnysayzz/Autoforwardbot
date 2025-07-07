import fs from 'fs';
import path from 'path';

// Define the storage file path for local development
const DATA_DIR = path.join(process.cwd(), 'data');
const CHANNELS_FILE = path.join(DATA_DIR, 'channels.json');
const FOOTER_FILE = path.join(DATA_DIR, 'footer.json');

// Define the storage data structure
interface StorageData {
  channels: string[];
  lastUpdated: string;
}

interface FooterData {
  text: string;
  lastUpdated: string;
}

// In-memory storage for Vercel serverless environment
let memoryChannels: string[] = [];
let memoryFooter: string = '';

// Check if we're in a Vercel environment
const isVercel = process.env.VERCEL === '1';

// Initialize storage with default values
const defaultData: StorageData = {
  channels: [],
  lastUpdated: new Date().toISOString()
};

const defaultFooter: FooterData = {
  text: '',
  lastUpdated: new Date().toISOString()
};

// Ensure data directory exists for local development
if (!isVercel && !fs.existsSync(DATA_DIR)) {
  try {
    fs.mkdirSync(DATA_DIR, { recursive: true });
  } catch (error) {
    console.error('Failed to create data directory:', error);
  }
}

/**
 * Load channel data from storage
 */
export function loadChannels(): string[] {
  // For Vercel, try to load from environment variable first
  if (isVercel) {
    try {
      // If we have in-memory channels, use those
      if (memoryChannels.length > 0) {
        return memoryChannels;
      }
      
      // Try to load from environment variable
      const envChannels = process.env.STORED_CHANNELS;
      if (envChannels) {
        memoryChannels = JSON.parse(envChannels);
        return memoryChannels;
      }
      
      return [];
    } catch (error) {
      console.error('Error loading channels from environment:', error);
      return [];
    }
  }
  
  // For local development, use file-based storage
  try {
    if (!fs.existsSync(CHANNELS_FILE)) {
      // Initialize with empty data if file doesn't exist
      fs.writeFileSync(CHANNELS_FILE, JSON.stringify(defaultData, null, 2));
      return [];
    }

    const data = JSON.parse(fs.readFileSync(CHANNELS_FILE, 'utf8')) as StorageData;
    return data.channels || [];
  } catch (error) {
    console.error('Error loading channels from storage:', error);
    return [];
  }
}

/**
 * Save channel data to storage
 */
export function saveChannels(channels: string[]): void {
  // Remove duplicates and empty strings
  const filteredChannels = channels.filter(Boolean);
  const uniqueChannels = Array.from(new Set(filteredChannels));
  
  // For Vercel, store in memory
  if (isVercel) {
    try {
      memoryChannels = uniqueChannels;
      console.log(`Stored ${uniqueChannels.length} channels in memory`);
      return;
    } catch (error) {
      console.error('Error saving channels to memory:', error);
    }
    return;
  }
  
  // For local development, use file-based storage
  try {
    // Ensure directory exists
    if (!fs.existsSync(DATA_DIR)) {
      fs.mkdirSync(DATA_DIR, { recursive: true });
    }

    const data: StorageData = {
      channels: uniqueChannels,
      lastUpdated: new Date().toISOString()
    };

    fs.writeFileSync(CHANNELS_FILE, JSON.stringify(data, null, 2));
    console.log(`Saved ${uniqueChannels.length} channels to storage`);
  } catch (error) {
    console.error('Error saving channels to storage:', error);
  }
}

/**
 * Add a single channel to storage
 */
export function addChannel(channelId: string): void {
  // Load current channels (either from memory or file)
  const channels = loadChannels();
  
  // Add channel if it doesn't exist
  if (!channels.includes(channelId)) {
    channels.push(channelId);
    saveChannels(channels);
    console.log(`Added channel ${channelId} to storage`);
  }
}

/**
 * Remove a channel from storage
 */
export function removeChannel(channelId: string): void {
  const channels = loadChannels();
  const updatedChannels = channels.filter(id => id !== channelId);
  
  if (channels.length !== updatedChannels.length) {
    saveChannels(updatedChannels);
    console.log(`Removed channel ${channelId} from storage`);
  }
} 

/**
 * Load footer text from storage
 */
export function loadFooter(): string {
  // For Vercel, try to load from environment variable first
  if (isVercel) {
    try {
      // If we have in-memory footer, use that
      if (memoryFooter) {
        return memoryFooter;
      }
      
      // Try to load from environment variable
      const envFooter = process.env.STORED_FOOTER;
      if (envFooter) {
        memoryFooter = envFooter;
        return memoryFooter;
      }
      
      return '';
    } catch (error) {
      console.error('Error loading footer from environment:', error);
      return '';
    }
  }
  
  // For local development, use file-based storage
  try {
    if (!fs.existsSync(FOOTER_FILE)) {
      // Initialize with empty data if file doesn't exist
      fs.writeFileSync(FOOTER_FILE, JSON.stringify(defaultFooter, null, 2));
      return '';
    }

    const data = JSON.parse(fs.readFileSync(FOOTER_FILE, 'utf8')) as FooterData;
    return data.text || '';
  } catch (error) {
    console.error('Error loading footer from storage:', error);
    return '';
  }
}

/**
 * Save footer text to storage
 * Preserves all Telegram's special formatting and clickable links
 */
export function saveFooter(text: string): void {
  // For Vercel, store in memory
  if (isVercel) {
    try {
      memoryFooter = text;
      console.log('Footer saved in memory');
      return;
    } catch (error) {
      console.error('Error saving footer to memory:', error);
    }
    return;
  }
  
  // For local development, use file-based storage
  try {
    // Ensure directory exists
    if (!fs.existsSync(DATA_DIR)) {
      fs.mkdirSync(DATA_DIR, { recursive: true });
    }

    const data: FooterData = {
      text: text,
      lastUpdated: new Date().toISOString()
    };

    fs.writeFileSync(FOOTER_FILE, JSON.stringify(data, null, 2));
    console.log('Footer saved to storage');
  } catch (error) {
    console.error('Error saving footer to storage:', error);
  }
}

/**
 * Clear footer text from storage
 */
export function clearFooter(): void {
  try {
    saveFooter('');
    console.log('Footer cleared from storage');
  } catch (error) {
    console.error('Error clearing footer from storage:', error);
  }
} 