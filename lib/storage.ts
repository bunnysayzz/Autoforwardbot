import fs from 'fs';
import path from 'path';

// Define the storage file path
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

// Ensure data directory exists
if (!fs.existsSync(DATA_DIR)) {
  try {
    fs.mkdirSync(DATA_DIR, { recursive: true });
  } catch (error) {
    console.error('Failed to create data directory:', error);
  }
}

// Initialize storage with default values
const defaultData: StorageData = {
  channels: [],
  lastUpdated: new Date().toISOString()
};

const defaultFooter: FooterData = {
  text: '',
  lastUpdated: new Date().toISOString()
};

/**
 * Load channel data from storage
 */
export function loadChannels(): string[] {
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
  try {
    // Ensure directory exists
    if (!fs.existsSync(DATA_DIR)) {
      fs.mkdirSync(DATA_DIR, { recursive: true });
    }

    // Remove duplicates and empty strings
    const filteredChannels = channels.filter(Boolean);
    const uniqueChannels = Array.from(new Set(filteredChannels));

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
  const channels = loadChannels();
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