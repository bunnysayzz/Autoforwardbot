import { getCollection, db } from './astra';

// Define collection names
const CHANNELS_COLLECTION = 'channels';
const FOOTER_COLLECTION = 'footer';
const FOOTER_DOCUMENT_ID = 'singleton_footer';

/**
 * Initialize the database by creating all necessary collections.
 */
export async function initializeDb() {
  try {
    await db.createCollection(CHANNELS_COLLECTION);
    console.log(`Collection '${CHANNELS_COLLECTION}' created or already exists.`);
  } catch (e) {
    // Assuming error means collection already exists, which is fine.
    // A more robust implementation would check the error type.
    console.log(`Collection '${CHANNELS_COLLECTION}' already exists.`);
  }

  try {
    await db.createCollection(FOOTER_COLLECTION);
    console.log(`Collection '${FOOTER_COLLECTION}' created or already exists.`);
  } catch (e) {
    console.log(`Collection '${FOOTER_COLLECTION}' already exists.`);
  }

  // Also initialize scheduling database
  await initializeSchedulingDb();
}

interface Channel {
  _id: string; // Using channel ID as the document ID
}

interface Footer {
  _id: string;
  text: string;
  lastUpdated: string;
}

/**
 * Load channel data from Astra DB
 */
export async function loadChannels(): Promise<string[]> {
  try {
    const collection = await getCollection(CHANNELS_COLLECTION);
    // Find all documents, projecting only the _id field
    const cursor = collection.find<Channel>({}, {
      projection: {
        _id: 1,
      },
    });
    const channels = await cursor.toArray();
    return channels.map((channel: Channel) => channel._id);
  } catch (error) {
    console.error('Error loading channels from Astra DB:', error);
    return [];
  }
}

/**
 * Save multiple channels to Astra DB (overwrites existing channels).
 * This is a destructive operation and should be used with caution.
 */
export async function saveChannels(channels: string[]): Promise<void> {
  try {
    const uniqueChannels = Array.from(new Set(channels.filter(Boolean)));
    const collection = await getCollection(CHANNELS_COLLECTION);

    // Clear the existing collection
    await collection.deleteMany({});

    // Insert new channels if there are any
    if (uniqueChannels.length > 0) {
      const documents = uniqueChannels.map(id => ({ _id: id }));
      await collection.insertMany(documents);
    }
    
    console.log(`Saved ${uniqueChannels.length} channels to Astra DB`);
  } catch (error) {
    console.error('Error saving channels to Astra DB:', error);
  }
}

/**
 * Add a single channel to Astra DB
 */
export async function addChannel(channelId: string): Promise<void> {
  console.log(`Adding channel ${channelId} to Astra DB`);
  try {
    const collection = await getCollection(CHANNELS_COLLECTION);
    await collection.updateOne(
      { _id: channelId },
      { $setOnInsert: { _id: channelId } },
      { upsert: true }
    );
    console.log(`Channel ${channelId} added successfully.`);
  } catch (error) {
    console.error(`Error adding channel ${channelId} to Astra DB:`, error);
    throw error; // Re-throw the error to be handled by the caller
  }
}

/**
 * Remove a channel from Astra DB
 */
export async function removeChannel(channelId: string): Promise<void> {
  if (!channelId) return;

  try {
    const collection = await getCollection(CHANNELS_COLLECTION);
    const result = await collection.deleteOne({ _id: channelId });
    if (result.deletedCount > 0) {
      console.log(`Removed channel ${channelId} from Astra DB`);
    }
  } catch (error) {
    console.error(`Error removing channel ${channelId} from Astra DB:`, error);
  }
}

/**
 * Load footer text from Astra DB
 */
export async function loadFooter(): Promise<string> {
  try {
    const collection = await getCollection(FOOTER_COLLECTION);
    const footerDoc = await collection.findOne<Footer>({ _id: FOOTER_DOCUMENT_ID });
    return footerDoc ? footerDoc.text : '';
  } catch (error) {
    console.error('Error loading footer from Astra DB:', error);
    return '';
  }
}

/**
 * Save footer text to Astra DB
 */
export async function saveFooter(text: string): Promise<void> {
  try {
    const collection = await getCollection(FOOTER_COLLECTION);
    await collection.findOneAndUpdate(
      { _id: FOOTER_DOCUMENT_ID },
      {
        $set: {
          text: text,
          lastUpdated: new Date().toISOString(),
        },
      },
      { upsert: true }
    );
    console.log('Footer saved to Astra DB');
  } catch (error) {
    console.error('Error saving footer to Astra DB:', error);
  }
}

/**
 * Clear footer text from Astra DB
 */
export async function clearFooter(): Promise<void> {
  try {
    await saveFooter('');
    console.log('Footer cleared from Astra DB');
  } catch (error) {
    console.error('Error clearing footer from Astra DB:', error);
  }
}

// ============= SCHEDULING SYSTEM =============

// Define new collection names for scheduling
const SCHEDULED_POSTS_COLLECTION = 'scheduled_posts';
const USER_SCHEDULES_COLLECTION = 'user_schedules';
const USER_STATES_COLLECTION = 'user_states';

// Interfaces for scheduling system
interface ScheduledPost {
  _id: string;
  userId: string;
  messageType: 'text' | 'photo' | 'video' | 'document' | 'audio' | 'voice' | 'animation';
  content: string; // For text messages
  fileId?: string; // For media messages
  caption?: string; // For media with captions
  createdAt: string;
  title?: string; // User-defined title for the post
}

interface UserSchedule {
  _id: string;
  userId: string;
  times: string[]; // Array of times in HH:MM format
  postIds: string[]; // Array of post IDs to include in this schedule
  postsPerTime: number; // Number of posts to send each time
  isActive: boolean;
  createdAt: string;
  lastExecuted?: string;
}

interface UserState {
  _id: string; // userId
  currentFlow?: 'schedule_setup' | 'post_management' | 'time_input' | 'post_selection';
  tempData?: any; // Temporary data for multi-step flows
  lastActivity: string;
}

/**
 * Initialize the scheduling collections
 */
export async function initializeSchedulingDb() {
  const collections = [SCHEDULED_POSTS_COLLECTION, USER_SCHEDULES_COLLECTION, USER_STATES_COLLECTION];
  
  for (const collectionName of collections) {
    try {
      await db.createCollection(collectionName);
      console.log(`Collection '${collectionName}' created or already exists.`);
    } catch (e) {
      console.log(`Collection '${collectionName}' already exists.`);
    }
  }
}

// ============= SCHEDULED POSTS FUNCTIONS =============

/**
 * Save a new scheduled post
 */
export async function saveScheduledPost(post: Omit<ScheduledPost, '_id' | 'createdAt'>): Promise<string> {
  try {
    const collection = await getCollection(SCHEDULED_POSTS_COLLECTION);
    const postId = `post_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    const postData: ScheduledPost = {
      ...post,
      _id: postId,
      createdAt: new Date().toISOString()
    };
    
    await collection.insertOne(postData);
    console.log(`Scheduled post ${postId} saved successfully.`);
    return postId;
  } catch (error) {
    console.error('Error saving scheduled post:', error);
    throw error;
  }
}

/**
 * Get all scheduled posts for a user
 */
export async function getUserScheduledPosts(userId: string): Promise<ScheduledPost[]> {
  try {
    const collection = await getCollection(SCHEDULED_POSTS_COLLECTION);
    const cursor = collection.find<ScheduledPost>({ userId });
    return await cursor.toArray();
  } catch (error) {
    console.error('Error loading user scheduled posts:', error);
    return [];
  }
}

/**
 * Get specific scheduled posts by IDs
 */
export async function getScheduledPostsByIds(postIds: string[]): Promise<ScheduledPost[]> {
  try {
    const collection = await getCollection(SCHEDULED_POSTS_COLLECTION);
    const cursor = collection.find<ScheduledPost>({ _id: { $in: postIds } });
    return await cursor.toArray();
  } catch (error) {
    console.error('Error loading scheduled posts by IDs:', error);
    return [];
  }
}

/**
 * Delete a scheduled post
 */
export async function deleteScheduledPost(postId: string, userId: string): Promise<boolean> {
  try {
    const collection = await getCollection(SCHEDULED_POSTS_COLLECTION);
    const result = await collection.deleteOne({ _id: postId, userId });
    return result.deletedCount > 0;
  } catch (error) {
    console.error('Error deleting scheduled post:', error);
    return false;
  }
}

// ============= USER SCHEDULES FUNCTIONS =============

/**
 * Save a user schedule
 */
export async function saveUserSchedule(schedule: Omit<UserSchedule, '_id' | 'createdAt'>): Promise<string> {
  try {
    const collection = await getCollection(USER_SCHEDULES_COLLECTION);
    const scheduleId = `schedule_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    const scheduleData: UserSchedule = {
      ...schedule,
      _id: scheduleId,
      createdAt: new Date().toISOString()
    };
    
    await collection.insertOne(scheduleData);
    console.log(`User schedule ${scheduleId} saved successfully.`);
    return scheduleId;
  } catch (error) {
    console.error('Error saving user schedule:', error);
    throw error;
  }
}

/**
 * Get all schedules for a user
 */
export async function getUserSchedules(userId: string): Promise<UserSchedule[]> {
  try {
    const collection = await getCollection(USER_SCHEDULES_COLLECTION);
    const cursor = collection.find<UserSchedule>({ userId });
    return await cursor.toArray();
  } catch (error) {
    console.error('Error loading user schedules:', error);
    return [];
  }
}

/**
 * Get all active schedules (for daily execution)
 */
export async function getAllActiveSchedules(): Promise<UserSchedule[]> {
  try {
    const collection = await getCollection(USER_SCHEDULES_COLLECTION);
    const cursor = collection.find<UserSchedule>({ isActive: true });
    return await cursor.toArray();
  } catch (error) {
    console.error('Error loading active schedules:', error);
    return [];
  }
}

/**
 * Update schedule last executed time
 */
export async function updateScheduleLastExecuted(scheduleId: string): Promise<void> {
  try {
    const collection = await getCollection(USER_SCHEDULES_COLLECTION);
    await collection.updateOne(
      { _id: scheduleId },
      { $set: { lastExecuted: new Date().toISOString() } }
    );
  } catch (error) {
    console.error('Error updating schedule last executed:', error);
  }
}

/**
 * Delete a user schedule
 */
export async function deleteUserSchedule(scheduleId: string, userId: string): Promise<boolean> {
  try {
    const collection = await getCollection(USER_SCHEDULES_COLLECTION);
    const result = await collection.deleteOne({ _id: scheduleId, userId });
    return result.deletedCount > 0;
  } catch (error) {
    console.error('Error deleting user schedule:', error);
    return false;
  }
}

/**
 * Toggle schedule active status
 */
export async function toggleScheduleStatus(scheduleId: string, userId: string): Promise<boolean> {
  try {
    const collection = await getCollection(USER_SCHEDULES_COLLECTION);
    const schedule = await collection.findOne<UserSchedule>({ _id: scheduleId, userId });
    if (!schedule) return false;
    
    const newStatus = !schedule.isActive;
    await collection.updateOne(
      { _id: scheduleId, userId },
      { $set: { isActive: newStatus } }
    );
    return newStatus;
  } catch (error) {
    console.error('Error toggling schedule status:', error);
    return false;
  }
}

// ============= USER STATES FUNCTIONS =============

/**
 * Save user state for conversation flow
 */
export async function saveUserState(userId: string, state: Omit<UserState, '_id' | 'lastActivity'>): Promise<void> {
  try {
    const collection = await getCollection(USER_STATES_COLLECTION);
    await collection.findOneAndUpdate(
      { _id: userId },
      {
        $set: {
          ...state,
          lastActivity: new Date().toISOString()
        }
      },
      { upsert: true }
    );
  } catch (error) {
    console.error('Error saving user state:', error);
  }
}

/**
 * Get user state
 */
export async function getUserState(userId: string): Promise<UserState | null> {
  try {
    const collection = await getCollection(USER_STATES_COLLECTION);
    return await collection.findOne<UserState>({ _id: userId });
  } catch (error) {
    console.error('Error loading user state:', error);
    return null;
  }
}

/**
 * Clear user state
 */
export async function clearUserState(userId: string): Promise<void> {
  try {
    const collection = await getCollection(USER_STATES_COLLECTION);
    await collection.deleteOne({ _id: userId });
  } catch (error) {
    console.error('Error clearing user state:', error);
  }
}

/**
 * Clean old user states (older than 24 hours)
 */
export async function cleanOldUserStates(): Promise<void> {
  try {
    const collection = await getCollection(USER_STATES_COLLECTION);
    const cutoffTime = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString();
    await collection.deleteMany({ lastActivity: { $lt: cutoffTime } });
    console.log('Old user states cleaned up');
  } catch (error) {
    console.error('Error cleaning old user states:', error);
  }
} 