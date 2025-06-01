import React, { useState } from 'react';
import Chatbot from '../pages/Chatbot';
import { motion, AnimatePresence } from 'framer-motion';

function ChatbotWrapper() {
  const [visible, setVisible] = useState(false);

  return (
    <>
      {!visible && (
        <button
          onClick={() => setVisible(true)}
          style={{
            position: 'fixed',
            bottom: '20px',
            right: '20px',
            width: '60px',
            height: '60px',
            borderRadius: '50%',
            backgroundColor: '#6f47c5',
            color: 'white',
            border: 'none',
            boxShadow: '0px 4px 8px rgba(0,0,0,0.2)',
            fontSize: '24px',
            zIndex: 1000
          }}
        >
          💬
        </button>
      )}

      <AnimatePresence>
        {visible && (
          <motion.div
            key="chatbot"
            initial={{ opacity: 0, y: 50 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: 50 }}
            transition={{ duration: 0.3 }}
            style={{ position: 'fixed', bottom: '20px', right: '20px', zIndex: 1001 }}
          >
           <Chatbot onClose={() => setVisible(false)} />
          </motion.div>
        )}
      </AnimatePresence>
    </>
  );
}

export default ChatbotWrapper;
