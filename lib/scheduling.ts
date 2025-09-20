import TelegramBot, { Message, CallbackQuery, InlineKeyboardMarkup } from 'node-telegram-bot-api';
import {
  saveScheduledPost,
  getUserScheduledPosts,
  getScheduledPostsByIds,
  deleteScheduledPost,
  saveUserSchedule,
  getUserSchedules,
  deleteUserSchedule,
  toggleScheduleStatus,
  saveUserState,
  getUserState,
  clearUserState
} from './storage';

/**
 * Parse time string to 24-hour format - ONLY accepts 24-hour format HH:MM
 */
export function parseTimeString(timeStr: string): string | null {
  // Remove any whitespace
  const cleaned = timeStr.trim();
  
  // Only accept 24-hour format HH:MM or H:MM
  const pattern = /^([0-1]?[0-9]|2[0-3]):([0-5][0-9])$/;
  
  const match = cleaned.match(pattern);
  if (match) {
    const hours = parseInt(match[1], 10);
    const minutes = parseInt(match[2], 10);
    return `${hours.toString().padStart(2, '0')}:${minutes.toString().padStart(2, '0')}`;
  }
  
  return null;
}

/**
 * Create inline keyboard for post management
 */
export function createPostManagementKeyboard(posts: any[], offset: number = 0, limit: number = 5): InlineKeyboardMarkup {
  const keyboard: any[][] = [];
  
  const paginatedPosts = posts.slice(offset, offset + limit);
  
  // Add post buttons
  paginatedPosts.forEach((post, index) => {
    const title = post.title || `${post.messageType} - ${post.content?.substring(0, 30) || 'Media'}...`;
    keyboard.push([{
      text: `📝 ${title}`,
      callback_data: `view_post_${post._id}`
    }]);
  });
  
  // Pagination buttons
  const navButtons = [];
  if (offset > 0) {
    navButtons.push({
      text: '⬅️ Previous',
      callback_data: `posts_page_${offset - limit}`
    });
  }
  if (offset + limit < posts.length) {
    navButtons.push({
      text: 'Next ➡️',
      callback_data: `posts_page_${offset + limit}`
    });
  }
  if (navButtons.length > 0) {
    keyboard.push(navButtons);
  }
  
  // Management buttons
  keyboard.push([
    {
      text: '➕ Add New Post',
      callback_data: 'add_new_post'
    },
    {
      text: '🗑️ Delete Posts',
      callback_data: 'delete_posts_mode'
    }
  ]);
  
  keyboard.push([{
    text: '🔙 Back to Menu',
    callback_data: 'back_to_main_menu'
  }]);
  
  return { inline_keyboard: keyboard };
}

/**
 * Create inline keyboard for schedule management
 */
export function createScheduleManagementKeyboard(schedules: any[]): InlineKeyboardMarkup {
  const keyboard: any[][] = [];
  
  schedules.forEach(schedule => {
    const statusIcon = schedule.isActive ? '✅' : '❌';
    const timesText = schedule.times.join(', ');
    keyboard.push([{
      text: `${statusIcon} ${timesText} (${schedule.postsPerTime} posts)`,
      callback_data: `view_schedule_${schedule._id}`
    }]);
  });
  
  keyboard.push([
    {
      text: '➕ New Schedule',
      callback_data: 'new_schedule'
    },
    {
      text: '🔙 Back to Menu',
      callback_data: 'back_to_main_menu'
    }
  ]);
  
  return { inline_keyboard: keyboard };
}

/**
 * Handle /schedule command
 */
export async function handleScheduleCommand(bot: TelegramBot, message: Message): Promise<void> {
  const chatId = message.chat.id;
  const userId = String(message.from?.id);
  
  try {
    // Clear any existing user state
    await clearUserState(userId);
    
    // Set user state for schedule setup
    await saveUserState(userId, {
      currentFlow: 'schedule_setup',
      tempData: { step: 'start' }
    });
    
    const keyboard: InlineKeyboardMarkup = {
      inline_keyboard: [
        [{
          text: '⏰ Create New Schedule',
          callback_data: 'create_new_schedule'
        }],
        [{
          text: '📋 Manage My Schedules',
          callback_data: 'manage_schedules'
        }],
        [{
          text: '📝 Manage Saved Posts',
          callback_data: 'manage_posts'
        }]
      ]
    };
    
    await bot.sendMessage(chatId, 
      '🤖 *Scheduling System*\n\n' +
      'Welcome to the post scheduling system! Here you can:\n\n' +
      '⏰ Create schedules to automatically forward random posts at specific times\n' +
      '📋 Manage your existing schedules\n' +
      '📝 Add or remove posts from your saved collection\n\n' +
      'What would you like to do?',
      { 
        parse_mode: 'Markdown',
        reply_markup: keyboard
      }
    );
  } catch (error) {
    console.error('Error in handleScheduleCommand:', error);
    await bot.sendMessage(chatId, '❌ An error occurred while initializing the scheduling system. Please try again or contact support if the issue persists.');
  }
}

/**
 * Handle /manage_posts command
 */
export async function handleManagePostsCommand(bot: TelegramBot, message: Message): Promise<void> {
  const chatId = message.chat.id;
  const userId = String(message.from?.id);
  
  try {
    const posts = await getUserScheduledPosts(userId);
    
    if (posts.length === 0) {
      const keyboard: InlineKeyboardMarkup = {
        inline_keyboard: [
          [{
            text: '➕ Add Your First Post',
            callback_data: 'add_new_post'
          }],
          [{
            text: '🔙 Back to Menu',
            callback_data: 'back_to_main_menu'
          }]
        ]
      };
      
      await bot.sendMessage(chatId,
        '📝 *Saved Posts Management*\n\n' +
        'You don\'t have any saved posts yet. Start by adding your first post!\n\n' +
        'You can save text messages, photos, videos, and other media that will be used for scheduled posting.',
        { 
          parse_mode: 'Markdown',
          reply_markup: keyboard
        }
      );
      return;
    }
    
    const keyboard = createPostManagementKeyboard(posts);
    
    await bot.sendMessage(chatId,
      `📝 *Saved Posts Management*\n\n` +
      `You have ${posts.length} saved post(s). Choose a post to view details or add new posts.`,
      { 
        parse_mode: 'Markdown',
        reply_markup: keyboard
      }
    );
    
    // Set user state
    await saveUserState(userId, {
      currentFlow: 'post_management',
      tempData: { posts, currentPage: 0 }
    });
    
  } catch (error) {
    console.error('Error in handleManagePostsCommand:', error);
    await bot.sendMessage(chatId, '❌ An error occurred while loading your posts.');
  }
}

/**
 * Handle /my_schedules command
 */
export async function handleMySchedulesCommand(bot: TelegramBot, message: Message): Promise<void> {
  const chatId = message.chat.id;
  const userId = String(message.from?.id);
  
  try {
    const schedules = await getUserSchedules(userId);
    
    if (schedules.length === 0) {
      const keyboard: InlineKeyboardMarkup = {
        inline_keyboard: [
          [{
            text: '⏰ Create Your First Schedule',
            callback_data: 'create_new_schedule'
          }],
          [{
            text: '🔙 Back to Menu',
            callback_data: 'back_to_main_menu'
          }]
        ]
      };
      
      await bot.sendMessage(chatId,
        '📋 *My Schedules*\n\n' +
        'You don\'t have any schedules yet. Create your first schedule to start automatic posting!',
        { 
          parse_mode: 'Markdown',
          reply_markup: keyboard
        }
      );
      return;
    }
    
    const keyboard = createScheduleManagementKeyboard(schedules);
    
    let scheduleText = '📋 *My Schedules*\n\n';
    schedules.forEach((schedule, index) => {
      const status = schedule.isActive ? '✅ Active' : '❌ Inactive';
      const times = schedule.times.join(', ');
      scheduleText += `${index + 1}. ${status}\n`;
      scheduleText += `   ⏰ Times: ${times}\n`;
      scheduleText += `   📊 Posts per time: ${schedule.postsPerTime}\n`;
      scheduleText += `   📝 Saved posts: ${schedule.postIds.length}\n\n`;
    });
    
    await bot.sendMessage(chatId, scheduleText, { 
      parse_mode: 'Markdown',
      reply_markup: keyboard
    });
    
  } catch (error) {
    console.error('Error in handleMySchedulesCommand:', error);
    await bot.sendMessage(chatId, '❌ An error occurred while loading your schedules.');
  }
}

/**
 * Handle callback queries for scheduling system
 */
export async function handleSchedulingCallback(bot: TelegramBot, callbackQuery: CallbackQuery): Promise<void> {
  const chatId = callbackQuery.message?.chat.id;
  const userId = String(callbackQuery.from.id);
  const data = callbackQuery.data;
  
  if (!chatId || !data) return;
  
  try {
    await bot.answerCallbackQuery(callbackQuery.id);
    
    // Handle different callback actions
    if (data === 'create_new_schedule') {
      await startScheduleCreation(bot, chatId, userId);
    } else if (data === 'manage_schedules') {
      // Redirect to my_schedules command logic
      const fakeMessage = { chat: { id: chatId }, from: { id: parseInt(userId) } } as Message;
      await handleMySchedulesCommand(bot, fakeMessage);
    } else if (data === 'manage_posts') {
      // Redirect to manage_posts command logic
      const fakeMessage = { chat: { id: chatId }, from: { id: parseInt(userId) } } as Message;
      await handleManagePostsCommand(bot, fakeMessage);
    } else if (data === 'add_new_post') {
      await startPostAddition(bot, chatId, userId);
    } else if (data === 'back_to_main_menu') {
      await clearUserState(userId);
      const fakeMessage = { chat: { id: chatId }, from: { id: parseInt(userId) } } as Message;
      await handleScheduleCommand(bot, fakeMessage);
    } else if (data.startsWith('view_post_')) {
      const postId = data.replace('view_post_', '');
      await showPostDetails(bot, chatId, userId, postId);
    } else if (data.startsWith('view_schedule_')) {
      const scheduleId = data.replace('view_schedule_', '');
      await showScheduleDetails(bot, chatId, userId, scheduleId);
    } else if (data.startsWith('posts_page_')) {
      const offset = parseInt(data.replace('posts_page_', ''));
      await showPostsPage(bot, chatId, userId, offset);
    } else if (data.startsWith('delete_post_')) {
      const postId = data.replace('delete_post_', '');
      await handlePostDeletion(bot, chatId, userId, postId);
    } else if (data.startsWith('toggle_schedule_')) {
      const scheduleId = data.replace('toggle_schedule_', '');
      await handleScheduleToggle(bot, chatId, userId, scheduleId);
    } else if (data.startsWith('delete_schedule_')) {
      const scheduleId = data.replace('delete_schedule_', '');
      await handleScheduleDeletion(bot, chatId, userId, scheduleId);
    } else if (data === 'new_schedule') {
      await startScheduleCreation(bot, chatId, userId);
    }
    
  } catch (error) {
    console.error('Error in handleSchedulingCallback:', error);
    await bot.sendMessage(chatId, '❌ An error occurred. Please try again.');
  }
}

/**
 * Start schedule creation process
 */
async function startScheduleCreation(bot: TelegramBot, chatId: number, userId: string): Promise<void> {
  await saveUserState(userId, {
    currentFlow: 'schedule_setup',
    tempData: { step: 'time_input', times: [] }
  });
  
  await bot.sendMessage(chatId,
    '⏰ *Create New Schedule*\n\n' +
    'Let\'s set up your posting schedule. First, tell me what time(s) you want posts to be sent.\n\n' +
    '📝 *24-Hour Format Only (Indian Standard Time):*\n' +
    '• `9:30` (9:30 AM IST)\n' +
    '• `14:30` (2:30 PM IST)\n' +
    '• `20:55` (8:55 PM IST)\n' +
    '• `08:00` (8:00 AM IST)\n\n' +
    '🌍 *Timezone*: All times are in Indian Standard Time (IST)\n' +
    '💡 You can send multiple times, one per message. When done, send `/done` to continue.',
    { parse_mode: 'Markdown' }
  );
}

/**
 * Start post addition process
 */
async function startPostAddition(bot: TelegramBot, chatId: number, userId: string): Promise<void> {
  await saveUserState(userId, {
    currentFlow: 'post_management',
    tempData: { step: 'add_post' }
  });
  
  await bot.sendMessage(chatId,
    '📝 *Add New Post*\n\n' +
    'Send me the content you want to save for scheduled posting. You can send:\n\n' +
    '• Text messages\n' +
    '• Photos with captions\n' +
    '• Videos with captions\n' +
    '• Documents\n' +
    '• Audio files\n\n' +
    'I\'ll save this content and you can use it in your schedules.\n\n' +
    '✋ Send `/cancel` to stop adding posts.',
    { parse_mode: 'Markdown' }
  );
}

/**
 * Show post details
 */
async function showPostDetails(bot: TelegramBot, chatId: number, userId: string, postId: string): Promise<void> {
  try {
    const posts = await getUserScheduledPosts(userId);
    const post = posts.find(p => p._id === postId);
    
    if (!post) {
      await bot.sendMessage(chatId, '❌ Post not found.');
      return;
    }
    
    const keyboard: InlineKeyboardMarkup = {
      inline_keyboard: [
        [{
          text: '🗑️ Delete Post',
          callback_data: `delete_post_${postId}`
        }],
        [{
          text: '🔙 Back to Posts',
          callback_data: 'manage_posts'
        }]
      ]
    };
    
    let detailText = `📝 *Post Details*\n\n`;
    detailText += `📅 Created: ${new Date(post.createdAt).toLocaleDateString()}\n`;
    detailText += `📋 Type: ${post.messageType}\n`;
    
    if (post.title) {
      detailText += `🏷️ Title: ${post.title}\n`;
    }
    
    if (post.content) {
      detailText += `💬 Content: ${post.content.substring(0, 200)}${post.content.length > 200 ? '...' : ''}\n`;
    }
    
    if (post.caption) {
      detailText += `📝 Caption: ${post.caption.substring(0, 200)}${post.caption.length > 200 ? '...' : ''}\n`;
    }
    
    await bot.sendMessage(chatId, detailText, {
      parse_mode: 'Markdown',
      reply_markup: keyboard
    });
    
  } catch (error) {
    console.error('Error showing post details:', error);
    await bot.sendMessage(chatId, '❌ Error loading post details.');
  }
}

/**
 * Show schedule details
 */
async function showScheduleDetails(bot: TelegramBot, chatId: number, userId: string, scheduleId: string): Promise<void> {
  try {
    const schedules = await getUserSchedules(userId);
    const schedule = schedules.find(s => s._id === scheduleId);
    
    if (!schedule) {
      await bot.sendMessage(chatId, '❌ Schedule not found.');
      return;
    }
    
    const keyboard: InlineKeyboardMarkup = {
      inline_keyboard: [
        [{
          text: schedule.isActive ? '❌ Disable' : '✅ Enable',
          callback_data: `toggle_schedule_${scheduleId}`
        }],
        [{
          text: '🗑️ Delete Schedule',
          callback_data: `delete_schedule_${scheduleId}`
        }],
        [{
          text: '🔙 Back to Schedules',
          callback_data: 'manage_schedules'
        }]
      ]
    };
    
    let detailText = `📋 *Schedule Details*\n\n`;
    detailText += `📅 Created: ${new Date(schedule.createdAt).toLocaleDateString()}\n`;
    detailText += `📊 Status: ${schedule.isActive ? '✅ Active' : '❌ Inactive'}\n`;
    detailText += `⏰ Times: ${schedule.times.join(', ')}\n`;
    detailText += `📝 Posts per time: ${schedule.postsPerTime}\n`;
    detailText += `📚 Saved posts: ${schedule.postIds.length}\n`;
    
    if (schedule.lastExecuted) {
      detailText += `🕐 Last executed: ${new Date(schedule.lastExecuted).toLocaleString()}\n`;
    }
    
    await bot.sendMessage(chatId, detailText, {
      parse_mode: 'Markdown',
      reply_markup: keyboard
    });
    
  } catch (error) {
    console.error('Error showing schedule details:', error);
    await bot.sendMessage(chatId, '❌ Error loading schedule details.');
  }
}

/**
 * Show posts page with pagination
 */
async function showPostsPage(bot: TelegramBot, chatId: number, userId: string, offset: number): Promise<void> {
  try {
    const posts = await getUserScheduledPosts(userId);
    const keyboard = createPostManagementKeyboard(posts, offset);
    
    await bot.editMessageReplyMarkup(keyboard, {
      chat_id: chatId,
      message_id: undefined // This will be handled by the bot
    });
    
  } catch (error) {
    console.error('Error showing posts page:', error);
    // Fallback to sending new message
    const fakeMessage = { chat: { id: chatId }, from: { id: parseInt(userId) } } as Message;
    await handleManagePostsCommand(bot, fakeMessage);
  }
}

/**
 * Handle message during scheduling flows
 */
export async function handleSchedulingMessage(bot: TelegramBot, message: Message): Promise<boolean> {
  const chatId = message.chat.id;
  const userId = String(message.from?.id);
  const text = message.text;
  
  try {
    const userState = await getUserState(userId);
    if (!userState) return false;
    
    // Handle different flows
    if (userState.currentFlow === 'schedule_setup') {
      return await handleScheduleSetupMessage(bot, message, userState);
    } else if (userState.currentFlow === 'post_management') {
      return await handlePostManagementMessage(bot, message, userState);
    }
    
    return false;
  } catch (error) {
    console.error('Error in handleSchedulingMessage:', error);
    await bot.sendMessage(chatId, '❌ An error occurred. Please try again.');
    return true;
  }
}

/**
 * Handle schedule setup messages
 */
async function handleScheduleSetupMessage(bot: TelegramBot, message: Message, userState: any): Promise<boolean> {
  const chatId = message.chat.id;
  const userId = String(message.from?.id);
  const text = message.text?.trim();
  
  if (!text) return false;
  
  const tempData = userState.tempData || {};
  
  if (tempData.step === 'time_input') {
    if (text === '/done') {
      if (!tempData.times || tempData.times.length === 0) {
        await bot.sendMessage(chatId, '❌ Please add at least one time before continuing.');
        return true;
      }
      
      // Move to post count input
      await saveUserState(userId, {
        currentFlow: 'schedule_setup',
        tempData: { ...tempData, step: 'post_count' }
      });
      
      await bot.sendMessage(chatId,
        '📊 *Posts per Schedule*\n\n' +
        'How many posts should be sent each time? Enter a number between 1 and 10.\n\n' +
        '💡 For example, if you enter "3", then 3 random posts will be sent at each scheduled time.',
        { parse_mode: 'Markdown' }
      );
      return true;
    }
    
    if (text === '/cancel') {
      await clearUserState(userId);
      await bot.sendMessage(chatId, '❌ Schedule creation cancelled.');
      return true;
    }
    
    // Try to parse the time
    const parsedTime = parseTimeString(text);
    if (!parsedTime) {
      await bot.sendMessage(chatId,
        '❌ Invalid time format. Please use 24-hour format only (IST):\n' +
        '• `9:30` (9:30 AM IST)\n' +
        '• `14:30` (2:30 PM IST)\n' +
        '• `20:55` (8:55 PM IST)\n' +
        '• `08:00` (8:00 AM IST)',
        { parse_mode: 'Markdown' }
      );
      return true;
    }
    
    // Check for duplicates
    const times = tempData.times || [];
    if (times.includes(parsedTime)) {
      await bot.sendMessage(chatId, `❌ Time ${parsedTime} is already added.`);
      return true;
    }
    
    // Add the time
    times.push(parsedTime);
    await saveUserState(userId, {
      currentFlow: 'schedule_setup',
      tempData: { ...tempData, times }
    });
    
    await bot.sendMessage(chatId,
      `✅ Added time: ${parsedTime}\n\n` +
      `Current times: ${times.join(', ')}\n\n` +
      'Add more times or send `/done` to continue.',
      { parse_mode: 'Markdown' }
    );
    return true;
  }
  
  if (tempData.step === 'post_count') {
    const count = parseInt(text);
    if (isNaN(count) || count < 1 || count > 10) {
      await bot.sendMessage(chatId, '❌ Please enter a number between 1 and 10.');
      return true;
    }
    
    // Check if user has saved posts
    const posts = await getUserScheduledPosts(userId);
    if (posts.length === 0) {
      await bot.sendMessage(chatId,
        '❌ You don\'t have any saved posts yet. Please add some posts first using the post management system.',
        {
          reply_markup: {
            inline_keyboard: [[{
              text: '📝 Add Posts Now',
              callback_data: 'add_new_post'
            }]]
          }
        }
      );
      return true;
    }
    
    if (posts.length < count) {
      await bot.sendMessage(chatId, 
        `❌ You only have ${posts.length} saved posts but want to send ${count} posts per time. ` +
        'Please add more posts or reduce the number of posts per time.'
      );
      return true;
    }
    
    // Automatically use ALL saved posts - no manual selection needed
    const allPostIds = posts.map(post => post._id);
    
    // Create the schedule immediately with all posts
    try {
      const scheduleId = await saveUserSchedule({
        userId,
        times: tempData.times,
        postIds: allPostIds,
        postsPerTime: count,
        isActive: true
      });
      
      // Clear user state
      await clearUserState(userId);
      
      // Send confirmation
      await bot.sendMessage(chatId,
        '✅ *Schedule Created Successfully!*\n\n' +
        `⏰ Times: ${tempData.times.join(', ')}\n` +
        `📝 Posts per time: ${count}\n` +
        `📚 Available posts: ${allPostIds.length} (all your saved posts)\n` +
        `📊 Status: Active\n\n` +
        `🎲 The bot will randomly select ${count} post(s) from your ${allPostIds.length} saved posts at each scheduled time.`,
        {
          parse_mode: 'Markdown',
          reply_markup: {
            inline_keyboard: [
              [{
                text: '📋 View My Schedules',
                callback_data: 'manage_schedules'
              }],
              [{
                text: '🔙 Back to Menu',
                callback_data: 'back_to_main_menu'
              }]
            ]
          }
        }
      );
      
    } catch (error) {
      console.error('Error creating schedule:', error);
      await bot.sendMessage(chatId, '❌ Error creating schedule. Please try again.');
    }
    
    return true;
  }
  
  return false;
}

/**
 * Handle post management messages
 */
async function handlePostManagementMessage(bot: TelegramBot, message: Message, userState: any): Promise<boolean> {
  const chatId = message.chat.id;
  const userId = String(message.from?.id);
  const tempData = userState.tempData || {};
  
  if (tempData.step === 'add_post') {
    if (message.text === '/cancel') {
      await clearUserState(userId);
      await bot.sendMessage(chatId, '❌ Post addition cancelled.');
      return true;
    }
    
    // Save the post
    await savePostFromMessage(bot, message, userId);
    return true;
  }
  
  return false;
}



/**
 * Save post from message
 */
async function savePostFromMessage(bot: TelegramBot, message: Message, userId: string): Promise<void> {
  try {
    let postData: any = {
      userId,
      messageType: 'text',
      content: '',
      title: ''
    };
    
    if (message.text) {
      postData.messageType = 'text';
      postData.content = message.text;
      postData.title = message.text.substring(0, 50) + (message.text.length > 50 ? '...' : '');
    } else if (message.photo) {
      postData.messageType = 'photo';
      postData.fileId = message.photo[message.photo.length - 1].file_id;
      postData.caption = message.caption || '';
      postData.title = `Photo${message.caption ? ` - ${message.caption.substring(0, 30)}...` : ''}`;
    } else if (message.video) {
      postData.messageType = 'video';
      postData.fileId = message.video.file_id;
      postData.caption = message.caption || '';
      postData.title = `Video${message.caption ? ` - ${message.caption.substring(0, 30)}...` : ''}`;
    } else if (message.document) {
      postData.messageType = 'document';
      postData.fileId = message.document.file_id;
      postData.caption = message.caption || '';
      postData.title = `Document - ${message.document.file_name || 'Unknown'}`;
    } else if (message.audio) {
      postData.messageType = 'audio';
      postData.fileId = message.audio.file_id;
      postData.caption = message.caption || '';
      postData.title = `Audio - ${message.audio.title || 'Unknown'}`;
    } else if (message.voice) {
      postData.messageType = 'voice';
      postData.fileId = message.voice.file_id;
      postData.title = 'Voice Message';
    } else if (message.animation) {
      postData.messageType = 'animation';
      postData.fileId = message.animation.file_id;
      postData.caption = message.caption || '';
      postData.title = `GIF${message.caption ? ` - ${message.caption.substring(0, 30)}...` : ''}`;
    } else {
      await bot.sendMessage(message.chat.id, '❌ Unsupported message type. Please send text, photo, video, document, or audio.');
      return;
    }
    
    const postId = await saveScheduledPost(postData);
    
    await bot.sendMessage(message.chat.id,
      '✅ Post saved successfully!\n\n' +
      'You can continue adding more posts or return to the main menu.',
      {
        reply_markup: {
          inline_keyboard: [
            [{
              text: '📝 Add Another Post',
              callback_data: 'add_new_post'
            }],
            [{
              text: '🔙 Back to Menu',
              callback_data: 'back_to_main_menu'
            }]
          ]
        }
      }
    );
    
  } catch (error) {
    console.error('Error saving post:', error);
    await bot.sendMessage(message.chat.id, '❌ Error saving post. Please try again.');
  }
} 





/**
 * Handle post deletion
 */
async function handlePostDeletion(bot: TelegramBot, chatId: number, userId: string, postId: string): Promise<void> {
  try {
    const success = await deleteScheduledPost(postId, userId);
    
    if (success) {
      await bot.sendMessage(chatId, '✅ Post deleted successfully.');
      
      // Return to post management
      const fakeMessage = { chat: { id: chatId }, from: { id: parseInt(userId) } } as Message;
      await handleManagePostsCommand(bot, fakeMessage);
    } else {
      await bot.sendMessage(chatId, '❌ Post not found or could not be deleted.');
    }
    
  } catch (error) {
    console.error('Error deleting post:', error);
    await bot.sendMessage(chatId, '❌ Error deleting post.');
  }
}

/**
 * Handle schedule toggle (enable/disable)
 */
async function handleScheduleToggle(bot: TelegramBot, chatId: number, userId: string, scheduleId: string): Promise<void> {
  try {
    const newStatus = await toggleScheduleStatus(scheduleId, userId);
    const statusText = newStatus ? 'enabled' : 'disabled';
    
    await bot.sendMessage(chatId, `✅ Schedule ${statusText} successfully.`);
    
    // Refresh schedule details
    await showScheduleDetails(bot, chatId, userId, scheduleId);
    
  } catch (error) {
    console.error('Error toggling schedule:', error);
    await bot.sendMessage(chatId, '❌ Error updating schedule status.');
  }
}

/**
 * Handle schedule deletion
 */
async function handleScheduleDeletion(bot: TelegramBot, chatId: number, userId: string, scheduleId: string): Promise<void> {
  try {
    const success = await deleteUserSchedule(scheduleId, userId);
    
    if (success) {
      await bot.sendMessage(chatId, '✅ Schedule deleted successfully.');
      
      // Return to schedule management
      const fakeMessage = { chat: { id: chatId }, from: { id: parseInt(userId) } } as Message;
      await handleMySchedulesCommand(bot, fakeMessage);
    } else {
      await bot.sendMessage(chatId, '❌ Schedule not found or could not be deleted.');
    }
    
  } catch (error) {
    console.error('Error deleting schedule:', error);
    await bot.sendMessage(chatId, '❌ Error deleting schedule.');
  }
} 