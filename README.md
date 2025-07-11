# SlackConnect - Message Scheduler

A full-stack application to send and schedule messages to Slack channels with OAuth 2.0 authentication and token refresh capabilities.

## Detailed Setup Instructions

### Prerequisites
- Node.js (v14+)
- MongoDB
- ngrok

### Clone and Install
# Clone repository
git clone https://github.com/pandeyyyy/slackConnect.git
cd slackConnect

# Install backend dependencies
cd backend && npm install

# Install frontend dependencies
cd ../frontend && npm install

### Configure ngrok (Required for OAuth)
# Install ngrok
npm install -g ngrok

# Authenticate with your token
ngrok config add-authtoken YOUR_AUTH_TOKEN

# Start tunnel
ngrok http 3001

Why ngrok? Slack requires HTTPS for OAuth redirects. Local development uses HTTP, so ngrok creates a secure tunnel.

You will get output like this:
Session Status online
Account your-email@example.com
Version 3.0.0
Region United States (us)
Latency 45ms
Web Interface http://127.0.0.1:4040
Forwarding https://abc123-def456.ngrok-free.app -> http://localhost:3001

Copy the HTTPS URL: https://abc123-def456.ngrok-free.app

### Create Slack App
1. Go to api.slack.com/apps
2. Create new app "SlackConnect" in your workspace
3. In OAuth & Permissions, add redirect URL:
https://abc123-def456.ngrok-free.app/api/auth/slack/callback
4. Add these scopes for both Bot Token and User Token:
- channels:read
- chat:write
- groups:read
- im:read
- mpim:read
- users:read
5. Save your Client ID and Client Secret

### Environment Configuration
Create .env file in backend folder:
- NODE_ENV=development
- PORT=3001
- MONGODB_URI=mongodb://localhost:27017/slackconnect2025
- JWT_SECRET=slackconnect-secret-key-2025
- SLACK_CLIENT_ID=your-client-id-here
- SLACK_CLIENT_SECRET=your-client-secret-here
- SLACK_REDIRECT_URI=https://abc123-def456.ngrok-free.app/api/auth/slack/callback
- FRONTEND_URL=http://localhost:3000

Replace:
- your-client-id-here with your actual Slack Client ID
- your-client-secret-here with your actual Slack Client Secret
- abc123-def456.ngrok-free.app with your actual ngrok URL

### Run Both Frontend and Backend
# Start backend server
cd backend
npx ts-node src/app.ts

# Start frontend (in new terminal)
cd frontend
npm start

The app will open at http://localhost:3000
Click "Connect to Slack" to authenticate and start using the application.

### Test Setup
1. Open http://localhost:3000 in your browser
2. Click "Connect to Slack" button
3. Allow permissions on Slack
4. You can now send and schedule messages to your Slack channels

## Architectural Overview

### System Design
SlackConnect implements a Node.js/Express backend with React frontend, designed around OAuth 2.0 authentication, token management, and reliable message scheduling.

### OAuth Implementation
#### Flow Design
- Implements Slack's OAuth 2.0 v2 flow for secure user authentication
- Issues JWT tokens for client-side session management
- Handles callback processing and user profile extraction
- Stores user credentials and team information in MongoDB

#### OAuth Process
1. User clicks "Connect to Slack"
2. Redirects to Slack OAuth authorization
3. User grants permissions
4. Slack redirects back with authorization code
5. Backend exchanges code for access/refresh tokens
6. JWT token issued for frontend session

### Token Management
#### TokenManager Class
class TokenManager {
static async getValidAccessToken(userId: string): Promise<string>
static async refreshAccessToken(user: IUser): Promise<string>
static async validateToken(token: string): Promise<boolean>
}

#### Key Features
- Proactive token refresh: Automatically refreshes tokens 5 minutes before expiration
- Token rotation support: Handles Slack's 12-hour token expiration with refresh tokens
- Re-authentication prompts: Guides users when refresh tokens become invalid
- Token lifecycle tracking: Monitors refresh counts and timestamps

#### Database Schema for Tokens
interface IUser {
slackUserId: string;
accessToken: string;
refreshToken?: string;
tokenExpiresAt?: Date;
lastTokenRefresh?: Date;
tokenRefreshCount: number;
}

### Scheduled Task Handling
#### SchedulerService Architecture
class SchedulerService {
private startScheduler() // Cron-based background processor
private processPendingMessages() // Batch processing with retry logic
}

#### Dual-Layer Scheduling
##### Primary Layer: Slack Native
- Uses Slack's chat.scheduleMessage API
- Leverages Slack's built-in reliability
- Returns scheduled_message_id for tracking

##### Secondary Layer: Database Backup
- Stores all scheduled messages locally
- Cron job runs every minute
- Processes failed/missed messages
- Retry mechanism with exponential backoff

#### Message State Management
interface IScheduledMessage {
channel: string;
text: string;
scheduledTime: Date;
status: 'pending' | 'sent' | 'cancelled' | 'failed';
retryCount: number;
slackScheduledMessageId?: string;
}

#### Background Processing
- Cron job: * * * * * (every minute)
- Batch processing: 50 messages per cycle
- Retry logic: Up to 3 attempts
- Error categorization: Auth vs API vs Network errors

## Challenges & Learnings

### Challenge 1: HTTPS Requirement for Local Development

#### Problem
Slack's OAuth system mandates HTTPS endpoints for security, but local development runs on HTTP (localhost:3001), causing OAuth callback failures and "Invalid redirect URI" errors.

#### Root Cause
- Slack enforces HTTPS for all OAuth redirect URIs to prevent man-in-the-middle attacks
- Local development environments typically use HTTP for simplicity
- Direct HTTP-to-HTTPS conversion isn't possible without SSL certificates

#### Solution
### Use ngrok to create HTTPS tunnel
npm install -g ngrok
ngrok http 3001
### Update Slack app with ngrok HTTPS URL

#### Learning
Always set up HTTPS tunneling early when working with OAuth providers. Ngrok became essential for development workflow, requiring team documentation and setup automation.

### Challenge 2: Token Expiration Management

#### Problem
Slack's access tokens expire every 12 hours when token rotation is enabled, causing scheduled messages to fail when delivered days later. Without proper refresh token handling, users need manual re-authentication.

#### Root Cause Analysis
- Slack's security model requires token expiration to limit exposure
- Scheduled messages might be sent days after token creation
- No mechanism existed to refresh expired tokens automatically
- Users would need to re-authenticate manually for each expired token

#### Solution
Implemented automatic token refresh system:
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

#### Learning
Discovered Slack's token rotation system where access tokens expire every 12 hours and must be refreshed using refresh tokens. Understanding OAuth 2.0 flow - authorization code grant, token exchange, and the importance of scopes became crucial.


### Key Technical Learnings

#### OAuth 2.0 Deep Dive
- Authorization code flow prevents password sharing
- Scopes provide granular permission control
- Refresh tokens enable long-term access without user interaction
- HTTPS is mandatory for security in production OAuth flows

#### Token Lifecycle Management
- Proactive refresh prevents service interruptions
- Token validation through test API calls
- Graceful degradation when refresh fails
- User re-authentication prompts for expired refresh tokens

#### Distributed System Reliability
- External service dependencies require local fallbacks
- State management across service restarts
- Retry mechanisms with exponential backoff
- Comprehensive error categorization and handling

#### Security Best Practices
- Environment variable management for secrets
- JWT token expiration and rotation
- CORS configuration for cross-origin requests
- Input validation and sanitization


Attaching pictures of how it looks like
![Screenshot (488)](https://github.com/user-attachments/assets/6711477f-2c1a-42cd-b5ff-539887f40272)
![Screenshot (489)](https://github.com/user-attachments/assets/2c14f059-906c-4d75-af1b-3f2b1d8ca16a)
![Screenshot (490)](https://github.com/user-attachments/assets/e73c6e0e-2790-47cb-879a-0fdc54394de4)
![Screenshot (491)](https://github.com/user-attachments/assets/5d5e080d-d83a-46a0-b0ba-ee165dfcfd73)
![Screenshot (492)](https://github.com/user-attachments/assets/540f5018-a979-42e2-9b4a-e93b151f5071)



received all the messages - instant and scheduled both
![image](https://github.com/user-attachments/assets/8097b2ef-7ca0-4684-b780-118fddabddc7)




