// ============================================
// SpeakFlow - Free Conversation Mode (chat.js)
// ============================================

// Estado do chat
const chatState = {
    isActive: false,
    isRecording: false,
    isAiSpeaking: false,
    isAiThinking: false,
    isLoadingSuggestions: false,
    chatHistory: [],       // {role, content} para enviar à IA
    messages: [],          // {who, text, translation, feedback} para exibir
    persona: 'friendly',
    recognition: null,
    mediaRecorder: null,
    audioChunks: [],
    audioStream: null,
    currentTranscript: '',
    messageCount: 0,
    lastAiMessage: '',
    suggestionsVisible: false,
    useWhisper: true        // Usar Groq Whisper para transcrição (mais preciso)
};

// Personas disponíveis
const personaConfigs = {
    friendly: {
        name: 'Alex (Amigo)',
        avatar: 'A',
        system: `You are Alex, a friendly and casual English-speaking friend. You're chatty, warm, and love helping your friend practice English. Keep the conversation natural and fun. Use casual language, slang when appropriate, and be encouraging. If they make mistakes, gently correct them in a natural way.`
    },
    teacher: {
        name: 'Ms. Sarah (Professora)',
        avatar: 'S',
        system: `You are Ms. Sarah, a patient and experienced English teacher. You focus on helping the student improve their English. You correct grammar and pronunciation naturally within the conversation. You sometimes introduce new vocabulary and explain it. You're encouraging but thorough in corrections.`
    },
    interviewer: {
        name: 'Mr. Johnson (Entrevistador)',
        avatar: 'J',
        system: `You are Mr. Johnson, a professional job interviewer. You conduct realistic job interviews in English. Ask professional questions, follow up on answers, and occasionally give tips about interview skills. Be professional but friendly.`
    },
    tourist: {
        name: 'Emma (Turista)',
        avatar: 'E',
        system: `You are Emma, a tourist visiting Brazil. You only speak English and need help with various situations - directions, recommendations, ordering food, etc. You're curious about Brazilian culture and love chatting about your travels.`
    },
    coworker: {
        name: 'David (Colega)',
        avatar: 'D',
        system: `You are David, an English-speaking coworker. You talk about work projects, meetings, office situations, and casual workplace chat. Use professional but friendly English, including common business expressions and idioms.`
    }
};

// ============================================
// GROQ WHISPER TRANSCRIPTION (Alta precisão)
// ============================================

// Inicia gravação de áudio via MediaRecorder
async function startWhisperRecording() {
    try {
        const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
        chatState.audioStream = stream;
        chatState.audioChunks = [];

        const mediaRecorder = new MediaRecorder(stream, {
            mimeType: MediaRecorder.isTypeSupported('audio/webm;codecs=opus') 
                ? 'audio/webm;codecs=opus' 
                : 'audio/webm'
        });

        mediaRecorder.ondataavailable = (event) => {
            if (event.data.size > 0) {
                chatState.audioChunks.push(event.data);
            }
        };

        mediaRecorder.onstop = async () => {
            // Para o stream do microfone
            if (chatState.audioStream) {
                chatState.audioStream.getTracks().forEach(t => t.stop());
                chatState.audioStream = null;
            }

            if (chatState.audioChunks.length === 0) {
                updateSpeechStatus('Nenhum áudio capturado.', 'warning');
                return;
            }

            const audioBlob = new Blob(chatState.audioChunks, { type: 'audio/webm' });
            chatState.audioChunks = [];

            // Verifica tamanho mínimo (evita enviar silêncio)
            if (audioBlob.size < 1000) {
                updateSpeechStatus('Gravação muito curta. Tente novamente.', 'warning');
                return;
            }

            updateSpeechStatus('Transcrevendo com Whisper...', 'thinking');
            await transcribeWithWhisper(audioBlob);
        };

        chatState.mediaRecorder = mediaRecorder;
        mediaRecorder.start();
        chatState.isRecording = true;
        updateMicUI(true);

    } catch (err) {
        console.error('Microphone error:', err);
        if (err.name === 'NotAllowedError') {
            updateSpeechStatus('Permissão de microfone negada. Verifique as configurações do navegador.', 'error');
        } else {
            updateSpeechStatus('Erro ao acessar microfone: ' + err.message, 'error');
        }
    }
}

// Para gravação
function stopWhisperRecording() {
    if (chatState.mediaRecorder && chatState.mediaRecorder.state === 'recording') {
        chatState.mediaRecorder.stop();
    }
    chatState.isRecording = false;
    updateMicUI(false);
}

// Envia áudio para Groq Whisper API
async function transcribeWithWhisper(audioBlob) {
    try {
        const formData = new FormData();
        formData.append('file', audioBlob, 'recording.webm');
        formData.append('model', 'whisper-large-v3-turbo');
        formData.append('language', 'en');
        formData.append('response_format', 'verbose_json');

        const response = await fetch('https://api.groq.com/openai/v1/audio/transcriptions', {
            method: 'POST',
            headers: {
                'Authorization': `Bearer ${state.apiKey}`
            },
            body: formData
        });

        if (!response.ok) {
            const err = await response.json();
            throw new Error(err.error?.message || 'Erro na transcrição Whisper');
        }

        const data = await response.json();
        const transcript = (data.text || '').trim();

        if (!transcript) {
            updateSpeechStatus('Nenhuma fala detectada. Tente novamente.', 'warning');
            return;
        }

        // Mostra o que foi transcrito
        const transcriptEl = document.getElementById('chat-transcript');
        if (transcriptEl) {
            transcriptEl.textContent = transcript;
            transcriptEl.style.display = 'block';
            setTimeout(() => {
                transcriptEl.style.display = 'none';
                transcriptEl.textContent = '';
            }, 2000);
        }

        // Envia a mensagem
        await handleUserMessage(transcript);

    } catch (err) {
        console.error('Whisper transcription error:', err);
        updateSpeechStatus('Erro na transcrição: ' + err.message, 'error');

        // Fallback: tenta Web Speech API
        updateSpeechStatus('Tentando reconhecimento alternativo...', 'warning');
        fallbackToWebSpeech();
    }
}

// Fallback para Web Speech API se Whisper falhar
function fallbackToWebSpeech() {
    const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
    if (!SpeechRecognition) {
        updateSpeechStatus('Reconhecimento de voz não disponível neste navegador.', 'error');
        return;
    }

    const recognition = new SpeechRecognition();
    recognition.lang = 'en-US';
    recognition.continuous = false;
    recognition.interimResults = false;

    recognition.onresult = (event) => {
        const transcript = event.results[0][0].transcript;
        if (transcript.trim()) {
            handleUserMessage(transcript.trim());
        }
    };

    recognition.onerror = (event) => {
        updateSpeechStatus('Erro: ' + event.error, 'error');
    };

    recognition.onend = () => {
        updateMicUI(false);
    };

    try {
        recognition.start();
        updateMicUI(true);
    } catch (e) {
        console.error('Fallback speech error:', e);
    }
}

// Atualiza UI do microfone
function updateMicUI(isRecording) {
    const micBtn = document.getElementById('mic-btn');
    if (!micBtn) return;
    
    if (isRecording) {
        micBtn.classList.add('recording');
        micBtn.querySelector('.mic-label').textContent = 'Ouvindo...';
        updateSpeechStatus('Ouvindo... Fale em inglês', 'recording');
    } else {
        micBtn.classList.remove('recording');
        micBtn.querySelector('.mic-label').textContent = 'Falar';
        updateSpeechStatus('Pressione o microfone para falar', 'idle');
    }
}

// Atualiza status do speech
function updateSpeechStatus(text, status) {
    const statusText = document.getElementById('speech-status-text');
    const statusEl = document.getElementById('speech-status');
    if (!statusText || !statusEl) return;
    
    statusText.textContent = text;
    statusEl.className = 'speech-status';
    if (status) {
        statusEl.classList.add('status-' + status);
    }
}

// Toggle gravação (usa Groq Whisper por padrão)
function toggleRecording() {
    if (chatState.isAiSpeaking || chatState.isAiThinking) return;

    if (chatState.isRecording) {
        stopWhisperRecording();
    } else {
        startWhisperRecording();
    }
}

// Processa mensagem do usuário
async function handleUserMessage(text) {
    if (!text.trim() || chatState.isAiThinking) return;

    // Esconde sugestões ao enviar mensagem
    hideSuggestions();
    
    // Adiciona mensagem do usuário no chat
    addChatMessage('user', text);
    chatState.chatHistory.push({ role: 'user', content: text });
    chatState.messageCount++;
    
    // Gera resposta da IA
    await generateChatResponse(text);
}

// Adiciona mensagem visual ao chat
function addChatMessage(who, text, translation, feedback) {
    const messagesEl = document.getElementById('chat-messages');
    if (!messagesEl) return;
    
    const msgDiv = document.createElement('div');
    msgDiv.className = `chat-msg chat-msg-${who}`;
    
    const persona = personaConfigs[chatState.persona];
    const avatar = who === 'ai' ? persona.avatar : 'EU';
    const name = who === 'ai' ? persona.name.split(' ')[0] : 'Você';
    
    let html = `
        <div class="chat-msg-avatar">${avatar}</div>
        <div class="chat-msg-content">
            <span class="chat-msg-name">${name}</span>
            <div class="chat-msg-bubble">
                <p class="chat-msg-text">${text}</p>
                ${translation ? `<p class="chat-msg-translation">${translation}</p>` : ''}
            </div>
    `;
    
    if (who === 'ai') {
        html += `<button class="chat-msg-speak" onclick="speakChatText(this, '${escapeForAttr(text)}')" title="Ouvir">Ouvir</button>`;
    }
    
    if (feedback) {
        html += `<div class="chat-msg-feedback">${feedback}</div>`;
    }
    
    html += `</div>`;
    msgDiv.innerHTML = html;
    
    messagesEl.appendChild(msgDiv);
    
    // Auto-scroll
    setTimeout(() => {
        messagesEl.scrollTop = messagesEl.scrollHeight;
    }, 100);
    
    return msgDiv;
}

function escapeForAttr(str) {
    return str.replace(/'/g, "\\'").replace(/"/g, '&quot;').replace(/\n/g, ' ');
}

// Adiciona indicador de "digitando..."
function showTypingIndicator() {
    const messagesEl = document.getElementById('chat-messages');
    if (!messagesEl) return;
    
    const persona = personaConfigs[chatState.persona];
    const typingDiv = document.createElement('div');
    typingDiv.className = 'chat-msg chat-msg-ai';
    typingDiv.id = 'typing-indicator';
    typingDiv.innerHTML = `
        <div class="chat-msg-avatar">${persona.avatar}</div>
        <div class="chat-msg-content">
            <div class="chat-msg-bubble typing-bubble">
                <div class="typing-dots">
                    <span></span><span></span><span></span>
                </div>
            </div>
        </div>
    `;
    messagesEl.appendChild(typingDiv);
    messagesEl.scrollTop = messagesEl.scrollHeight;
}

function removeTypingIndicator() {
    const indicator = document.getElementById('typing-indicator');
    if (indicator) indicator.remove();
}

// Gera resposta da IA via API
async function generateChatResponse(userText) {
    chatState.isAiThinking = true;
    updateSpeechStatus('IA está pensando...', 'thinking');
    showTypingIndicator();
    
    try {
        const persona = personaConfigs[chatState.persona];
        const topicDesc = topicPrompts[state.topic] || 'general conversation';
        const levelDesc = levelDescriptions[state.level] || 'intermediate level';
        
        const systemPrompt = `${persona.system}

CONTEXT:
- Topic focus: ${topicDesc}
- Student level: ${state.level} - ${levelDesc}
- The student is a Brazilian Portuguese speaker learning English.
- Keep your responses conversational and concise (1-3 sentences usually).
- ALWAYS respond in the following JSON format (no markdown, no code blocks):
{
  "response": "Your conversational reply in English",
  "translation": "Portuguese translation of your response",
  "feedback": "Detailed feedback: 1) Grammar errors with corrections, 2) Better word choices, 3) Common native expressions they could use instead. Be specific - quote the error and show the fix. Leave empty string ONLY if their English was flawless.",
  "corrected": "The student's last message rewritten in perfect natural English (empty if already perfect)",
  "suggestions": [
    {"en": "Easy/simple response option in English", "pt": "Tradução em português"},
    {"en": "Medium complexity response option", "pt": "Tradução em português"},
    {"en": "More advanced/elaborate response option", "pt": "Tradução em português"}
  ]
}
- The 'feedback' field is CRITICAL for learning. Always check for: subject-verb agreement, article usage (a/an/the), verb tense, preposition errors, word order, false cognates from Portuguese.
- The 'corrected' field shows how a native speaker would say what the student tried to say.
- The 'suggestions' array MUST contain exactly 3 possible responses the student could say next, ordered from simplest to most complex.
- Make suggestions natural, varied, and appropriate for the conversation context.
- The first suggestion should be very simple (1-5 words), the second moderate, and the third more elaborate.`;

        const messages = [
            { role: 'system', content: systemPrompt },
            ...chatState.chatHistory
        ];

        let response;
        
        if (state.apiProvider === 'groq') {
            response = await fetch('https://api.groq.com/openai/v1/chat/completions', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${state.apiKey}`
                },
                body: JSON.stringify({
                    model: 'llama-3.3-70b-versatile',
                    messages: messages,
                    temperature: 0.8,
                    max_tokens: 500
                })
            });
        } else {
            // Gemini - convert chat history to Gemini format
            const geminiContents = [];
            for (const msg of chatState.chatHistory) {
                geminiContents.push({
                    role: msg.role === 'user' ? 'user' : 'model',
                    parts: [{ text: msg.content }]
                });
            }
            
            response = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:generateContent?key=${state.apiKey}`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    systemInstruction: { parts: [{ text: systemPrompt }] },
                    contents: geminiContents,
                    generationConfig: {
                        temperature: 0.8,
                        maxOutputTokens: 500
                    }
                })
            });
        }

        if (!response.ok) {
            const errorData = await response.json();
            throw new Error(errorData.error?.message || 'Erro na API');
        }

        const data = await response.json();
        let content;
        
        if (state.apiProvider === 'groq') {
            content = data.choices[0].message.content.trim();
        } else {
            content = data.candidates[0].content.parts[0].text.trim();
        }

        // Remove markdown code blocks if present
        content = content.replace(/```json\n?/g, '').replace(/```\n?/g, '');
        
        let parsed;
        try {
            parsed = JSON.parse(content);
        } catch (e) {
            // Se falhar o parse, usa o texto bruto como resposta
            parsed = { response: content, translation: '', feedback: '' };
        }

        removeTypingIndicator();
        
        // Adiciona resposta da IA
        const aiText = parsed.response || content;
        const aiTranslation = parsed.translation || '';
        const aiFeedback = parsed.feedback || '';
        
        chatState.chatHistory.push({ role: 'assistant', content: aiText });
        chatState.lastAiMessage = aiText;
        addChatMessage('ai', aiText, aiTranslation);
        
        // Mostra correção da frase do usuário se houver
        const corrected = parsed.corrected || '';
        if (corrected && corrected.trim()) {
            showChatFeedback(`<strong>Correção:</strong> "${corrected}"` + 
                (aiFeedback ? `<br><br><strong>Dicas:</strong> ${aiFeedback}` : ''));
        } else if (aiFeedback && aiFeedback.trim()) {
            showChatFeedback(`<strong>Dicas:</strong> ${aiFeedback}`);
        }

        // Mostra sugestões de resposta
        const suggestions = parsed.suggestions || [];
        if (suggestions.length > 0) {
            showSuggestions(suggestions);
        } else {
            // Se a IA não retornou sugestões, gera separadamente
            generateSuggestionsAsync(aiText);
        }
        
        // Fala a resposta da IA automaticamente
        if (state.autoSpeak) {
            speakChatTextDirect(aiText);
        }
        
    } catch (error) {
        removeTypingIndicator();
        console.error('Chat AI error:', error);
        addChatMessage('ai', 'Sorry, I had a connection issue. Could you repeat that?', 
            'Desculpe, tive um problema de conexão. Pode repetir?');
    } finally {
        chatState.isAiThinking = false;
        updateSpeechStatus('Pressione o microfone para falar', 'idle');
    }
}

// ============================================
// SUGESTÕES DE RESPOSTA
// ============================================

// Mostra sugestões na UI
function showSuggestions(suggestions) {
    const container = document.getElementById('suggestions-container');
    if (!container) return;

    container.innerHTML = '';
    chatState.suggestionsVisible = true;

    const header = document.createElement('div');
    header.className = 'suggestions-header';
    header.innerHTML = '<span>Sugestões de resposta:</span>';
    container.appendChild(header);

    const labels = ['Fácil', 'Médio', 'Avançado'];

    suggestions.forEach((sug, index) => {
        const chip = document.createElement('button');
        chip.className = 'suggestion-chip';
        if (index === 0) chip.classList.add('chip-easy');
        else if (index === 1) chip.classList.add('chip-medium');
        else chip.classList.add('chip-advanced');

        chip.innerHTML = `
            <span class="chip-level">${labels[index] || ''}</span>
            <span class="chip-en">${sug.en}</span>
            <span class="chip-pt">${sug.pt}</span>
        `;

        chip.addEventListener('click', () => {
            useSuggestion(sug.en);
        });

        container.appendChild(chip);
    });

    container.classList.remove('hidden');

    // Scroll para ver sugestões
    const messagesEl = document.getElementById('chat-messages');
    if (messagesEl) {
        setTimeout(() => { messagesEl.scrollTop = messagesEl.scrollHeight; }, 150);
    }
}

// Esconde sugestões
function hideSuggestions() {
    const container = document.getElementById('suggestions-container');
    if (container) {
        container.classList.add('hidden');
        container.innerHTML = '';
    }
    chatState.suggestionsVisible = false;
}

// Usa uma sugestão como resposta
function useSuggestion(text) {
    hideSuggestions();
    handleUserMessage(text);
}

// Gera sugestões de forma assíncrona (fallback)
async function generateSuggestionsAsync(aiMessage) {
    chatState.isLoadingSuggestions = true;
    const container = document.getElementById('suggestions-container');
    if (container) {
        container.innerHTML = '<div class="suggestions-loading">Gerando sugestões...</div>';
        container.classList.remove('hidden');
    }

    try {
        const prompt = `The AI conversation partner just said: "${aiMessage}"

Generate exactly 3 possible responses the English learner could say, ordered from simplest to most complex.
The learner is ${state.level} level, Brazilian Portuguese speaker.

Respond ONLY with this JSON (no markdown):
[
  {"en": "Simple response (1-5 words)", "pt": "Tradução"},
  {"en": "Medium response", "pt": "Tradução"},
  {"en": "More elaborate response", "pt": "Tradução"}
]`;

        let response;
        if (state.apiProvider === 'groq') {
            response = await fetch('https://api.groq.com/openai/v1/chat/completions', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${state.apiKey}`
                },
                body: JSON.stringify({
                    model: 'llama-3.3-70b-versatile',
                    messages: [
                        { role: 'system', content: 'You generate response suggestions for English learners. Respond with valid JSON only.' },
                        { role: 'user', content: prompt }
                    ],
                    temperature: 0.8,
                    max_tokens: 300
                })
            });
        } else {
            response = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:generateContent?key=${state.apiKey}`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    contents: [{ parts: [{ text: 'You generate response suggestions for English learners. Respond with valid JSON only.\n\n' + prompt }] }],
                    generationConfig: { temperature: 0.8, maxOutputTokens: 300 }
                })
            });
        }

        if (!response.ok) throw new Error('API error');

        const data = await response.json();
        let content;
        if (state.apiProvider === 'groq') {
            content = data.choices[0].message.content.trim();
        } else {
            content = data.candidates[0].content.parts[0].text.trim();
        }

        content = content.replace(/```json\n?/g, '').replace(/```\n?/g, '');
        const suggestions = JSON.parse(content);
        showSuggestions(suggestions);

    } catch (e) {
        console.error('Error generating suggestions:', e);
        // Fallback com sugestões genéricas
        showSuggestions([
            { en: "That's interesting!", pt: "Que interessante!" },
            { en: "Could you tell me more about that?", pt: "Poderia me contar mais sobre isso?" },
            { en: "I see what you mean. I think that...", pt: "Entendo o que quer dizer. Eu acho que..." }
        ]);
    } finally {
        chatState.isLoadingSuggestions = false;
    }
}

// Botão "Me Ajuda!" - gera dica contextual
async function requestHelp() {
    if (chatState.isAiThinking || chatState.isLoadingSuggestions) return;

    // Se já tem sugestões visíveis, gera novas
    if (chatState.lastAiMessage) {
        await generateSuggestionsAsync(chatState.lastAiMessage);
    }
}

// Mostra feedback
function showChatFeedback(feedbackText) {
    const feedbackEl = document.getElementById('chat-feedback');
    const feedbackContent = document.getElementById('feedback-content');
    if (!feedbackEl || !feedbackContent) return;
    
    feedbackContent.innerHTML = feedbackText;
    feedbackEl.classList.remove('hidden');
    
    // Auto-hide after 8 seconds
    setTimeout(() => {
        feedbackEl.classList.add('hidden');
    }, 8000);
}

// Text-to-Speech para chat
function speakChatText(btnElement, text) {
    // Decode HTML entities
    const decoded = text.replace(/&quot;/g, '"').replace(/&#39;/g, "'");
    speakChatTextDirect(decoded, btnElement?.closest('.chat-msg-content'));
}

function speakChatTextDirect(text, containerEl) {
    if (!text) return;
    
    window.speechSynthesis.cancel();
    chatState.isAiSpeaking = true;
    
    const utterance = new SpeechSynthesisUtterance(text);
    utterance.lang = 'en-US';
    utterance.rate = 0.9;
    utterance.pitch = 1;
    
    const voices = window.speechSynthesis.getVoices();
    const englishVoice = voices.find(v => v.lang.startsWith('en-') && v.name.includes('Female')) 
        || voices.find(v => v.lang.startsWith('en-'));
    
    if (englishVoice) {
        utterance.voice = englishVoice;
    }
    
    utterance.onstart = () => {
        updateSpeechStatus('IA está falando...', 'speaking');
    };
    
    utterance.onend = () => {
        chatState.isAiSpeaking = false;
        updateSpeechStatus('Pressione o microfone para falar', 'idle');
    };
    
    utterance.onerror = () => {
        chatState.isAiSpeaking = false;
        updateSpeechStatus('Pressione o microfone para falar', 'idle');
    };
    
    window.speechSynthesis.speak(utterance);
}

// Inicia conversa livre
async function startFreeChat() {
    chatState.isActive = true;
    chatState.chatHistory = [];
    chatState.messages = [];
    chatState.messageCount = 0;
    chatState.persona = document.getElementById('ai-persona')?.value || 'friendly';
    
    // Limpa mensagens anteriores
    const messagesEl = document.getElementById('chat-messages');
    if (messagesEl) messagesEl.innerHTML = '';
    
    // Atualiza info bar
    const persona = personaConfigs[chatState.persona];
    const personaNameEl = document.getElementById('chat-persona-name');
    const personaAvatarEl = document.querySelector('.chat-persona-avatar');
    const topicBadge = document.getElementById('chat-topic-badge');
    
    if (personaNameEl) personaNameEl.textContent = persona.name;
    if (personaAvatarEl) personaAvatarEl.textContent = persona.avatar;
    if (topicBadge) {
        const topicNames = {
            daily: 'Dia a Dia', travel: 'Viagem', work: 'Trabalho',
            restaurant: 'Restaurante', shopping: 'Compras', health: 'Saúde',
            tech: 'Tecnologia', friendship: 'Social'
        };
        topicBadge.textContent = topicNames[state.topic] || state.topic;
    }
    
    // Gera primeira mensagem da IA
    chatState.isAiThinking = true;
    updateSpeechStatus('IA está iniciando a conversa...', 'thinking');
    showTypingIndicator();
    
    try {
        const persona = personaConfigs[chatState.persona];
        const topicDesc = topicPrompts[state.topic] || 'general conversation';
        const levelDesc = levelDescriptions[state.level] || 'intermediate level';
        
        const systemPrompt = `${persona.system}

CONTEXT:
- Topic focus: ${topicDesc}
- Student level: ${state.level} - ${levelDesc}
- The student is a Brazilian Portuguese speaker learning English.
- This is the START of the conversation. Greet the student and start a natural conversation about the topic.
- Keep it short and inviting (1-2 sentences).
- Respond in JSON format (no markdown, no code blocks):
{
  "response": "Your greeting/opening in English",
  "translation": "Portuguese translation",
  "suggestions": [
    {"en": "Simple greeting response", "pt": "Tradução"},
    {"en": "Medium greeting response", "pt": "Tradução"},
    {"en": "More elaborate greeting response", "pt": "Tradução"}
  ]
}
- The 'suggestions' array MUST contain exactly 3 possible responses ordered from simplest to most complex.`;

        let response;
        
        if (state.apiProvider === 'groq') {
            response = await fetch('https://api.groq.com/openai/v1/chat/completions', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${state.apiKey}`
                },
                body: JSON.stringify({
                    model: 'llama-3.3-70b-versatile',
                    messages: [
                        { role: 'system', content: systemPrompt },
                        { role: 'user', content: 'Start the conversation.' }
                    ],
                    temperature: 0.8,
                    max_tokens: 300
                })
            });
        } else {
            response = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:generateContent?key=${state.apiKey}`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    systemInstruction: { parts: [{ text: systemPrompt }] },
                    contents: [{ role: 'user', parts: [{ text: 'Start the conversation.' }] }],
                    generationConfig: { temperature: 0.8, maxOutputTokens: 300 }
                })
            });
        }

        if (!response.ok) {
            throw new Error('Erro ao iniciar conversa');
        }

        const data = await response.json();
        let content;
        
        if (state.apiProvider === 'groq') {
            content = data.choices[0].message.content.trim();
        } else {
            content = data.candidates[0].content.parts[0].text.trim();
        }

        content = content.replace(/```json\n?/g, '').replace(/```\n?/g, '');
        
        let parsed;
        try {
            parsed = JSON.parse(content);
        } catch (e) {
            parsed = { response: content, translation: '' };
        }

        removeTypingIndicator();
        
        const aiText = parsed.response || content;
        chatState.chatHistory.push({ role: 'assistant', content: aiText });
        chatState.lastAiMessage = aiText;
        addChatMessage('ai', aiText, parsed.translation || '');

        // Mostra sugestões iniciais
        const suggestions = parsed.suggestions || [];
        if (suggestions.length > 0) {
            showSuggestions(suggestions);
        } else {
            generateSuggestionsAsync(aiText);
        }
        
        if (state.autoSpeak) {
            speakChatTextDirect(aiText);
        }
        
    } catch (error) {
        removeTypingIndicator();
        console.error('Error starting chat:', error);
        const fallbackMsg = "Hi there! Let's practice English together. How are you doing today?";
        addChatMessage('ai', fallbackMsg, 'Oi! Vamos praticar inglês juntos. Como você está hoje?');
        chatState.chatHistory.push({ role: 'assistant', content: fallbackMsg });
        chatState.lastAiMessage = fallbackMsg;
        showSuggestions([
            { en: "I'm good, thanks!", pt: "Estou bem, obrigado!" },
            { en: "I'm doing great! How about you?", pt: "Estou ótimo! E você?" },
            { en: "I'm fine, thank you for asking. It's nice to meet you!", pt: "Estou bem, obrigado por perguntar. Prazer em conhecê-lo!" }
        ]);
    } finally {
        chatState.isAiThinking = false;
        updateSpeechStatus('Pressione o microfone para falar', 'idle');
    }
}

// Encerra conversa
function endFreeChat() {
    chatState.isActive = false;
    
    // Para gravação Whisper se estiver ativa
    if (chatState.mediaRecorder && chatState.mediaRecorder.state === 'recording') {
        chatState.mediaRecorder.stop();
    }
    if (chatState.audioStream) {
        chatState.audioStream.getTracks().forEach(t => t.stop());
        chatState.audioStream = null;
    }

    // Para reconhecimento legado se estiver ativo
    if (chatState.recognition && chatState.isRecording) {
        chatState.recognition.stop();
    }
    
    window.speechSynthesis.cancel();
    chatState.isRecording = false;
    chatState.isAiSpeaking = false;
    chatState.isAiThinking = false;
    hideSuggestions();
}

// Setup event listeners do chat (chamado pelo app.js)
function setupChatEventListeners() {
    const micBtn = document.getElementById('mic-btn');
    const sendTextBtn = document.getElementById('send-text-btn');
    const chatConfigBtn = document.getElementById('chat-config-btn');
    const endChatBtn = document.getElementById('end-chat-btn');
    const feedbackClose = document.getElementById('feedback-close');
    const textInputSend = document.getElementById('text-input-send');
    const textInputCancel = document.getElementById('text-input-cancel');
    const textInputField = document.getElementById('text-input-field');
    
    if (micBtn) {
        micBtn.addEventListener('click', toggleRecording);
    }
    
    if (sendTextBtn) {
        sendTextBtn.addEventListener('click', () => {
            const modal = document.getElementById('text-input-modal');
            if (modal) modal.classList.remove('hidden');
            if (textInputField) {
                textInputField.value = '';
                textInputField.focus();
            }
        });
    }
    
    if (textInputSend) {
        textInputSend.addEventListener('click', () => {
            const field = document.getElementById('text-input-field');
            if (field && field.value.trim()) {
                handleUserMessage(field.value.trim());
                field.value = '';
                document.getElementById('text-input-modal')?.classList.add('hidden');
            }
        });
    }
    
    if (textInputCancel) {
        textInputCancel.addEventListener('click', () => {
            document.getElementById('text-input-modal')?.classList.add('hidden');
        });
    }
    
    if (textInputField) {
        textInputField.addEventListener('keydown', (e) => {
            if (e.key === 'Enter' && !e.shiftKey) {
                e.preventDefault();
                textInputSend?.click();
            }
        });
    }
    
    if (chatConfigBtn) {
        chatConfigBtn.addEventListener('click', () => {
            endFreeChat();
            showScreen('setup');
        });
    }
    
    if (endChatBtn) {
        endChatBtn.addEventListener('click', () => {
            if (confirm('Deseja encerrar a conversa e voltar às configurações?')) {
                endFreeChat();
                showScreen('setup');
            }
        });
    }
    
    if (feedbackClose) {
        feedbackClose.addEventListener('click', () => {
            document.getElementById('chat-feedback')?.classList.add('hidden');
        });
    }
}
