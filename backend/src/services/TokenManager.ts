import { WebClient } from '@slack/web-api';
import { User, IUser } from '../models/User';
import * as dotenv from 'dotenv';

dotenv.config();

const config = {
  slack: {
    clientId: process.env.SLACK_CLIENT_ID!,
    clientSecret: process.env.SLACK_CLIENT_SECRET!,
  },
};

export class TokenManager {
  static async refreshAccessToken(user: IUser): Promise<string> {
    if (!user.refreshToken) {
      console.error(`❌ No refresh token available for user ${user.slackUserId}`);
      throw new Error('No refresh token available');
    }

    console.log(`🔄 Refreshing token for user ${user.slackUserId}`);
    
    const client = new WebClient();
    
    try {
      const response = await client.oauth.v2.access({
        client_id: config.slack.clientId,
        client_secret: config.slack.clientSecret,
        grant_type: 'refresh_token',
        refresh_token: user.refreshToken,
      });

      if (!response.ok) {
        console.error('❌ Token refresh failed - response not ok:', response.error);
        throw new Error(`Token refresh failed: ${response.error}`);
      }

      const newAccessToken = response.authed_user?.access_token;
      const newRefreshToken = response.authed_user?.refresh_token;
      const expiresIn = response.authed_user?.expires_in;

      if (!newAccessToken) {
        console.error('❌ No access token in refresh response');
        throw new Error('No access token received in refresh response');
      }

      user.accessToken = newAccessToken;
      
      if (newRefreshToken) {
        user.refreshToken = newRefreshToken;
        console.log('🔄 New refresh token received');
      }
      
      if (expiresIn) {
        user.tokenExpiresAt = new Date(Date.now() + expiresIn * 1000);
        console.log(`⏰ Token expires at: ${user.tokenExpiresAt}`);
      }

      user.lastTokenRefresh = new Date();
      user.tokenRefreshCount = (user.tokenRefreshCount || 0) + 1;

      await user.save();
      
      console.log(`✅ Token refreshed successfully for user ${user.slackUserId} (refresh count: ${user.tokenRefreshCount})`);
      return newAccessToken;

    } catch (error: any) {
      console.error(`❌ Token refresh failed for user ${user.slackUserId}:`, error);
      
      if (error.data?.error === 'invalid_refresh_token') {
        console.log('🚨 Refresh token is invalid - user needs to re-authenticate');
        user.refreshToken = undefined;
        user.tokenExpiresAt = new Date();
        await user.save();
      }
      
      throw new Error(`Token refresh failed: ${error.message}`);
    }
  }

  static async getValidAccessToken(userId: string): Promise<string> {
    const user = await User.findOne({ slackUserId: userId });
    if (!user) {
      console.error(`❌ User not found: ${userId}`);
      throw new Error('User not found');
    }

    const now = new Date();
    const fiveMinutesFromNow = new Date(now.getTime() + 5 * 60 * 1000);

    if (user.tokenExpiresAt && user.tokenExpiresAt <= fiveMinutesFromNow) {
      console.log(`⚠️ Token for user ${userId} expires soon (${user.tokenExpiresAt}), refreshing...`);
      
      try {
        return await this.refreshAccessToken(user);
      } catch (refreshError) {
        console.error(`❌ Failed to refresh token for user ${userId}:`, refreshError);
        throw new Error('Token refresh failed - user may need to re-authenticate');
      }
    }

    console.log(`✅ Using existing valid token for user ${userId}`);
    return user.accessToken;
  }

  static async needsReAuthentication(userId: string): Promise<boolean> {
    const user = await User.findOne({ slackUserId: userId });
    if (!user) return true;

    if (!user.refreshToken && user.tokenExpiresAt && user.tokenExpiresAt <= new Date()) {
      return true;
    }

    return false;
  }

  static async getBotToken(userId: string): Promise<string> {
    const user = await User.findOne({ slackUserId: userId });
    if (!user) {
      throw new Error('User not found');
    }

    return user.botToken || user.accessToken;
  }

  static async validateToken(token: string): Promise<boolean> {
    try {
      const client = new WebClient(token);
      const response = await client.auth.test();
      return response.ok === true;
    } catch (error) {
      console.error('Token validation failed:', error);
      return false;
    }
  }
}
