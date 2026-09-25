import React, { useState } from 'react';
import ReactMarkdown from 'react-markdown';
import api from '../services/api';

export default function Chat() {
  const [messages, setMessages] = useState([]);
  const [input, setInput] = useState('');
  const [loading, setLoading] = useState(false);

  const sendMessage = async (e) => {
    e.preventDefault();
    if (!input.trim()) return;

    const userMessage = { role: 'user', content: input };
    setMessages((prev) => [...prev, userMessage]);
    setInput('');
    setLoading(true);

    try {
      const response = await api.post('/api/chat', { message: input });
      const botMessage = { role: 'assistant', content: response.data.response };
      setMessages((prev) => [...prev, botMessage]);
    } catch (error) {
      console.error('Erro ao comunicar com o backend:', error);
      const errorMessage = { role: 'system', content: 'Erro: Não foi possível ligar ao servidor backend.' };
      setMessages((prev) => [...prev, errorMessage]);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div style={{ maxWidth: '600px', margin: '40px auto', fontFamily: 'Arial, sans-serif' }}>
      <h2>SpeakFlow Chat</h2>
      
      <div style={{ 
        border: '1px solid #ccc', 
        borderRadius: '8px', 
        height: '400px', 
        overflowY: 'scroll', 
        padding: '16px', 
        marginBottom: '16px',
        backgroundColor: '#f9f9f9'
      }}>
        {messages.map((msg, index) => (
          <div key={index} style={{ marginBottom: '12px', textAlign: msg.role === 'user' ? 'right' : 'left' }}>
            <div style={{ 
              display: 'inline-block', 
              padding: '12px 16px', 
              borderRadius: '8px', 
              backgroundColor: msg.role === 'user' ? '#007bff' : '#e4e6eb',
              color: msg.role === 'user' ? '#fff' : '#000',
              textAlign: 'left',
              maxWidth: '85%',
              wordWrap: 'break-word' // Ajuda a não quebrar a tela com palavras longas
            }}>
              
              {/* É AQUI QUE A MÁGICA ACONTECE */}
              <ReactMarkdown>{msg.content}</ReactMarkdown>
              
            </div>
          </div>
        ))}
        {loading && <p style={{ color: '#666', fontStyle: 'italic' }}>A pensar...</p>}
      </div>

      <form onSubmit={sendMessage} style={{ display: 'flex', gap: '8px' }}>
        <input 
          type="text" 
          value={input} 
          onChange={(e) => setInput(e.target.value)} 
          placeholder="Escreva a sua mensagem..." 
          style={{ flex: 1, padding: '10px', borderRadius: '4px', border: '1px solid #ccc' }}
        />
        <button type="submit" style={{ padding: '10px 20px', borderRadius: '4px', backgroundColor: '#007bff', color: '#fff', border: 'none', cursor: 'pointer' }}>
          Enviar
        </button>
      </form>
    </div>
  );
}