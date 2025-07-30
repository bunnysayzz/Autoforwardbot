'use client';

import { useEffect } from 'react';
import { startKeepAlive } from '../lib/astra';

export default function KeepAliveInitializer() {
  useEffect(() => {
    // Start the keep-alive mechanism when the component mounts
    startKeepAlive();
    
    // Clean up on unmount
    return () => {
      // Note: We're not stopping the keep-alive here because we want it to run
      // even when the user navigates away from the page.
    };
  }, []);

  // This component doesn't render anything
  return null;
}
