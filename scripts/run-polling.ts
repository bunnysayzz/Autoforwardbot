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
import { handleMessage, setupBotCommands } from './bot';
import { isAdmin, getAdminChannels } from '../lib/telegram';

// Get configuration from environment variables
const ADMIN_USER_ID = process.env.ADMIN_USER_ID;

if (!ADMIN_USER_ID) {
  throw new Error('ADMIN_USER_ID is not defined in the environment variables');
}

// Start the bot with polling
bot.startPolling({ polling: true });

console.log('Bot started in polling mode...');

// Setup bot commands to be shown in the menu
setupBotCommands();

// Send a startup message to the admin
(async () => {
  try {
    const message = `🤖 Bot started in polling mode\n\n` +
                   `Commands available:\n` +
                   `- /start - Start the bot and get welcome message\n` +
                   `- /channel - Show all stored channels with their admin status\n` +
                   `- /add_channel - Add a channel to the forwarding list\n` +
                   `- /remove_channel - Remove a channel from the forwarding list\n` +
                   `- /footer - Set a footer text to append to all forwarded messages\n` +
                   `- /clearfooter - Clear the current footer\n\n` +
                   `To forward a message to all channels, simply send it to this bot.`;
    
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
