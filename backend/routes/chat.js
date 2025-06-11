/**
 * Chat Routes
 * Handles all chat-related endpoints
 */
const express = require('express');
const router = express.Router();
const chatController = require('../controllers/chatController');
const { ensureFullAuth } = require('../middleware/authMiddleware');

// Add local body-parser middleware for chat routes
// This is needed because the global body-parser is added after AdminJS setup
router.use(express.json());
router.use(express.urlencoded({ extended: false }));

// Main chat page rendering
router.get('/', ensureFullAuth, (req, res) => {
  res.redirect('/chat');
});

router.get('/chat', ensureFullAuth, async (req, res) => {
  try {
    // If no conversation ID in session, create a new one
    if (!req.session.conversationId) {
      const { v4: uuidv4 } = require('uuid');
      const newConversationId = uuidv4();
      
      // Create a new conversation using the association helper
      const conv = await req.user.createConversation({
        conversation_id: newConversationId,
        chat_history: [],
        started_at: new Date(),
        is_temporary: false
      });
      
      // Store it in session
      req.session.conversationId = newConversationId;
      console.log(`Created bootstrap conversation ${newConversationId} for user ${req.user.id}`);
    }
    
    res.render('chat', {
      title: 'Chat | Bedrock Express AI',
      user: req.user || null
    });
  } catch (error) {
    console.error('Error in chat route:', error);
    res.render('chat', {
      title: 'Chat | Bedrock Express AI',
      user: req.user || null
    });
  }
});

// API routes for chat functionality

// Process a chat message (for streaming flow - doesn't generate response, just sets up for streaming)
router.post('/api/chat/message', ensureFullAuth, chatController.processMessage);

// Stream a chat response (accepts both GET and POST)
router.post('/api/chat/stream', ensureFullAuth, chatController.streamResponse);
router.get('/api/chat/stream', ensureFullAuth, chatController.streamResponse);

// Legacy routes for backward compatibility
router.post('/chat', ensureFullAuth, chatController.processMessage);
router.get('/stream', ensureFullAuth, chatController.streamResponse);

// Get all conversations (chat history)
router.get('/conversation_history', ensureFullAuth, chatController.getConversations);

// Get a specific conversation by ID
router.get('/get_conversation/:conversationId', ensureFullAuth, chatController.getConversation);

// Reset/clear the current conversation
router.post('/reset', ensureFullAuth, chatController.resetConversation);

module.exports = router;
