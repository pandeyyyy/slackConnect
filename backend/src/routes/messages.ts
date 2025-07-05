import express from 'express';
import { SlackService } from '../services/SlackService';
import { ScheduledMessage } from '../models/ScheduledMessage';
import { authenticateToken, AuthRequest } from '../middleware/auth';

const router = express.Router();
const slackService = new SlackService();

router.get('/channels', authenticateToken, async (req: AuthRequest, res) => {
  try {
    const channels = await slackService.getChannels(req.user.slackUserId);
    res.json({ channels });
  } catch (error: any) {
    console.error('❌ Get channels error:', error);
    
    if (error.message.includes('Authentication required')) {
      return res.status(401).json({ 
        error: error.message,
        needsReauth: true 
      });
    }
    
    res.status(500).json({ error: 'Failed to fetch channels' });
  }
});

router.post('/send', authenticateToken, async (req: AuthRequest, res) => {
  try {
    const { channel, channelName, text } = req.body;

    if (!channel || !text) {
      return res.status(400).json({ error: 'Channel and text are required' });
    }

    const result = await slackService.sendMessage(
      req.user.slackUserId,
      channel,
      text
    );

    res.json({ success: true, messageId: result.ts });
  } catch (error: any) {
    console.error('❌ Send message error:', error);
    
    if (error.message.includes('Authentication required')) {
      return res.status(401).json({ 
        error: error.message,
        needsReauth: true 
      });
    }
    
    res.status(500).json({ error: 'Failed to send message' });
  }
});

router.post('/schedule', authenticateToken, async (req: AuthRequest, res) => {
  try {
    const { channel, channelName, text, scheduledTime } = req.body;

    if (!channel || !text || !scheduledTime) {
      return res.status(400).json({ error: 'Channel, text, and scheduledTime are required' });
    }

    const scheduledDate = new Date(scheduledTime);
    const postAt = Math.floor(scheduledDate.getTime() / 1000);

    const result = await slackService.scheduleMessage(
      req.user.slackUserId,
      channel,
      text,
      postAt
    );

    const scheduledMessage = new ScheduledMessage({
      userId: req.user._id,
      slackUserId: req.user.slackUserId,
      channel,
      channelName,
      text,
      scheduledTime: scheduledDate,
      slackScheduledMessageId: result.scheduled_message_id,
      status: 'pending',
      retryCount: 0,
    });

    await scheduledMessage.save();

    console.log(`📅 Message scheduled for ${scheduledDate} in #${channelName}`);

    res.json({ 
      success: true, 
      scheduledMessageId: scheduledMessage._id,
      slackScheduledMessageId: result.scheduled_message_id 
    });
  } catch (error: any) {
    console.error('❌ Schedule message error:', error);
    
    if (error.message.includes('Authentication required')) {
      return res.status(401).json({ 
        error: error.message,
        needsReauth: true 
      });
    }
    
    res.status(500).json({ error: 'Failed to schedule message' });
  }
});

router.get('/scheduled', authenticateToken, async (req: AuthRequest, res) => {
  try {
    const { status, limit = 50 } = req.query;
    
    const filter: any = { slackUserId: req.user.slackUserId };
    if (status) filter.status = status;

    const messages = await ScheduledMessage.find(filter)
      .sort({ scheduledTime: -1 })
      .limit(parseInt(limit as string));

    res.json({ messages, total: messages.length });
  } catch (error) {
    console.error('❌ Get scheduled messages error:', error);
    res.status(500).json({ error: 'Failed to fetch scheduled messages' });
  }
});

router.delete('/scheduled/:messageId', authenticateToken, async (req: AuthRequest, res) => {
  try {
    const { messageId } = req.params;

    const message = await ScheduledMessage.findOne({
      _id: messageId,
      slackUserId: req.user.slackUserId,
      status: 'pending',
    });

    if (!message) {
      return res.status(404).json({ error: 'Scheduled message not found' });
    }

    if (message.slackScheduledMessageId) {
      try {
        await slackService.deleteScheduledMessage(
          req.user.slackUserId,
          message.channel,
          message.slackScheduledMessageId
        );
      } catch (slackError) {
        console.error('❌ Failed to cancel message with Slack:', slackError);
      }
    }

    message.status = 'cancelled';
    message.cancelledAt = new Date();
    await message.save();

    console.log(`🚫 Cancelled scheduled message ${messageId}`);

    res.json({ success: true });
  } catch (error: any) {
    console.error('❌ Cancel message error:', error);
    
    if (error.message.includes('Authentication required')) {
      return res.status(401).json({ 
        error: error.message,
        needsReauth: true 
      });
    }
    
    res.status(500).json({ error: 'Failed to cancel message' });
  }
});

export default router;
