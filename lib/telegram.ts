import * as dotenv from 'dotenv';
// Load environment variables from .env.local
dotenv.config({ path: '.env.local' });

import TelegramBot from 'node-telegram-bot-api';
import { Chat } from 'node-telegram-bot-api';
import { loadChannels, saveChannels, addChannel as addStoredChannel } from './storage';

// Get configuration from environment variables
const token = process.env.TELEGRAM_BOT_TOKEN;
const BOT_USERNAME = process.env.BOT_USERNAME;

if (!token) {
  throw new Error('TELEGRAM_BOT_TOKEN is not defined in the environment variables');
}

// Create a bot instance with appropriate options
const bot = new TelegramBot(token, {
  polling: false, // Default to no polling, will be enabled in run-polling.ts
  filepath: false, // Don't download files locally
});

// Cache for fetched channels
let channelsCache: Chat[] = [];
let lastChannelUpdateTime = 0;

/**
 * Get channels where the bot has admin rights.
 * Uses only manually stored channels from the storage file.
 */
export async function getAdminChannels(): Promise<Chat[]> {
  // Check if we have a recent cache
  const CACHE_TTL = 5 * 60 * 1000; // 5 minutes
  if (channelsCache.length > 0 && Date.now() - lastChannelUpdateTime < CACHE_TTL) {
    return channelsCache;
  }

  try {
    // Get bot's info
    const me = await bot.getMe();
    
    // Load stored channel IDs from persistent storage
    const storedChannelIds = await loadChannels();
    console.log(`Using ${storedChannelIds.length} channels from storage`);
    
    if (storedChannelIds.length === 0) {
      console.log('No channels found in storage. Use /add_channel to add channels.');
      return [];
    }
    
    // Verify each channel and check admin rights
    const verifiedChannels: Chat[] = [];
    const validChannelIds: string[] = [];
    
    for (const channelId of storedChannelIds) {
      try {
        // Skip invalid IDs
        if (!channelId) continue;
        
        console.log(`Checking channel ID: ${channelId}`);
        const chat = await bot.getChat(channelId);
        
        // Only care about channels and supergroups
        if (chat.type !== 'channel' && chat.type !== 'supergroup') {
          console.log(`Skipping chat ${channelId}: not a channel or supergroup (type: ${chat.type})`);
          continue;
        }
        
        // Check if bot is admin
        console.log(`Checking admin status in: ${chat.title || chat.username || channelId}`);
        const botMember = await bot.getChatMember(channelId, me.id);
        console.log(`Bot status in ${channelId}: ${botMember.status}`);
        
        if (botMember.status === 'administrator' || botMember.status === 'creator') {
          console.log(`✅ Bot has admin rights in: ${chat.title || chat.username || channelId}`);
          verifiedChannels.push(chat);
          validChannelIds.push(channelId);
        } else {
          console.log(`❌ Bot is not an admin in: ${chat.title || chat.username || channelId}`);
        }
      } catch (error) {
        console.log(`Cannot access channel ${channelId}: ${(error as Error).message}`);
      }
    }
    
    console.log(`Found ${verifiedChannels.length} channels where the bot has admin rights.`);
    
    // Update the cache
    channelsCache = verifiedChannels;
    lastChannelUpdateTime = Date.now();
    
    return verifiedChannels;
  } catch (error) {
    console.error('Error fetching admin channels:', error);
    return [];
  }
}

/**
 * Adds a channel to storage
 */
export async function addChannelHint(channelId: string): Promise<void> {
  // Reset the cache to force a new check
  lastChannelUpdateTime = 0;
  
  // Store in persistent storage
  await addStoredChannel(channelId.trim());
  
  // Clear cache to force reload
  channelsCache = [];
}

// Export bot instance and additional utilities
export default bot;

// Helper function to check if we're in a production environment
export const isProduction = process.env.NODE_ENV === 'production';

// Helper function to check if the user is an admin
export function isAdmin(userId?: number): boolean {
  const ADMIN_USER_ID = process.env.ADMIN_USER_ID;
  return Boolean(ADMIN_USER_ID && userId && String(userId) === ADMIN_USER_ID);
}
