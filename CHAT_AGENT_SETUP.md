# Chat Agent Setup Guide

## Overview
The Chat Agent feature provides an AI-powered chat interface using Perplexity's API. Users can ask questions about their business, FAQ content, and brand strategy.

## Features
- ✅ Real-time chat interface
- ✅ Perplexity AI integration
- ✅ User authentication
- ✅ Conversation history storage
- ✅ Context-aware responses (uses user's brand/product info)
- ✅ Quick start questions
- ✅ Modern UI with loading states

## Setup Instructions

### 1. Environment Variables
Add the following to your `.env.local` file:
```bash
PERPLEXITY_API_KEY=your_perplexity_api_key_here
```

### 2. Database Setup
Run the SQL script to create the chat_messages table:
```sql
-- Execute: create_chat_messages_table.sql
```

### 3. Perplexity API Key
1. Go to [Perplexity AI](https://www.perplexity.ai/)
2. Sign up/login to your account
3. Navigate to API settings
4. Generate an API key
5. Add it to your environment variables

## Files Created

### Frontend
- `src/app/chat-agent/page.tsx` - Main chat interface
- `src/app/layout.tsx` - Updated navigation (added Chat Agent link)

### Backend
- `src/app/api/chat-agent/route.ts` - API endpoint for chat requests
- `create_chat_messages_table.sql` - Database table for conversation history

## Usage

### For Users
1. Navigate to **FAQs → AI Chat Agent** in the navigation
2. Type your question in the chat interface
3. Press Enter or click Send
4. Get AI-powered responses about your business

### Quick Start Questions
The interface includes pre-built questions:
- "Help me create FAQ content for my SaaS product"
- "What are the best practices for brand positioning?"
- "How can I improve my customer support with FAQs?"
- "Suggest topics for my retail business FAQ"
- "What AI tools should I use for content creation?"
- "How do I optimize my FAQ for SEO?"

## Technical Details

### API Endpoint
- **URL**: `/api/chat-agent`
- **Method**: POST
- **Authentication**: Required (Supabase auth)
- **Body**: `{ message, agentId, userId }`

### Database Schema
```sql
chat_messages (
  id: uuid (primary key)
  user_id: uuid (foreign key to auth.users)
  message: text (user message)
  response: text (AI response)
  agent_id: text (Perplexity agent ID)
  created_at: timestamp
  updated_at: timestamp
)
```

### Security
- Row Level Security (RLS) enabled
- Users can only access their own chat messages
- Authentication required for all operations

## Customization

### Change AI Model
In `src/app/api/chat-agent/route.ts`, modify the model parameter:
```typescript
model: 'llama-3.1-sonar-small-128k-online' // Current model
// Other options: 'llama-3.1-sonar-large-128k-online', 'mixtral-8x7b-instruct', etc.
```

### Add More Context
The system automatically includes user's brand/product context. To add more:
1. Modify the `userContext` query in the API route
2. Update the `contextPrompt` construction

### Customize Quick Questions
Edit the questions array in `src/app/chat-agent/page.tsx`:
```typescript
[
  "Your custom question here",
  "Another custom question",
  // ... more questions
]
```

## Troubleshooting

### Common Issues

1. **"Unauthorized" Error**
   - Check if user is logged in
   - Verify Supabase authentication is working

2. **"Perplexity API error"**
   - Verify PERPLEXITY_API_KEY is set correctly
   - Check if the API key has sufficient credits
   - Ensure the API key is valid

3. **Database Errors**
   - Run the `create_chat_messages_table.sql` script
   - Check Supabase connection
   - Verify RLS policies are set correctly

### Debug Mode
Add console logs in the API route for debugging:
```typescript
console.log('User context:', userContext);
console.log('Perplexity response:', perplexityData);
```

## Future Enhancements

### Planned Features
- [ ] Chat history persistence across sessions
- [ ] File upload capability
- [ ] Multiple AI provider support
- [ ] Conversation export
- [ ] Chat analytics and insights
- [ ] Custom agent configurations

### Integration Opportunities
- Connect with existing FAQ generation
- Link to brand analysis features
- Integrate with performance monitoring
- Add to user onboarding flow

## Support
For issues or questions about the Chat Agent feature, check:
1. Browser console for frontend errors
2. Server logs for API errors
3. Supabase dashboard for database issues
4. Perplexity API documentation for AI-related issues 