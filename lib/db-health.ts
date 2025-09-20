import { db } from './astra';

export interface DatabaseHealth {
  isActive: boolean;
  lastCheck: string;
  responseTime: number;
  error?: string;
}

/**
 * Check database health status
 */
export async function checkDatabaseHealth(): Promise<DatabaseHealth> {
  const startTime = Date.now();
  
  try {
    // Try a simple database operation
    await db.command({ findCollections: {} });
    
    const responseTime = Date.now() - startTime;
    
    return {
      isActive: true,
      lastCheck: new Date().toISOString(),
      responseTime
    };
  } catch (error) {
    const responseTime = Date.now() - startTime;
    
    return {
      isActive: false,
      lastCheck: new Date().toISOString(),
      responseTime,
      error: (error as Error).message
    };
  }
}

/**
 * Attempt to wake up a sleeping database
 */
export async function wakeUpDatabase(): Promise<boolean> {
  try {
    console.log('🔄 Attempting to wake up database...');
    
    // Try multiple operations to wake up the database
    const operations = [
      () => db.command({ findCollections: {} }),
      () => db.command({ findCollections: {} }),
      () => db.command({ findCollections: {} })
    ];
    
    for (const operation of operations) {
      try {
        await operation();
        await new Promise(resolve => setTimeout(resolve, 500)); // Small delay between operations
      } catch (error) {
        console.log('Wake-up operation failed, trying next...');
      }
    }
    
    // Final check to see if it's awake
    const health = await checkDatabaseHealth();
    
    if (health.isActive) {
      console.log('✅ Database successfully awakened');
      return true;
    } else {
      console.log('❌ Database still appears to be sleeping');
      return false;
    }
  } catch (error) {
    console.error('❌ Failed to wake up database:', error);
    return false;
  }
}

/**
 * Get database status for admin monitoring
 */
export async function getDatabaseStatus(): Promise<string> {
  const health = await checkDatabaseHealth();
  
  if (health.isActive) {
    return `✅ Database is active\n⏱️ Response time: ${health.responseTime}ms\n🕐 Last check: ${new Date(health.lastCheck).toLocaleString()}`;
  } else {
    return `❌ Database appears to be sleeping\n⏱️ Response time: ${health.responseTime}ms\n🕐 Last check: ${new Date(health.lastCheck).toLocaleString()}\n❗ Error: ${health.error}`;
  }
}

/**
 * Monitor database and auto-wake if needed
 */
export async function monitorAndWakeDatabase(): Promise<void> {
  const health = await checkDatabaseHealth();
  
  if (!health.isActive) {
    console.log('Database detected as sleeping, attempting to wake...');
    const awakened = await wakeUpDatabase();
    
    if (awakened) {
      console.log('Database successfully awakened by monitor');
    } else {
      console.error('Monitor failed to wake database');
    }
  }
} 