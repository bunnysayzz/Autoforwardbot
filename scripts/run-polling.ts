import * as dotenv from 'dotenv';
import * as fs from 'fs';

// Check if .env.local exists
if (!fs.existsSync('.env.local')) {
  console.error('❌ .env.local file not found. Please create one based on example.env.local.');
  process.exit(1);
}

// Load environment variables from .env.local
dotenv.config({ path: '.env.local' });

import bot from '../lib/telegram';
import { handleMessage, handleCallbackQuery, initializeBot } from './bot';
import { isAdmin, getAdminChannels } from '../lib/telegram';
import { initializeDb } from '../lib/storage';

// Get configuration from environment variables
const ADMIN_USER_ID = process.env.ADMIN_USER_ID;

if (!ADMIN_USER_ID) {
  throw new Error('ADMIN_USER_ID is not defined in the environment variables');
}

// Start the bot with polling
bot.startPolling({ polling: true });

console.log('Bot started in polling mode...');

// Send a startup message to the admin
(async () => {
  try {
    console.log('Initializing database...');
    await initializeDb();
    console.log('Database initialized successfully.');
    
    // Initialize bot (setup commands and start scheduler)
    await initializeBot();
    
    const message = `🤖 Bot started in polling mode\n\n` +
                   `📋 **Channel Management:**\n` +
                   `- /channel - Show all stored channels with their admin status\n` +
                   `- /add_channel - Add a channel to the forwarding list\n` +
                   `- /remove_channel - Remove a channel from the forwarding list\n\n` +
                   `⏰ **Scheduling System:**\n` +
                   `- /schedule - Manage post scheduling system\n` +
                   `- /manage_posts - Add or manage saved posts for scheduling\n` +
                   `- /my_schedules - View and manage your active schedules\n\n` +
                   `🔧 **Other Commands:**\n` +
                   `- /footer - Set a footer text to append to all forwarded messages\n` +
                   `- /clearfooter - Clear the current footer\n\n` +
                   `📨 To forward a message immediately, simply send it to this bot.\n` +
                   `⏰ The scheduling system is now active and will automatically forward scheduled posts!`;
    
    await bot.sendMessage(ADMIN_USER_ID, message);
    
    // Get and report initial channel count
    const channels = await getAdminChannels();
    if (channels.length > 0) {
      await bot.sendMessage(
        ADMIN_USER_ID, 
        `Found ${channels.length} channels where the bot has admin rights.`
      );
    } else {
      await bot.sendMessage(
        ADMIN_USER_ID, 
        'No channels found. Use /add_channel to add channels where the bot is an admin.'
      );
    }
  } catch (error) {
    console.error('Error sending startup message:', error);
  }
})();

// Handle incoming messages
bot.on('message', async (msg) => {
  try {
    await handleMessage(msg);
  } catch (error) {
    console.error('Error handling message:', error);
    if (isAdmin(msg.from?.id)) {
      await bot.sendMessage(
        msg.chat.id,
        `Error processing message: ${(error as Error).message}`
      );
    }
  }
});

// Handle callback queries (inline keyboard button presses)
bot.on('callback_query', async (callbackQuery) => {
  try {
    await handleCallbackQuery(callbackQuery);
  } catch (error) {
    console.error('Error handling callback query:', error);
    if (isAdmin(callbackQuery.from.id)) {
      await bot.answerCallbackQuery(callbackQuery.id, {
        text: 'An error occurred. Please try again.',
        show_alert: true
      });
    }
  }
});

console.log(`Bot is now ready to receive messages from admin user ${ADMIN_USER_ID}`);

// Handle termination signals
process.on('SIGINT', () => {
  bot.stopPolling();
  console.log('Bot stopped due to SIGINT');
  process.exit(0);
});

process.on('SIGTERM', () => {
  bot.stopPolling();
  console.log('Bot stopped due to SIGTERM');
  process.exit(0);
});
