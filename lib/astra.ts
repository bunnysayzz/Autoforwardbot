import { DataAPIClient } from "@datastax/astra-db-ts";

const ASTRA_DB_URL = process.env.ASTRA_DB || "";
const ASTRA_DB_TOKEN = process.env.TOKEN || "";

if (!ASTRA_DB_URL || !ASTRA_DB_TOKEN) {
  throw new Error(
    "ASTRA_DB and TOKEN are not set in the environment variables"
  );
}

// Initialize the client and database connection
const client = new DataAPIClient(ASTRA_DB_TOKEN);
export const db = client.db(ASTRA_DB_URL);

// Keep track of the last activity time
let lastActivityTime = Date.now();

// Function to perform a simple ping to keep the connection alive
const keepAlive = async () => {
  try {
    // Perform a simple operation to keep the connection active
    await db.command({ findCollections: {} });
    lastActivityTime = Date.now();
    console.log('Astra DB keep-alive ping successful');
  } catch (error) {
    console.error('Astra DB keep-alive ping failed:', error);
    // Try to wake up the database if it's sleeping
    await wakeUpDatabase();
  }
};

// Function to wake up the database if it's sleeping
const wakeUpDatabase = async () => {
  try {
    console.log('Attempting to wake up Astra DB...');
    // Try multiple simple operations to wake up the database
    await db.command({ findCollections: {} });
    await db.command({ ping: 1 });
    console.log('Astra DB wake-up successful');
  } catch (error) {
    console.error('Failed to wake up Astra DB:', error);
  }
};

// Health check function that runs more frequently
const healthCheck = async () => {
  try {
    const timeSinceLastActivity = Date.now() - lastActivityTime;
    
    // If it's been more than 2 hours since last activity, do a keep-alive
    if (timeSinceLastActivity > 2 * 60 * 60 * 1000) {
      console.log('Database inactive for 2+ hours, performing keep-alive...');
      await keepAlive();
    }
  } catch (error) {
    console.error('Health check failed:', error);
  }
};

// Set up a keep-alive interval (runs every 4 hours to prevent sleep)
const KEEP_ALIVE_INTERVAL = 4 * 60 * 60 * 1000; // 4 hours
const HEALTH_CHECK_INTERVAL = 30 * 60 * 1000; // 30 minutes
let keepAliveInterval: NodeJS.Timeout | null = null;
let healthCheckInterval: NodeJS.Timeout | null = null;

// Function to start the keep-alive mechanism
export const startKeepAlive = () => {
  if (keepAliveInterval) return; // Already running
  
  // Initial ping
  keepAlive();
  
  // Set up interval for keep-alive pings (every 4 hours)
  keepAliveInterval = setInterval(keepAlive, KEEP_ALIVE_INTERVAL);
  
  // Set up interval for health checks (every 30 minutes)
  healthCheckInterval = setInterval(healthCheck, HEALTH_CHECK_INTERVAL);
  
  console.log('Astra DB keep-alive mechanism started (4h intervals + 30min health checks)');
};

// Function to stop the keep-alive mechanism
export const stopKeepAlive = () => {
  if (keepAliveInterval) {
    clearInterval(keepAliveInterval);
    keepAliveInterval = null;
  }
  if (healthCheckInterval) {
    clearInterval(healthCheckInterval);
    healthCheckInterval = null;
  }
  console.log('Astra DB keep-alive mechanism stopped');
};

// Start the keep-alive mechanism when the module loads
startKeepAlive();

// Clean up on process exit
process.on('SIGINT', () => {
  stopKeepAlive();
  process.exit(0);
});

// Get a collection with activity tracking and auto-wake
export const getCollection = async (collectionName: string) => {
  try {
    // Update last activity time
    lastActivityTime = Date.now();
    const collection = db.collection(collectionName);
    
    // Test the collection to ensure the database is awake
    await collection.options();
    
    return collection;
  } catch (error) {
    console.log(`Database might be sleeping, attempting to wake up for collection: ${collectionName}`);
    await wakeUpDatabase();
    
    // Update last activity time after wake-up
    lastActivityTime = Date.now();
    return db.collection(collectionName);
  }
};

export default {
  db,
  getCollection,
  startKeepAlive,
  stopKeepAlive
};
