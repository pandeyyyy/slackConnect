import mongoose, { Document, Schema } from 'mongoose';

export interface IUser extends Document {
  slackUserId: string;
  slackTeamId: string;
  accessToken: string;
  botToken?: string;
  refreshToken?: string;
  tokenExpiresAt?: Date;
  teamName: string;
  userName: string;
  lastTokenRefresh?: Date;
  tokenRefreshCount: number;
  createdAt: Date;
  updatedAt: Date;
}

const UserSchema = new Schema<IUser>({
  slackUserId: { type: String, required: true, unique: true },
  slackTeamId: { type: String, required: true },
  accessToken: { type: String, required: true },
  botToken: { type: String },
  refreshToken: { type: String },
  tokenExpiresAt: { type: Date },
  teamName: { type: String, required: true },
  userName: { type: String, required: true },
  lastTokenRefresh: { type: Date },
  tokenRefreshCount: { type: Number, default: 0 },
}, { timestamps: true });

export const User = mongoose.model<IUser>('User', UserSchema);
