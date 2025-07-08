import bot from '../lib/telegram';
import { isAdmin, getAdminChannels, addChannelHint } from '../lib/telegram';
import { loadChannels, removeChannel, loadFooter, saveFooter, clearFooter } from '../lib/storage';
import { Message } from 'node-telegram-bot-api';

const ADMIN_USER_ID = process.env.ADMIN_USER_ID;

if (!ADMIN_USER_ID) {
  throw new Error('ADMIN_USER_ID is not defined in the environment variables');
}

// Set up the commands that will be shown in the bot menu
export async function setupBotCommands() {
  try {
    await bot.setMyCommands([
      { command: 'start', description: 'Start the bot and get welcome message' },
      { command: 'channel', description: 'Show all stored channels with their admin status' },
      { command: 'add_channel', description: 'Add a channel to the forwarding list (use with channel ID)' },
      { command: 'remove_channel', description: 'Remove a channel from the forwarding list (use with channel ID)' },
      { command: 'footer', description: 'Set a footer text to append to all forwarded messages' },
      { command: 'clearfooter', description: 'Clear the current footer' }
    ]);
    console.log('Bot commands have been set up successfully');
  } catch (error) {
    console.error('Error setting up bot commands:', error);
  }
}

// Flag to track whether we're waiting for footer input
let awaitingFooter = false;

export async function handleMessage(message: Message) {
  const chatId = message.chat.id;
  const userId = message.from?.id;

  if (!isAdmin(userId)) {
    await bot.sendMessage(chatId, 'You are not authorized to use this bot.');
    console.log(`Unauthorized access attempt by user ${userId}`);
    return;
  }

  // Handle /start command
  if (message.text?.startsWith('/start')) {
    try {
      const welcomeMessage = `👋 Welcome to the Telegram Autoforward Bot!\n\n` +
                            `This bot forwards your messages to all channels where it has admin rights.\n\n` +
                            `Available commands:\n` +
                            `- /channel - Show all stored channels with their admin status\n` +
                            `- /add_channel - Add a channel to the forwarding list\n` +
                            `- /remove_channel - Remove a channel from the forwarding list\n` +
                            `- /footer - Set a footer text to append to all forwarded messages\n` +
                            `- /clearfooter - Clear the current footer\n\n` +
                            `To forward a message, simply send it to this bot.`;
      
      await bot.sendMessage(chatId, welcomeMessage);
    } catch (error) {
      console.error('Error sending welcome message:', error);
      await bot.sendMessage(chatId, `Error: ${(error as Error).message}`);
    }
    return;
  }

  // Handle /channel command
  if (message.text?.startsWith('/channel')) {
    try {
      const storedChannels = await loadChannels();
      if (storedChannels.length > 0) {
        // Get chat info for each stored channel
        const channelDetails = await Promise.all(storedChannels.map(async (id: string) => {
          try {
            const chat = await bot.getChat(id);
            const botMember = await bot.getChatMember(id, (await bot.getMe()).id);
            const status = botMember.status === 'administrator' || botMember.status === 'creator' 
              ? '✅ (admin)' 
              : '❌ (not admin)';
            return `- ${chat.title || chat.username || id} (${id}) ${status}`;
          } catch (error) {
            return `- ${id} (cannot access: ${(error as Error).message})`;
          }
        }));
        
        await bot.sendMessage(
          chatId,
          `Stored channels (${storedChannels.length}):\n\n${channelDetails.join('\n')}\n\nOnly channels with admin rights will be used for forwarding.`
        );
      } else {
        await bot.sendMessage(chatId, 'No channels are currently stored. Use /add_channel to add channels where the bot is an admin.');
      }
    } catch (error) {
      console.error('Error fetching channel details:', error);
      await bot.sendMessage(chatId, `Error fetching channel details: ${(error as Error).message}`);
    }
    return;
  }
  
  // Handle /add_channel command - format: /add_channel -100123456789
  if (message.text?.startsWith('/add_channel')) {
    const parts = message.text.split(' ');
    if (parts.length < 2) {
      await bot.sendMessage(
        chatId,
        'Please provide a channel ID. Format: /add_channel -100123456789'
      );
      return;
    }
    
    const channelId = parts[1].trim();
    if (!channelId.startsWith('-100')) {
      await bot.sendMessage(
        chatId,
        'Invalid channel ID format. Channel IDs typically start with -100. Format: /add_channel -100123456789'
      );
      return;
    }
    
    try {
      // Try to get chat info to validate the channel exists
      const chat = await bot.getChat(channelId);
      
      // Add the channel to storage
      await addChannelHint(channelId);
      
      // Check if bot is admin
      const me = await bot.getMe();
      const botMember = await bot.getChatMember(channelId, me.id);
      
      if (botMember.status === 'administrator' || botMember.status === 'creator') {
        await bot.sendMessage(
          chatId,
          `✅ Channel "${chat.title || chat.username || channelId}" added successfully. The bot has admin rights in this channel.`
        );
      } else {
        await bot.sendMessage(
          chatId,
          `⚠️ Channel "${chat.title || chat.username || channelId}" added, but the bot is not an admin. Please add the bot as an admin to the channel.`
        );
      }
    } catch (error) {
      await bot.sendMessage(
        chatId,
        `❌ Failed to add channel: ${(error as Error).message}`
      );
    }
    
    return;
  }
  
  // Handle /remove_channel command - format: /remove_channel -100123456789
  if (message.text?.startsWith('/remove_channel')) {
    const parts = message.text.split(' ');
    if (parts.length < 2) {
      await bot.sendMessage(
        chatId,
        'Please provide a channel ID. Format: /remove_channel -100123456789'
      );
      return;
    }
    
    const channelId = parts[1].trim();
    
    try {
      await removeChannel(channelId);
      await bot.sendMessage(
        chatId,
        `✅ Channel ${channelId} has been removed from the forwarding list.`
      );
    } catch (error) {
      await bot.sendMessage(
        chatId,
        `❌ Failed to remove channel: ${(error as Error).message}`
      );
    }
    
    return;
  }

  // Handle /footer command
  if (message.text?.startsWith('/footer')) {
    awaitingFooter = true;
    await bot.sendMessage(
      chatId,
      'Please send or forward the text you want to use as footer for all forwarded messages.\n\n' +
      'The footer will be appended to all forwarded messages. Special formatting and clickable links will be preserved.'
    );
    return;
  }

  // Handle /clearfooter command
  if (message.text?.startsWith('/clearfooter')) {
    try {
      await clearFooter();
      await bot.sendMessage(
        chatId,
        '✅ Footer has been cleared successfully. Messages will be forwarded without a footer.'
      );
    } catch (error) {
      await bot.sendMessage(
        chatId,
        `❌ Failed to clear footer: ${(error as Error).message}`
      );
    }
    return;
  }

  // Handle footer text input if we're awaiting it
  if (awaitingFooter) {
    try {
      // Save the entire message including text and entities to preserve formatting
      let footerText = '';
      
      if (message.text) {
        footerText = message.text;
      } else if (message.caption) {
        footerText = message.caption;
      } else {
        footerText = '';
      }
      
      await saveFooter(footerText);
      
      awaitingFooter = false;
      await bot.sendMessage(
        chatId,
        '✅ Footer has been saved successfully. It will be appended to all forwarded messages.'
      );
      return;
    } catch (error) {
      awaitingFooter = false;
      await bot.sendMessage(
        chatId,
        `❌ Failed to save footer: ${(error as Error).message}`
      );
      return;
    }
  }
  
  // Handle forwarded message
  try {
    const channels = await getAdminChannels();
    
    if (channels.length > 0) {
      let forwardedCount = 0;
      let failedCount = 0;
      
      await bot.sendMessage(chatId, `Forwarding your message to ${channels.length} channels...`);
      
      // Load footer if exists
      const footer = await loadFooter();
      
      for (const channel of channels) {
        try {
          // Skip forwarding to the source chat if it's a channel
          if (channel.id === chatId) continue;
          
          // Handle different message types with footer
          if (message.text && footer) {
            // For text messages, we can append the footer directly
            const messageWithFooter = `${message.text}\n\n${footer}`;
            // Don't use parse_mode to avoid entity parsing errors
            await bot.sendMessage(channel.id, messageWithFooter);
          } else if (message.caption && footer && (message.photo || message.video || message.document || message.animation)) {
            // For media with caption, we can append the footer to the caption
            const captionWithFooter = `${message.caption || ''}\n\n${footer}`;
            
            if (message.photo) {
              // Get the largest photo (last in the array)
              const photo = message.photo[message.photo.length - 1];
              await bot.sendPhoto(channel.id, photo.file_id, {
                caption: captionWithFooter
              });
            } else if (message.video) {
              await bot.sendVideo(channel.id, message.video.file_id, {
                caption: captionWithFooter
              });
            } else if (message.document) {
              await bot.sendDocument(channel.id, message.document.file_id, {
                caption: captionWithFooter
              });
            } else if (message.animation) {
              await bot.sendAnimation(channel.id, message.animation.file_id, {
                caption: captionWithFooter
              });
            }
          } else {
            // For other types of messages or when no footer, just copy the original
            await bot.copyMessage(channel.id, chatId, message.message_id);
            
            // If there's a footer but couldn't be added directly, send it as a follow-up
            if (footer && !message.text && !message.caption) {
              // Don't use parse_mode to avoid entity parsing errors
              await bot.sendMessage(channel.id, footer);
            }
          }
          
          forwardedCount++;
        } catch (error) {
          failedCount++;
          const errorMessage = (error as any).response?.body?.description || (error as Error).message;
          console.error(`Failed to forward message to channel ${channel.id}:`, errorMessage);
          await bot.sendMessage(chatId, `Failed to forward to ${channel.title || channel.id}. Error: ${errorMessage}`);
        }
      }
      
      if (forwardedCount > 0) {
        const statusMessage = `✅ Message forwarded to ${forwardedCount} channel${forwardedCount > 1 ? 's' : ''}${
          failedCount > 0 ? ` (${failedCount} failed)` : ''
        }`;
        await bot.sendMessage(chatId, statusMessage);
      } else if (failedCount > 0) {
        await bot.sendMessage(chatId, `❌ Failed to forward message to any channel.`);
      } else {
        await bot.sendMessage(chatId, `ℹ️ No channels to forward to.`);
      }
    } else {
      await bot.sendMessage(chatId, 'No channels found. Use /add_channel to add channels where the bot is an admin.');
    }
  } catch (error) {
    console.error('Error during forwarding:', error);
    await bot.sendMessage(chatId, `Error during forwarding: ${(error as Error).message}`);
  }
}
