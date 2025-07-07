export function loadChannels(): string[];
export function saveChannels(channels: string[]): void;
export function addChannel(channelId: string): void;
export function removeChannel(channelId: string): void;
export function loadFooter(): string;
export function saveFooter(text: string): void;
export function clearFooter(): void; 