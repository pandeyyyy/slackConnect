import mongoose, { Document, Schema } from 'mongoose';

export interface IScheduledMessage extends Document {
  userId: string;
  slackUserId: string;
  channel: string;
  channelName: string;
  text: string;
  scheduledTime: Date;
  slackScheduledMessageId?: string;
  status: 'pending' | 'sent' | 'cancelled' | 'failed';
  retryCount: number;
  sentAt?: Date;
  cancelledAt?: Date;
  errorMessage?: string;
  createdAt: Date;
  updatedAt: Date;
}

const ScheduledMessageSchema = new Schema<IScheduledMessage>({
  userId: { type: String, required: true },
  slackUserId: { type: String, required: true },
  channel: { type: String, required: true },
  channelName: { type: String, required: true },
  text: { type: String, required: true },
  scheduledTime: { type: Date, required: true },
  slackScheduledMessageId: { type: String },
  status: { 
    type: String, 
    enum: ['pending', 'sent', 'cancelled', 'failed'],
    default: 'pending'
  },
  retryCount: { type: Number, default: 0 },
  sentAt: { type: Date },
  cancelledAt: { type: Date },
  errorMessage: { type: String },
}, { timestamps: true });

export const ScheduledMessage = mongoose.model<IScheduledMessage>('ScheduledMessage', ScheduledMessageSchema);
