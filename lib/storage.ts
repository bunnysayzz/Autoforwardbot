import { getCollection, db } from './astra';

// Define collection names
const CHANNELS_COLLECTION = 'channels';
const FOOTER_COLLECTION = 'footer';
const FOOTER_DOCUMENT_ID = 'singleton_footer';

/**
 * Initialize the database by creating the 'channels' and 'footer' collections if they don't exist.
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