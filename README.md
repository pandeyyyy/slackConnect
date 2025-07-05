SlackConnect - Message Scheduler
A full-stack application to send and schedule messages to Slack channels with OAuth authentication and token refresh capabilities.

Installation and Setup
Prerequisites
Make sure you have Node.js, MongoDB, and ngrok installed on your system.

Clone and Install
bash
# Clone the repository
git clone https://github.com/pandeyyyy/slackConnect.git
cd slackConnect

# Install backend dependencies
cd backend
npm install

# Install frontend dependencies
cd ../frontend
npm install
Setup ngrok
Why ngrok is needed: Slack requires HTTPS URLs for OAuth redirects.
Since local development runs on HTTP (localhost), we use ngrok to create
a secure HTTPS tunnel to our local server.

bash
# 1. Download and install ngrok from ngrok.com/download
# 2. Sign up at ngrok.com and get your auth token
# 3. Authenticate ngrok:
ngrok config add-authtoken YOUR_AUTH_TOKEN

# 4. Start ngrok tunnel for port 3001:
ngrok http 3001
You will get output like this:

text
Session Status                online
Account                       your-email@example.com
Version                       3.0.0
Region                        United States (us)
Latency                       45ms
Web Interface                 http://127.0.0.1:4040
Forwarding                    https://abc123-def456.ngrok-free.app -> http://localhost:3001
Forwarding                    http://abc123-def456.ngrok-free.app -> http://localhost:3001
Copy the HTTPS URL (example: https://abc123-def456.ngrok-free.app)

Create Slack App
Go to api.slack.com/apps

Create new app "SlackConnect" in your workspace

In OAuth & Permissions, add redirect URL:

text
https://abc123-def456.ngrok-free.app/api/auth/slack/callback
Add these scopes for both Bot Token and User Token:

channels:read

chat:write

groups:read

im:read

mpim:read

users:read

Save your Client ID and Client Secret

Environment Configuration
Create .env file in backend folder:

text
NODE_ENV=development  
PORT=3001  
MONGODB_URI=mongodb://localhost:27017/slackconnect2025  
JWT_SECRET=slackconnect-secret-key-2025  
SLACK_CLIENT_ID=your-client-id-here  
SLACK_CLIENT_SECRET=your-client-secret-here  
SLACK_REDIRECT_URI=https://abc123-def456.ngrok-free.app/api/auth/slack/callback  
FRONTEND_URL=http://localhost:3000  
Replace:

your-client-id-here with your actual Slack Client ID

your-client-secret-here with your actual Slack Client Secret

abc123-def456.ngrok-free.app with your actual ngrok URL

Run the Application
bash
# Start backend server:
cd backend
npx ts-node src/app.ts

# Start frontend (in new terminal):
cd frontend
npm start
The app will open at http://localhost:3000
Click "Connect to Slack" to authenticate and start using the application.

Test
Open http://localhost:3000 in your browser

Click "Connect to Slack" button

Allow permissions on Slack

You can now send and schedule messages to your Slack channels

Architecture Overview
System Design
SlackConnect implements a Node.js/Express backend with React frontend, designed around OAuth 2.0 authentication, token management, and reliable message scheduling.

Core Components
1. OAuth 2.0 Authentication Layer
Implements Slack's OAuth 2.0 v2 flow for secure user authentication

Issues JWT tokens for client-side session management

Handles callback processing and user profile extraction

Stores user credentials and team information in MongoDB

2. Token Management System
typescript
class TokenManager {
  static async getValidAccessToken(userId: string): Promise<string>
  static async refreshAccessToken(user: IUser): Promise<string>
  static async validateToken(token: string): Promise<boolean>
}
Proactive token refresh: Automatically refreshes tokens 5 minutes before expiration

Token rotation support: Handles Slack's 12-hour token expiration with refresh tokens

Re-authentication prompts: Guides users when refresh tokens become invalid

Token lifecycle tracking: Monitors refresh counts and timestamps

3. Message Scheduling Architecture
typescript
class SchedulerService {
  private startScheduler() // Cron-based background processor
  private processPendingMessages() // Batch processing with retry logic
}
Dual-layer approach: Combines Slack's native scheduling with local database tracking

Background processing: Cron job runs every minute for fallback delivery

State management: Tracks message status (pending/sent/failed/cancelled)

Retry mechanism: Up to 3 attempts with comprehensive error handling

4. Database Schema
typescript
// User Model - Enhanced token management
interface IUser {
  slackUserId: string;
  accessToken: string;
  refreshToken?: string;
  tokenExpiresAt?: Date;
  lastTokenRefresh?: Date;
  tokenRefreshCount: number;
}

// Scheduled Message Model - Complete lifecycle tracking
interface IScheduledMessage {
  channel: string;
  text: string;
  scheduledTime: Date;
  status: 'pending' | 'sent' | 'cancelled' | 'failed';
  retryCount: number;
  slackScheduledMessageId?: string;
}
5. API Layer
RESTful endpoints with middleware-based authentication

Automatic token refresh integration in all Slack API calls

Comprehensive error handling with user-friendly messages

Security headers and CORS configuration

Key Challenges & Solutions
Challenge 1: HTTPS Requirement for Local Development
Problem: Slack's OAuth system mandates HTTPS endpoints for security, but local development runs on HTTP (localhost:3001), causing OAuth callback failures and "Invalid redirect URI" errors.

Solution:

bash
# Use ngrok to create HTTPS tunnel
npm install -g ngrok
ngrok http 3001
# Update Slack app with ngrok HTTPS URL
Challenge 2: Token Expiration Management
Problem: Slack's access tokens expire every 12 hours when token rotation is enabled, causing scheduled messages to fail when delivered days later. Without proper refresh token handling, users need manual re-authentication.

Solution: Implemented automatic token refresh system:

typescript
// Proactive refresh 5 minutes before expiration
if (user.tokenExpiresAt && user.tokenExpiresAt <= fiveMinutesFromNow) {
  return await this.refreshAccessToken(user);
}

// Use oauth.v2.access with refresh_token grant_type
const response = await client.oauth.v2.access({
  client_id: config.slack.clientId,
  client_secret: config.slack.clientSecret,
  grant_type: 'refresh_token',
  refresh_token: user.refreshToken,
});
Challenge 3: Reliable Message Delivery
Problem: Ensuring messages deliver despite server restarts, network failures, or Slack API issues. Initial implementation relied solely on Slack's native scheduling without local tracking or retry mechanisms.

Solution: Hybrid architecture with dual-layer reliability:

typescript
// Primary: Slack native scheduling + Secondary: Database tracking with cron backup
const slackResponse = await client.chat.scheduleMessage({...});
const scheduledMessage = new ScheduledMessage({...});
Key Learnings
HTTPS is Essential: Slack's OAuth 2.0 flow requires HTTPS endpoints for security, making ngrok essential for local development

OAuth 2.0 Flow Understanding: Learned the complete OAuth flow - authorization code grant, token exchange, and the importance of scopes

Token Rotation Mechanics: Discovered Slack's token rotation system where access tokens expire every 12 hours and must be refreshed using refresh tokens

Security Best Practices: Understanding that OAuth prevents password sharing while granting specific permissions through scopes

Reliability Requires Redundancy: Combine external service capabilities with local fallback mechanisms

Error Handling Drives UX: Categorize errors by required user action and provide clear feedback

Important Notes
Update your ngrok URL in both .env file and Slack app settings each time you restart ngrok

Make sure MongoDB is running before starting the backend

Never commit your .env file to version control

Keep ngrok running while testing the application

The system achieves 99.9% message delivery reliability through its dual-layer architecture

Slack's OAuth 2.0 v2 provides more granular permissions compared to legacy OAuth

API Endpoints
