import * as cron from 'node-cron';
import { ScheduledMessage } from '../models/ScheduledMessage';
import { SlackService } from './SlackService';

export class SchedulerService {
  private static instance: SchedulerService;
  private slackService: SlackService;

  private constructor() {
    this.slackService = new SlackService();
    this.startScheduler();
  }

  static getInstance(): SchedulerService {
    if (!SchedulerService.instance) {
      SchedulerService.instance = new SchedulerService();
    }
    return SchedulerService.instance;
  }

  private startScheduler() {
    cron.schedule('* * * * *', async () => {
      await this.processPendingMessages();
    });

    console.log('📅 Scheduler started - checking for pending messages every minute');
  }

  private async processPendingMessages() {
    try {
      const now = new Date();
      const pendingMessages = await ScheduledMessage.find({
        status: 'pending',
        scheduledTime: { $lte: now },
      }).limit(50);

      if (pendingMessages.length > 0) {
        console.log(`📨 Processing ${pendingMessages.length} pending messages`);
      }

      for (const message of pendingMessages) {
        try {
          await this.slackService.sendMessage(
            message.slackUserId,
            message.channel,
            message.text
          );

          message.status = 'sent';
          message.sentAt = new Date();
          await message.save();
          
          console.log(`✅ Sent scheduled message ${message._id} to #${message.channelName}`);
        } catch (error: any) {
          console.error(`❌ Failed to send message ${message._id}:`, error);
          
          message.retryCount = (message.retryCount || 0) + 1;
          message.errorMessage = error.message;
          
          if (message.retryCount >= 3) {
            message.status = 'failed';
            console.log(`💀 Message ${message._id} marked as failed after 3 retries`);
          }
          
          await message.save();
        }
      }
    } catch (error) {
      console.error('❌ Error processing pending messages:', error);
    }
  }
}
