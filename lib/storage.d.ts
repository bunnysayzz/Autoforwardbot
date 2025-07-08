export function loadChannels(): Promise<string[]>;
export function saveChannels(channels: string[]): Promise<void>;
export function addChannel(channelId: string): Promise<void>;
export function removeChannel(channelId: string): Promise<void>;
export function loadFooter(): Promise<string>;
export function saveFooter(text: string): Promise<void>;
export function clearFooter(): Promise<void>; 