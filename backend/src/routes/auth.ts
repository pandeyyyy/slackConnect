import express from 'express';
import { WebClient } from '@slack/web-api';
import jwt from 'jsonwebtoken';
import { User } from '../models/User';
import { authenticateToken, AuthRequest } from '../middleware/auth';
import * as dotenv from 'dotenv';

dotenv.config();

const router = express.Router();

const config = {
  slack: {
    clientId: process.env.SLACK_CLIENT_ID!,
    clientSecret: process.env.SLACK_CLIENT_SECRET!,
    redirectUri: process.env.SLACK_REDIRECT_URI!,
  },
  frontendUrl: process.env.FRONTEND_URL || 'http://localhost:3000',
  jwtSecret: process.env.JWT_SECRET || 'fallback-secret',
};

router.get('/slack', (req, res) => {
  const scopes = [
    'channels:read',
    'chat:write',
    'users:read',
    'groups:read',
    'im:read',
    'mpim:read'
  ].join(',');

  const authUrl = `https://slack.com/oauth/v2/authorize?client_id=${config.slack.clientId}&scope=${scopes}&redirect_uri=${encodeURIComponent(config.slack.redirectUri)}&user_scope=${scopes}`;
  
  res.json({ authUrl });
});

router.get('/slack/callback', async (req, res) => {
  const { code } = req.query;

  if (!code) {
    return res.status(400).json({ error: 'Authorization code required' });
  }

  try {
    const client = new WebClient();

    const oauthResponse = await client.oauth.v2.access({
      client_id: config.slack.clientId,
      client_secret: config.slack.clientSecret,
      code: code as string,
      redirect_uri: config.slack.redirectUri,
    });

    if (!oauthResponse.ok) {
      throw new Error('Failed to exchange code for tokens');
    }

    const userToken = oauthResponse.authed_user?.access_token;
    const botToken = oauthResponse.access_token;
    const refreshToken = oauthResponse.authed_user?.refresh_token;
    const expiresIn = oauthResponse.authed_user?.expires_in;

    const activeToken = userToken || botToken;
    if (!activeToken) {
      throw new Error('No access token received');
    }

    const tokenClient = new WebClient(activeToken);
    const authTest = await tokenClient.auth.test();
    
    const slackUserId = authTest.user_id as string;
    const slackTeamId = authTest.team_id as string;
    const teamName = authTest.team as string;

    let userName = '';
    try {
      const userInfo = await tokenClient.users.info({ user: slackUserId });
      userName = userInfo.user?.profile?.display_name || 
                 userInfo.user?.profile?.real_name || 
                 userInfo.user?.name || 
                 'Unknown User';
    } catch (e) {
      console.warn('Could not fetch user profile:', e);
      userName = 'Unknown User';
    }

    let user = await User.findOne({ slackUserId });

    if (user) {
      user.accessToken = activeToken;
      user.botToken = botToken;
      user.refreshToken = refreshToken;
      user.tokenExpiresAt = expiresIn 
        ? new Date(Date.now() + expiresIn * 1000)
        : undefined;
      user.teamName = teamName;
      user.userName = userName;
      user.tokenRefreshCount = 0;
    } else {
      user = new User({
        slackUserId,
        slackTeamId,
        accessToken: activeToken,
        botToken: botToken,
        refreshToken: refreshToken,
        tokenExpiresAt: expiresIn 
          ? new Date(Date.now() + expiresIn * 1000)
          : undefined,
        teamName,
        userName,
        tokenRefreshCount: 0,
      });
    }

    await user.save();

    console.log(`✅ User authenticated: ${userName} (${slackUserId})`);
    console.log(`🔑 Token expires: ${user.tokenExpiresAt}`);
    console.log(`🔄 Has refresh token: ${!!refreshToken}`);

    const jwtToken = jwt.sign(
      { slackUserId, teamName, userName },
      config.jwtSecret,
      { expiresIn: '7d' }
    );

    res.redirect(`${config.frontendUrl}?token=${jwtToken}&user=${encodeURIComponent(JSON.stringify({ slackUserId, teamName, userName }))}`);

  } catch (error) {
    console.error('❌ OAuth callback error:', error);
    res.status(500).json({ error: 'Authentication failed' });
  }
});

router.get('/user', authenticateToken, (req: AuthRequest, res) => {
  res.json({
    slackUserId: req.user.slackUserId,
    teamName: req.user.teamName,
    userName: req.user.userName,
    tokenExpiresAt: req.user.tokenExpiresAt,
    lastTokenRefresh: req.user.lastTokenRefresh,
    tokenRefreshCount: req.user.tokenRefreshCount,
  });
});

router.get('/token-status', authenticateToken, async (req: AuthRequest, res) => {
  try {
    const user = req.user;
    const now = new Date();
    
    res.json({
      slackUserId: user.slackUserId,
      hasRefreshToken: !!user.refreshToken,
      tokenExpiresAt: user.tokenExpiresAt,
      isExpired: user.tokenExpiresAt ? user.tokenExpiresAt <= now : false,
      expiresInMinutes: user.tokenExpiresAt ? Math.floor((user.tokenExpiresAt.getTime() - now.getTime()) / (1000 * 60)) : null,
      lastTokenRefresh: user.lastTokenRefresh,
      tokenRefreshCount: user.tokenRefreshCount,
    });
  } catch (error) {
    console.error('❌ Token status error:', error);
    res.status(500).json({ error: 'Failed to get token status' });
  }
});

export default router;
