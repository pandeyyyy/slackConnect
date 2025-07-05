# SlackConnect 
##Installation

A full-stack application to send and schedule messages to Slack channels.

## Installation and Setup

### Prerequisites

Make sure you have Node.js, MongoDB, and ngrok installed on your system.

### Clone and Install

Clone the repository
git clone https://github.com/pandeyyyy/slackConnect.git
cd slackConnect

Install backend dependencies
cd backend
npm install

Install frontend dependencies
cd ../frontend
npm install

text

### Setup ngrok

1. Sign up at [ngrok.com](https://ngrok.com) and get your auth token
2. Authenticate: `ngrok config add-authtoken YOUR_AUTH_TOKEN`
3. Start tunnel: `ngrok http 3001`
4. Copy the HTTPS URL (example: `https://abc123.ngrok.io`)

### Create Slack App

1. Go to [api.slack.com/apps](https://api.slack.com/apps)
2. Create new app "SlackConnect" in your workspace
3. In OAuth & Permissions, add redirect URL:
https://your-ngrok-url.ngrok.io/api/auth/slack/callback

text

4. Add these scopes for both Bot Token and User Token:
- `channels:read`
- `chat:write`
- `groups:read`
- `im:read`
- `mpim:read`
- `users:read`

5. Save your Client ID and Client Secret

### Environment Configuration

Create `.env` file in backend folder:

NODE_ENV=development
PORT=3001
MONGODB_URI=mongodb://localhost:27017/slackconnect2025
JWT_SECRET=slackconnect-secret-key-2025
SLACK_CLIENT_ID=your-client-id-here
SLACK_CLIENT_SECRET=your-client-secret-here
SLACK_REDIRECT_URI=https://your-ngrok-url.ngrok.io/api/auth/slack/callback
FRONTEND_URL=http://localhost:3000

text

### Run the Application

Start backend server:
cd backend
npx ts-node src/app.ts

text

Start frontend (in new terminal):
cd frontend
npm start

text

The app will open at `http://localhost:3000`. Click "Connect to Slack" to authenticate and start using the application.

### Test

1. Open `http://localhost:3000` in your browser
2. Click "Connect to Slack" button
3. Allow permissions on Slack
4. You can now send and schedule messages to your Slack channels

## Important Notes

- Update your ngrok URL in both `.env` file and Slack app settings each time you restart ngrok
- Make sure MongoDB is running before starting the backend
- Never commit your `.env` file to version control
