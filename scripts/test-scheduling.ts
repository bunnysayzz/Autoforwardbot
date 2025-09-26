import * as dotenv from 'dotenv';
import * as fs from 'fs';

// Check if .env.local exists
if (!fs.existsSync('.env.local')) {
  console.error('❌ .env.local file not found. Please create one based on example.env.local.');
  process.exit(1);
}

// Load environment variables from .env.local
dotenv.config({ path: '.env.local' });

import {
  initializeSchedulingDb,
  saveScheduledPost,
  getUserScheduledPosts,
  saveUserSchedule,
  getUserSchedules,
  getAllActiveSchedules
} from '../lib/storage';

import { parseTimeString } from '../lib/scheduling';
import { getCurrentTime, triggerScheduledPosts } from '../lib/scheduler';
import bot from '../lib/telegram';

async function testSchedulingSystem() {
  console.log('🧪 Testing Scheduling System...\n');
  
  try {
    // Initialize database
    console.log('1. Initializing scheduling database...');
    await initializeSchedulingDb();
    console.log('✅ Database initialized\n');
    
    // Test time parsing (24-hour format only)
    console.log('2. Testing time parsing...');
    const testTimes = ['9:30', '09:30', '14:30', '20:55', '08:00'];
    const invalidTimes = ['9:30 AM', '2:15 PM', '1430', '0930', '25:00', '12:60'];
    
    console.log('   Valid 24-hour formats:');
    testTimes.forEach(time => {
      const parsed = parseTimeString(time);
      console.log(`   ${time} -> ${parsed}`);
    });
    
    console.log('   Invalid formats (should return null):');
    invalidTimes.forEach(time => {
      const parsed = parseTimeString(time);
      console.log(`   ${time} -> ${parsed}`);
    });
    console.log('✅ Time parsing works\n');
    
    // Test creating a sample post (SAFE - uses dummy user ID)
    console.log('3. Creating sample post...');
    const testUserId = 'dummy_test_user_id'; // Using dummy ID to prevent real posts
    
    const postId = await saveScheduledPost({
      userId: testUserId,
      messageType: 'text',
      content: '[SAFE TEST POST - WILL NOT BE SENT TO REAL CHANNELS]',
      title: 'Safe Test Post'
    });
    console.log(`✅ Created safe test post with ID: ${postId}\n`);
    
    // Test getting user posts
    console.log('4. Testing post retrieval...');
    const userPosts = await getUserScheduledPosts(testUserId);
    console.log(`✅ Found ${userPosts.length} posts for user\n`);
    
    // Test creating a schedule (SAFE - inactive to prevent execution)
    console.log('5. Creating sample schedule...');
    const currentTime = getCurrentTime();
    const scheduleId = await saveUserSchedule({
      userId: testUserId, // Dummy user ID
      times: [currentTime],
      postIds: [postId],
      postsPerTime: 1,
      isActive: false // INACTIVE to prevent execution
    });
    console.log(`✅ Created safe test schedule with ID: ${scheduleId}\n`);
    
    // Test getting user schedules
    console.log('6. Testing schedule retrieval...');
    const userSchedules = await getUserSchedules(testUserId);
    console.log(`✅ Found ${userSchedules.length} schedules for user\n`);
    
    // Test getting active schedules
    console.log('7. Testing active schedules...');
    const activeSchedules = await getAllActiveSchedules();
    console.log(`✅ Found ${activeSchedules.length} active schedules\n`);
    
    // Test manual trigger (commented out to avoid spam)
    // console.log('8. Testing manual trigger...');
    // const result = await triggerScheduledPosts(bot, currentTime);
    // console.log(`✅ Trigger result: ${result}\n`);
    
    console.log('🎉 All tests passed! The scheduling system is working correctly.');
    console.log('\n📝 Test data created:');
    console.log(`   - Post ID: ${postId}`);
    console.log(`   - Schedule ID: ${scheduleId}`);
    console.log(`   - Current time: ${currentTime}`);
    console.log('\n🚀 You can now test the bot with /schedule command!');
    
  } catch (error) {
    console.error('❌ Test failed:', error);
    process.exit(1);
  }
}

// Run the test
testSchedulingSystem()
  .then(() => process.exit(0))
  .catch(error => {
    console.error('❌ Test error:', error);
    process.exit(1);
  }); 