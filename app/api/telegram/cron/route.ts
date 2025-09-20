import { NextRequest, NextResponse } from 'next/server';
import { executeScheduledPosts, getCurrentTime } from '../../../../lib/scheduler';
import bot from '../../../../lib/telegram';

// Allow CORS for external cron services
export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';
export const fetchCache = 'force-no-store';

/**
 * Cron endpoint for triggering scheduled posts
 * Can be called by external cron services like cron-job.org
 */
export async function GET(request: NextRequest) {
  console.log('Cron endpoint called for scheduled posts');
  
  try {
    // Optional: Add secret validation for security
    const url = new URL(request.url);
    const secret = url.searchParams.get('secret');
    const validSecret = process.env.WEBHOOK_SECRET;
    
    if (validSecret && secret !== validSecret) {
      console.error('Invalid cron secret');
      return NextResponse.json(
        { success: false, error: 'Invalid secret' },
        { status: 401 }
      );
    }
    
    const currentTime = getCurrentTime();
    console.log(`Cron: Checking for scheduled posts at ${currentTime}`);
    
    await executeScheduledPosts(bot, currentTime);
    
    return NextResponse.json(
      { 
        success: true, 
        message: `Scheduled posts checked for time ${currentTime}`,
        timestamp: new Date().toISOString()
      },
      {
        headers: {
          'Content-Type': 'application/json',
          'Cache-Control': 'no-store, max-age=0'
        }
      }
    );
    
  } catch (error) {
    console.error('Error in cron endpoint:', error);
    return NextResponse.json(
      { 
        success: false, 
        error: `Cron execution failed: ${(error as Error).message}` 
      },
      { 
        status: 500,
        headers: {
          'Content-Type': 'application/json',
          'Cache-Control': 'no-store, max-age=0'
        }
      }
    );
  }
}

/**
 * POST method for manual triggering with specific time
 */
export async function POST(request: NextRequest) {
  console.log('Manual cron trigger called');
  
  try {
    const body = await request.json();
    const targetTime = body.time || getCurrentTime();
    
    console.log(`Manual trigger: Checking for scheduled posts at ${targetTime}`);
    
    await executeScheduledPosts(bot, targetTime);
    
    return NextResponse.json(
      { 
        success: true, 
        message: `Scheduled posts manually triggered for time ${targetTime}`,
        timestamp: new Date().toISOString()
      }
    );
    
  } catch (error) {
    console.error('Error in manual cron trigger:', error);
    return NextResponse.json(
      { 
        success: false, 
        error: `Manual trigger failed: ${(error as Error).message}` 
      },
      { status: 500 }
    );
  }
} 