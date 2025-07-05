import React, { useState, useEffect } from 'react';
import axios from 'axios';
type AxiosRequestConfig = Parameters<typeof axios.interceptors.request.use>[0] extends (config: infer C) => any ? C : never;



// ===================================
// API SERVICE
// ===================================
const API_BASE_URL = process.env.REACT_APP_API_URL || 'http://localhost:3001/api';

const api = axios.create({
  baseURL: API_BASE_URL,
});

// Add token to requests
api.interceptors.request.use((config: AxiosRequestConfig) => {
  const token = localStorage.getItem('slackConnectToken');
  if (token) {
    // Ensure headers is always an object
    if (!config.headers) config.headers = {};
    // Safely set Authorization header
    (config.headers as Record<string, string>)['Authorization'] = `Bearer ${token}`;
  }
  return config;
});

const authAPI = {
  getSlackAuthUrl: () => api.get<{ authUrl: string }>('/auth/slack'),
  getUserInfo: () => api.get<User>('/auth/user'),
};

const messageAPI = {
  getChannels: () => api.get<{ channels: Channel[] }>('/messages/channels'),
  sendMessage: (data: { channel: string; channelName: string; text: string }) =>
    api.post('/messages/send', data),
  scheduleMessage: (data: { 
    channel: string; 
    channelName: string; 
    text: string; 
    scheduledTime: string 
  }) => api.post('/messages/schedule', data),
  getScheduledMessages: () => api.get<{ messages: ScheduledMessage[] }>('/messages/scheduled'),
  cancelScheduledMessage: (messageId: string) =>
    api.delete(`/messages/scheduled/${messageId}`),
};

// ===================================
// INTERFACES
// ===================================
interface User {
  slackUserId: string;
  teamName: string;
  userName: string;
}

interface Channel {
  id: string;
  name: string;
  is_private: boolean;
}

interface ScheduledMessage {
  _id: string;
  channel: string;
  channelName: string;
  text: string;
  scheduledTime: string;
  status: string;
}

// ===================================
// AUTH COMPONENT
// ===================================
const Auth: React.FC<{ onAuthSuccess: (user: User) => void }> = ({ onAuthSuccess }) => {
  const [isLoading, setIsLoading] = useState(false);

  useEffect(() => {
    // Check for auth callback parameters
    const urlParams = new URLSearchParams(window.location.search);
    const token = urlParams.get('token');
    const userParam = urlParams.get('user');

    if (token && userParam) {
      localStorage.setItem('slackConnectToken', token);
      const user = JSON.parse(decodeURIComponent(userParam)) as User;
      onAuthSuccess(user);
      // Clean up URL
      window.history.replaceState({}, document.title, window.location.pathname);
    }
  }, [onAuthSuccess]);

  const handleSlackAuth = async () => {
    setIsLoading(true);
    try {
      const response = await authAPI.getSlackAuthUrl();
      window.location.href = response.data.authUrl;
    } catch (error) {
      console.error('Auth error:', error);
      alert('Failed to initiate Slack authentication');
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div style={{ textAlign: 'center', padding: '50px' }}>
      <h1>SlackConnect</h1>
      <p>Connect your Slack workspace to send and schedule messages</p>
      <button 
        onClick={handleSlackAuth}
        disabled={isLoading}
        style={{
          padding: '12px 24px',
          fontSize: '16px',
          backgroundColor: '#4A154B',
          color: 'white',
          border: 'none',
          borderRadius: '4px',
          cursor: isLoading ? 'not-allowed' : 'pointer',
        }}
      >
        {isLoading ? 'Connecting...' : 'Connect to Slack'}
      </button>
    </div>
  );
};

// ===================================
// MESSAGE FORM COMPONENT
// ===================================
const MessageForm: React.FC<{ onMessageSent: () => void }> = ({ onMessageSent }) => {
  const [channels, setChannels] = useState<Channel[]>([]);
  const [selectedChannel, setSelectedChannel] = useState('');
  const [message, setMessage] = useState('');
  const [scheduleTime, setScheduleTime] = useState('');
  const [isScheduled, setIsScheduled] = useState(false);
  const [isLoading, setIsLoading] = useState(false);

  useEffect(() => {
    loadChannels();
  }, []);

  const loadChannels = async () => {
    try {
      const response = await messageAPI.getChannels();
      setChannels(response.data.channels);
    } catch (error) {
      console.error('Failed to load channels:', error);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedChannel || !message) return;

    setIsLoading(true);
    try {
      const selectedChannelData = channels.find(c => c.id === selectedChannel);
      const data = {
        channel: selectedChannel,
        channelName: selectedChannelData?.name || '',
        text: message,
      };

      if (isScheduled && scheduleTime) {
        await messageAPI.scheduleMessage({
          ...data,
          scheduledTime: scheduleTime,
        });
        alert('Message scheduled successfully!');
      } else {
        await messageAPI.sendMessage(data);
        alert('Message sent successfully!');
      }

      setMessage('');
      setScheduleTime('');
      onMessageSent();
    } catch (error) {
      console.error('Failed to send message:', error);
      alert('Failed to send message');
    } finally {
      setIsLoading(false);
    }
  };

  const getMinDateTime = () => {
    const now = new Date();
    now.setMinutes(now.getMinutes() + 1);
    return now.toISOString().slice(0, 16);
  };

  return (
    <div style={{ padding: '20px', border: '1px solid #ddd', borderRadius: '8px', marginBottom: '20px' }}>
      <h3>Send Message</h3>
      <form onSubmit={handleSubmit}>
        <div style={{ marginBottom: '15px' }}>
          <label>Channel:</label>
          <select
            value={selectedChannel}
            onChange={(e) => setSelectedChannel(e.target.value)}
            required
            style={{ width: '100%', padding: '8px', marginTop: '5px' }}
          >
            <option value="">Select a channel</option>
            {channels.map(channel => (
              <option key={channel.id} value={channel.id}>
                #{channel.name} {channel.is_private ? '(Private)' : ''}
              </option>
            ))}
          </select>
        </div>

        <div style={{ marginBottom: '15px' }}>
          <label>Message:</label>
          <textarea
            value={message}
            onChange={(e) => setMessage(e.target.value)}
            required
            rows={4}
            style={{ width: '100%', padding: '8px', marginTop: '5px' }}
            placeholder="Enter your message here..."
          />
        </div>

        <div style={{ marginBottom: '15px' }}>
          <label>
            <input
              type="checkbox"
              checked={isScheduled}
              onChange={(e) => setIsScheduled(e.target.checked)}
            />
            Schedule for later
          </label>
        </div>

        {isScheduled && (
          <div style={{ marginBottom: '15px' }}>
            <label>Schedule Time:</label>
            <input
              type="datetime-local"
              value={scheduleTime}
              onChange={(e) => setScheduleTime(e.target.value)}
              min={getMinDateTime()}
              required={isScheduled}
              style={{ width: '100%', padding: '8px', marginTop: '5px' }}
            />
          </div>
        )}

        <button
          type="submit"
          disabled={isLoading}
          style={{
            padding: '10px 20px',
            backgroundColor: '#4A154B',
            color: 'white',
            border: 'none',
            borderRadius: '4px',
            cursor: isLoading ? 'not-allowed' : 'pointer',
          }}
        >
          {isLoading ? 'Sending...' : (isScheduled ? 'Schedule Message' : 'Send Now')}
        </button>
      </form>
    </div>
  );
};

// ===================================
// SCHEDULED MESSAGES COMPONENT
// ===================================
const ScheduledMessages: React.FC<{ refreshTrigger: number }> = ({ refreshTrigger }) => {
  const [messages, setMessages] = useState<ScheduledMessage[]>([]);
  const [isLoading, setIsLoading] = useState(false);

  useEffect(() => {
    loadScheduledMessages();
  }, [refreshTrigger]);

  const loadScheduledMessages = async () => {
    setIsLoading(true);
    try {
      const response = await messageAPI.getScheduledMessages();
      setMessages(response.data.messages);
    } catch (error) {
      console.error('Failed to load scheduled messages:', error);
    } finally {
      setIsLoading(false);
    }
  };

  const handleCancel = async (messageId: string) => {
    if (!window.confirm('Are you sure you want to cancel this scheduled message?')) {
      return;
    }

    try {
      await messageAPI.cancelScheduledMessage(messageId);
      alert('Message cancelled successfully!');
      loadScheduledMessages();
    } catch (error) {
      console.error('Failed to cancel message:', error);
      alert('Failed to cancel message');
    }
  };

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleString();
  };

  const isPending = (message: ScheduledMessage) => {
    return message.status === 'pending' && new Date(message.scheduledTime) > new Date();
  };

  if (isLoading) {
    return <div>Loading scheduled messages...</div>;
  }

  return (
    <div style={{ padding: '20px', border: '1px solid #ddd', borderRadius: '8px' }}>
      <h3>Scheduled Messages</h3>
      {messages.length === 0 ? (
        <p>No scheduled messages found.</p>
      ) : (
        <div>
          {messages.map(message => (
            <div
              key={message._id}
              style={{
                padding: '15px',
                border: '1px solid #eee',
                borderRadius: '4px',
                marginBottom: '10px',
                backgroundColor: message.status === 'sent' ? '#f0f8f0' : 
                                message.status === 'cancelled' ? '#f8f0f0' : '#fff',
              }}
            >
              <div style={{ marginBottom: '10px' }}>
                <strong>Channel:</strong> #{message.channelName}
              </div>
              <div style={{ marginBottom: '10px' }}>
                <strong>Message:</strong> {message.text}
              </div>
              <div style={{ marginBottom: '10px' }}>
                <strong>Scheduled for:</strong> {formatDate(message.scheduledTime)}
              </div>
              <div style={{ marginBottom: '10px' }}>
                <strong>Status:</strong> 
                <span style={{
                  padding: '2px 8px',
                  borderRadius: '12px',
                  fontSize: '12px',
                  marginLeft: '8px',
                  backgroundColor: 
                    message.status === 'sent' ? '#d4edda' :
                    message.status === 'pending' ? '#fff3cd' :
                    message.status === 'cancelled' ? '#f8d7da' : '#e2e3e5',
                  color:
                    message.status === 'sent' ? '#155724' :
                    message.status === 'pending' ? '#856404' :
                    message.status === 'cancelled' ? '#721c24' : '#6c757d',
                }}>
                  {message.status.toUpperCase()}
                </span>
              </div>
              {isPending(message) && (
                <button
                  onClick={() => handleCancel(message._id)}
                  style={{
                    padding: '5px 10px',
                    backgroundColor: '#dc3545',
                    color: 'white',
                    border: 'none',
                    borderRadius: '4px',
                    cursor: 'pointer',
                    fontSize: '12px',
                  }}
                >
                  Cancel
                </button>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
};

// ===================================
// MAIN APP COMPONENT
// ===================================
const App: React.FC = () => {
  const [user, setUser] = useState<User | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [refreshTrigger, setRefreshTrigger] = useState(0);

  useEffect(() => {
    checkAuthStatus();
    // eslint-disable-next-line
  }, []);

  const checkAuthStatus = async () => {
    const token = localStorage.getItem('slackConnectToken');
    if (token) {
      try {
        const response = await authAPI.getUserInfo();
        setUser(response.data);
      } catch (error) {
        console.error('Auth check failed:', error);
        localStorage.removeItem('slackConnectToken');
      }
    }
    setIsLoading(false);
  };

  const handleAuthSuccess = (userData: User) => {
    setUser(userData);
  };

  const handleLogout = () => {
    localStorage.removeItem('slackConnectToken');
    setUser(null);
  };

  const handleMessageSent = () => {
    setRefreshTrigger(prev => prev + 1);
  };

  if (isLoading) {
    return (
      <div style={{ textAlign: 'center', padding: '50px' }}>
        <div>Loading...</div>
      </div>
    );
  }

  if (!user) {
    return <Auth onAuthSuccess={handleAuthSuccess} />;
  }

  return (
    <div style={{ maxWidth: '800px', margin: '0 auto', padding: '20px' }}>
      <header style={{ 
        display: 'flex', 
        justifyContent: 'space-between', 
        alignItems: 'center',
        marginBottom: '30px',
        padding: '20px',
        backgroundColor: '#f8f9fa',
        borderRadius: '8px'
      }}>
        <div>
          <h1 style={{ margin: 0 }}>SlackConnect</h1>
          <p style={{ margin: '5px 0 0 0', color: '#666' }}>
            Connected to <strong>{user.teamName}</strong> as <strong>{user.userName}</strong>
          </p>
        </div>
        <button
          onClick={handleLogout}
          style={{
            padding: '8px 16px',
            backgroundColor: '#6c757d',
            color: 'white',
            border: 'none',
            borderRadius: '4px',
            cursor: 'pointer',
          }}
        >
          Disconnect
        </button>
      </header>

      <MessageForm onMessageSent={handleMessageSent} />
      <ScheduledMessages refreshTrigger={refreshTrigger} />
    </div>
  );
};

export default App;
