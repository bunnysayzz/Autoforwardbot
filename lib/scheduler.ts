import TelegramBot from 'node-telegram-bot-api';
import {
  getAllActiveSchedules,
  getScheduledPostsByIds,
  updateScheduleLastExecuted,
  cleanOldUserStates
} from './storage';
import { getAdminChannels } from './telegram';
import { loadFooter } from './storage';

/**
 * Execute scheduled posts for a specific time
 */
export async function executeScheduledPosts(bot: TelegramBot, currentTime: string): Promise<void> {
  try {
    console.log(`SCHEDULER: Checking for scheduled posts at ${currentTime}`);
    
    // Get all active schedules
    console.log('SCHEDULER: Fetching all active schedules from database...');
    const activeSchedules = await getAllActiveSchedules();
    console.log(`SCHEDULER: Found ${activeSchedules.length} active schedules`);
    
    if (activeSchedules.length === 0) {
      console.log('SCHEDULER: No active schedules found, returning');
      return;
    }
    
    // Log all schedule times for debugging
    activeSchedules.forEach((schedule, index) => {
      console.log(`SCHEDULER: Schedule ${index + 1} - Times: [${schedule.times.join(', ')}], User: ${schedule.userId}`);
    });
    
    // Filter schedules that match the current time
    const matchingSchedules = activeSchedules.filter(schedule => 
      schedule.times.includes(currentTime)
    );
    
    console.log(`SCHEDULER: Found ${matchingSchedules.length} schedules matching time ${currentTime}`);
    
    if (matchingSchedules.length === 0) {
      console.log(`SCHEDULER: No schedules match current time ${currentTime}, returning`);
      return;
    }
    
    // Get admin channels for forwarding
    const adminChannels = await getAdminChannels();
    if (adminChannels.length === 0) {
      console.log('No admin channels found for forwarding');
      return;
    }
    
    // Get footer text
    const footerText = await loadFooter();
    
    // Execute each matching schedule
    for (const schedule of matchingSchedules) {
      try {
        await executeIndividualSchedule(bot, schedule, adminChannels, footerText);
        
        // Update last executed time
        await updateScheduleLastExecuted(schedule._id);
        
        console.log(`Successfully executed schedule ${schedule._id} for user ${schedule.userId}`);
      } catch (error) {
        console.error(`Error executing schedule ${schedule._id}:`, error);
        
        // Notify user about the error
        try {
          await bot.sendMessage(parseInt(schedule.userId),
            `❌ Error executing your scheduled posts at ${currentTime}. Please check your schedule configuration.`
          );
        } catch (notifyError) {
          console.error('Error notifying user about schedule failure:', notifyError);
        }
      }
    }
    
  } catch (error) {
    console.error('Error in executeScheduledPosts:', error);
  }
}

/**
 * Execute an individual schedule
 */
async function executeIndividualSchedule(
  bot: TelegramBot, 
  schedule: any, 
  adminChannels: any[], 
  footerText: string
): Promise<void> {
  
  // Get posts for this schedule
  console.log(`SCHEDULER: Fetching ${schedule.postIds.length} saved posts for schedule ${schedule._id}`);
  const posts = await getScheduledPostsByIds(schedule.postIds);
  
  if (posts.length === 0) {
    throw new Error('No posts found for schedule');
  }
  
  console.log(`SCHEDULER: Found ${posts.length} posts in database`);
  console.log(`SCHEDULER: Need to select ${schedule.postsPerTime} posts randomly`);
  
  // Randomly select posts to send
  const postsToSend = selectRandomPosts(posts, schedule.postsPerTime);
  
  console.log(`SCHEDULER: Selected ${postsToSend.length} posts to send for schedule ${schedule._id}`);
  
  // Forward each selected post to all admin channels
  for (const post of postsToSend) {
    await forwardPostToChannels(bot, post, adminChannels, footerText);
    
    // Add delay between posts to avoid rate limiting
    await sleep(1000);
  }
}

/**
 * Select random posts from available posts using Fisher-Yates shuffle
 */
export function selectRandomPosts(posts: any[], count: number): any[] {
  if (posts.length <= count) {
    console.log(`SCHEDULER: Returning all ${posts.length} posts (requested ${count})`);
    return posts;
  }
  
  // Create a copy to avoid mutating the original array
  const postsCopy = [...posts];
  
  // Fisher-Yates shuffle algorithm for true randomness
  for (let i = postsCopy.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [postsCopy[i], postsCopy[j]] = [postsCopy[j], postsCopy[i]];
  }
  
  const selectedPosts = postsCopy.slice(0, count);
  console.log(`SCHEDULER: Randomly selected ${selectedPosts.length} posts from ${posts.length} available`);
  
  // Log selected post IDs for debugging
  const selectedIds = selectedPosts.map(post => post._id || 'unknown');
  console.log(`SCHEDULER: Selected post IDs: [${selectedIds.join(', ')}]`);
  
  return selectedPosts;
}

/**
 * Forward a post to all admin channels
 */
async function forwardPostToChannels(
  bot: TelegramBot, 
  post: any, 
  adminChannels: any[], 
  footerText: string
): Promise<void> {
  
  for (const channel of adminChannels) {
    try {
      await sendPostToChannel(bot, post, channel.id, footerText);
      console.log(`Successfully sent post ${post._id} to channel ${channel.title || channel.id}`);
      
      // Add delay between channels to avoid rate limiting
      await sleep(500);
    } catch (error) {
      console.error(`Error sending post ${post._id} to channel ${channel.id}:`, error);
    }
  }
}

/**
 * Send a specific post to a specific channel
 */
async function sendPostToChannel(
  bot: TelegramBot, 
  post: any, 
  channelId: string, 
  footerText: string
): Promise<void> {
  
  const messageText = post.content || post.caption || '';
  const finalMessage = footerText ? `${messageText}\n\n${footerText}` : messageText;
  
  try {
    switch (post.messageType) {
      case 'text':
        await bot.sendMessage(channelId, finalMessage);
        break;
        
      case 'photo':
        await bot.sendPhoto(channelId, post.fileId, { 
          caption: finalMessage.substring(0, 1024) // Telegram caption limit
        });
        break;
        
      case 'video':
        await bot.sendVideo(channelId, post.fileId, { 
          caption: finalMessage.substring(0, 1024)
        });
        break;
        
      case 'document':
        await bot.sendDocument(channelId, post.fileId, { 
          caption: finalMessage.substring(0, 1024)
        });
        break;
        
      case 'audio':
        await bot.sendAudio(channelId, post.fileId, { 
          caption: finalMessage.substring(0, 1024)
        });
        break;
        
      case 'voice':
        await bot.sendVoice(channelId, post.fileId);
        if (finalMessage) {
          await bot.sendMessage(channelId, finalMessage);
        }
        break;
        
      case 'animation':
        await bot.sendAnimation(channelId, post.fileId, { 
          caption: finalMessage.substring(0, 1024)
        });
        break;
        
      default:
        console.warn(`Unknown post type: ${post.messageType}`);
        await bot.sendMessage(channelId, finalMessage);
    }
  } catch (error) {
    console.error(`Error sending ${post.messageType} to channel ${channelId}:`, error);
    throw error;
  }
}

/**
 * Sleep function for adding delays
 */
function sleep(ms: number): Promise<void> {
  return new Promise(resolve => setTimeout(resolve, ms));
}

/**
 * Get current time in HH:MM format (Indian Standard Time - IST)
 */
export function getCurrentTime(): string {
  // Get current time in IST (UTC+5:30)
  const now = new Date();
  const istTime = new Date(now.getTime() + (5.5 * 60 * 60 * 1000)); // Add 5.5 hours for IST
  const hours = istTime.getUTCHours().toString().padStart(2, '0');
  const minutes = istTime.getUTCMinutes().toString().padStart(2, '0');
  return `${hours}:${minutes}`;
}

/**
 * Start the scheduler that checks every minute
 */
export function startScheduler(bot: TelegramBot): void {
  console.log('Starting post scheduler...');
  
  // Run immediately
  executeScheduledPosts(bot, getCurrentTime());
  
  // Run every minute
  setInterval(async () => {
    const currentTime = getCurrentTime();
    await executeScheduledPosts(bot, currentTime);
  }, 60000); // 60 seconds
  
  // Clean up old user states every hour
  setInterval(async () => {
    await cleanOldUserStates();
  }, 3600000); // 1 hour
  
  // Database keep-alive and monitoring through scheduler activity (every 15 minutes)
  setInterval(async () => {
    try {
      // Perform a lightweight database operation to keep it active
      const activeSchedules = await getAllActiveSchedules();
      console.log(`Database keep-alive via scheduler: ${activeSchedules.length} active schedules`);
      
      // Also run database health monitoring
      const { monitorAndWakeDatabase } = await import('./db-health');
      await monitorAndWakeDatabase();
    } catch (error) {
      console.error('Scheduler database keep-alive failed:', error);
    }
  }, 15 * 60 * 1000); // 15 minutes
  
  console.log('Post scheduler started successfully with database keep-alive');
}

/**
 * Manually trigger scheduled posts (for testing)
 */
export async function triggerScheduledPosts(bot: TelegramBot, time?: string): Promise<string> {
  try {
    const targetTime = time || getCurrentTime();
    console.log(`Manually triggering scheduled posts for time: ${targetTime}`);
    
    await executeScheduledPosts(bot, targetTime);
    
    return `✅ Scheduled posts triggered for time ${targetTime}`;
  } catch (error) {
    console.error('Error manually triggering scheduled posts:', error);
    return `❌ Error triggering scheduled posts: ${(error as Error).message}`;
  }
} 