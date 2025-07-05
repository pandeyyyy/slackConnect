import { WebClient } from '@slack/web-api';
import { TokenManager } from './TokenManager';

export class SlackService {
  private client: WebClient;

  constructor(token?: string) {
    this.client = new WebClient(token);
  }

  async getChannels(userId: string) {
    try {
      console.log('🔍 Fetching channels for user:', userId);
      
      const token = await TokenManager.getValidAccessToken(userId);
      this.client = new WebClient(token);

      const response = await this.client.conversations.list({
        types: 'public_channel,private_channel',
        exclude_archived: true,
        limit: 1000,
      });

      if (!response.ok) {
        throw new Error(`Slack API error: ${response.error}`);
      }

      const channels = response.channels?.map(channel => ({
        id: channel.id,
        name: channel.name,
        is_private: channel.is_private,
      })) || [];

      console.log(`✅ Found ${channels.length} channels`);
      return channels;

    } catch (error: any) {
      console.error('❌ Error fetching channels:', error);
      
      if (error.message.includes('invalid_auth') || error.message.includes('token')) {
        throw new Error('Authentication required - please reconnect your Slack account');
      }
      
      throw error;
    }
  }

  async sendMessage(userId: string, channel: string, text: string) {
    try {
      const token = await TokenManager.getValidAccessToken(userId);
      this.client = new WebClient(token);

      const response = await this.client.chat.postMessage({
        channel,
        text,
      });

      if (!response.ok) {
        throw new Error(`Failed to send message: ${response.error}`);
      }

      return response;
    } catch (error: any) {
      console.error('❌ Error sending message:', error);
      
      if (error.message.includes('invalid_auth') || error.message.includes('token')) {
        throw new Error('Authentication required - please reconnect your Slack account');
      }
      
      throw error;
    }
  }

  async scheduleMessage(userId: string, channel: string, text: string, postAt: number) {
    try {
      const token = await TokenManager.getValidAccessToken(userId);
      this.client = new WebClient(token);

      const response = await this.client.chat.scheduleMessage({
        channel,
        text,
        post_at: postAt,
      });

      if (!response.ok) {
        throw new Error(`Failed to schedule message: ${response.error}`);
      }

      return response;
    } catch (error: any) {
      console.error('❌ Error scheduling message:', error);
      
      if (error.message.includes('invalid_auth') || error.message.includes('token')) {
        throw new Error('Authentication required - please reconnect your Slack account');
      }
      
      throw error;
    }
  }

  async deleteScheduledMessage(userId: string, channel: string, scheduledMessageId: string) {
    try {
      const token = await TokenManager.getValidAccessToken(userId);
      this.client = new WebClient(token);

      const response = await this.client.chat.deleteScheduledMessage({
        channel,
        scheduled_message_id: scheduledMessageId,
      });

      if (!response.ok) {
        throw new Error(`Failed to cancel scheduled message: ${response.error}`);
      }

      return response;
    } catch (error: any) {
      console.error('❌ Error cancelling scheduled message:', error);
      
      if (error.message.includes('invalid_auth') || error.message.includes('token')) {
        throw new Error('Authentication required - please reconnect your Slack account');
      }
      
      throw error;
    }
  }
}
