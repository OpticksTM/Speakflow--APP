// English Dialog Practice App
// Estado da aplicação
const state = {
    apiKey: '',
    apiProvider: 'groq',
    topic: 'daily',
    level: 'beginner',
    autoSpeak: true,
    practiceMode: 'dialog',
    currentDialog: [],
    currentStep: 0,
    isLoading: false
};

// Elementos DOM
const elements = {
    setupScreen: document.getElementById('setup-screen'),
    dialogScreen: document.getElementById('dialog-screen'),
    chatScreen: document.getElementById('chat-screen'),
    loading: document.getElementById('loading'),
    practiceModeSelect: document.getElementById('practice-mode'),
    apiProviderSelect: document.getElementById('api-provider'),
    apiKeyInput: document.getElementById('api-key'),
    apiLink: document.getElementById('api-link'),
    topicSelect: document.getElementById('topic'),
    levelSelect: document.getElementById('level'),
    autoSpeakCheck: document.getElementById('auto-speak'),
    startBtn: document.getElementById('start-btn'),
    contextText: document.getElementById('context-text'),
    partnerText: document.getElementById('partner-text'),
    userText: document.getElementById('user-text'),
    partnerTranslation: document.getElementById('partner-translation'),
    userTranslation: document.getElementById('user-translation'),
    progressFill: document.getElementById('progress-fill'),
    currentStepSpan: document.getElementById('current-step'),
    totalStepsSpan: document.getElementById('total-steps'),
    backBtn: document.getElementById('back-btn'),
    newDialogBtn: document.getElementById('new-dialog-btn'),
    configBtn: document.getElementById('config-btn'),
    modeDescription: document.getElementById('mode-description'),
    personaGroup: document.getElementById('persona-group'),
    autospeakGroup: document.getElementById('autospeak-group'),
    headerSubtitle: document.getElementById('header-subtitle')
};

// Tópicos para geração de diálogos
const topicPrompts = {
    daily: "everyday conversations like greeting neighbors, talking about weather, making small talk",
    travel: "travel situations like asking for directions, booking hotels, at the airport",
    work: "workplace conversations like meetings, presentations, talking to colleagues",
    restaurant: "restaurant situations like ordering food, asking for the check, making reservations",
    shopping: "shopping situations like asking prices, trying clothes, returning items",
    health: "health situations like visiting a doctor, describing symptoms, at a pharmacy",
    tech: "technology discussions like explaining a problem to IT support, discussing gadgets",
    friendship: "social conversations like making plans with friends, discussing hobbies, casual chat"
};

const levelDescriptions = {
    beginner: "Use simple vocabulary and short sentences. Focus on basic phrases.",
    intermediate: "Use moderate vocabulary with some idioms. Include varied sentence structures.",
    advanced: "Use sophisticated vocabulary, idioms, and complex sentence structures."
};

// Inicialização
document.addEventListener('DOMContentLoaded', () => {
    loadSettings();
    setupEventListeners();
    setupChatEventListeners();
    updateModeUI();
});

function loadSettings() {
    const savedProvider = localStorage.getItem('api_provider');
    if (savedProvider) {
        elements.apiProviderSelect.value = savedProvider;
    }
    updateApiLink();
    
    const savedKey = localStorage.getItem('dialog_api_key');
    if (savedKey) {
        elements.apiKeyInput.value = savedKey;
    }
    
    const savedTopic = localStorage.getItem('dialog_topic');
    if (savedTopic) {
        elements.topicSelect.value = savedTopic;
    }
    
    const savedLevel = localStorage.getItem('dialog_level');
    if (savedLevel) {
        elements.levelSelect.value = savedLevel;
    }
    
    const savedAutoSpeak = localStorage.getItem('auto_speak');
    if (savedAutoSpeak !== null) {
        elements.autoSpeakCheck.checked = savedAutoSpeak === 'true';
    }

    const savedMode = localStorage.getItem('practice_mode');
    if (savedMode) {
        elements.practiceModeSelect.value = savedMode;
    }

    const savedPersona = localStorage.getItem('ai_persona');
    if (savedPersona) {
        const personaSelect = document.getElementById('ai-persona');
        if (personaSelect) personaSelect.value = savedPersona;
    }
}

function updateApiLink() {
    const provider = elements.apiProviderSelect.value;
    if (provider === 'groq') {
        elements.apiLink.innerHTML = 'Obtenha gr\u00e1tis em <a href="https://console.groq.com/keys" target="_blank" style="color: #00d9ff;">console.groq.com</a>';
        elements.apiKeyInput.placeholder = 'gsk_...';
    } else {
        elements.apiLink.innerHTML = 'Obtenha gr\u00e1tis em <a href="https://aistudio.google.com/app/apikey" target="_blank" style="color: #00d9ff;">aistudio.google.com</a>';
        elements.apiKeyInput.placeholder = 'AIza...';
    }
}

function saveSettings() {
    localStorage.setItem('api_provider', state.apiProvider);
    localStorage.setItem('dialog_api_key', state.apiKey);
    localStorage.setItem('dialog_topic', state.topic);
    localStorage.setItem('dialog_level', state.level);
    localStorage.setItem('auto_speak', state.autoSpeak);
    localStorage.setItem('practice_mode', state.practiceMode);
    localStorage.setItem('ai_persona', document.getElementById('ai-persona')?.value || 'friendly');
}

function updateModeUI() {
    const mode = elements.practiceModeSelect.value;
    const isChat = mode === 'freeChat';
    
    if (elements.modeDescription) {
        elements.modeDescription.textContent = isChat 
            ? 'Converse livremente com a IA usando sua voz em tempo real'
            : 'Di\u00e1logos pr\u00e9-gerados para ler em voz alta';
    }
    
    if (elements.personaGroup) {
        elements.personaGroup.style.display = isChat ? 'block' : 'none';
    }
}

function setupEventListeners() {
    // Botão iniciar
    elements.startBtn.addEventListener('click', startPractice);
    
    // Mudança de provedor
    elements.apiProviderSelect.addEventListener('change', updateApiLink);

    // Mudança de modo
    elements.practiceModeSelect.addEventListener('change', updateModeUI);
    
    // Tecla ESPAÇO para avançar (apenas no modo diálogo)
    document.addEventListener('keydown', (e) => {
        if (e.code === 'Space' && elements.dialogScreen.classList.contains('active')) {
            e.preventDefault();
            nextStep();
        }
    });
    
    // Botões de controle
    elements.backBtn.addEventListener('click', previousStep);
    elements.newDialogBtn.addEventListener('click', generateNewDialog);
    elements.configBtn.addEventListener('click', showSetup);
}

function showLoading(show) {
    state.isLoading = show;
    elements.loading.classList.toggle('hidden', !show);
}

function showScreen(screen) {
    elements.setupScreen.classList.remove('active');
    elements.dialogScreen.classList.remove('active');
    elements.chatScreen.classList.remove('active');
    
    if (screen === 'setup') {
        elements.setupScreen.classList.add('active');
        if (elements.headerSubtitle) elements.headerSubtitle.textContent = 'Pratique ingl\u00eas com IA';
    } else if (screen === 'dialog') {
        elements.dialogScreen.classList.add('active');
        if (elements.headerSubtitle) elements.headerSubtitle.textContent = 'Pressione ESPA\u00c7O para avan\u00e7ar no di\u00e1logo';
    } else if (screen === 'chat') {
        elements.chatScreen.classList.add('active');
        if (elements.headerSubtitle) elements.headerSubtitle.textContent = 'Converse em tempo real com a IA';
    }
}

function showSetup() {
    showScreen('setup');
}

async function startPractice() {
    state.apiProvider = elements.apiProviderSelect.value;
    state.apiKey = elements.apiKeyInput.value.trim();
    state.topic = elements.topicSelect.value;
    state.level = elements.levelSelect.value;
    state.autoSpeak = elements.autoSpeakCheck.checked;
    state.practiceMode = elements.practiceModeSelect.value;
    
    if (!state.apiKey) {
        alert('Por favor, insira sua API Key');
        return;
    }
    
    saveSettings();

    if (state.practiceMode === 'freeChat') {
        showScreen('chat');
        await startFreeChat();
    } else {
        await generateNewDialog();
    }
}

async function generateNewDialog() {
    showLoading(true);
    
    try {
        const dialog = await fetchDialogFromAI();
        state.currentDialog = dialog;
        state.currentStep = 0;
        
        updateUI();
        showScreen('dialog');
        
        if (state.autoSpeak) {
            setTimeout(() => speakText('partner'), 500);
        }
    } catch (error) {
        console.error('Erro ao gerar diálogo:', error);
        alert('Erro ao gerar diálogo: ' + error.message);
    } finally {
        showLoading(false);
    }
}

async function fetchDialogFromAI() {
    const topicDescription = topicPrompts[state.topic];
    const levelDescription = levelDescriptions[state.level];
    
    const prompt = `Generate a natural English conversation dialog for language learning practice.

Topic: ${topicDescription}
Level: ${state.level} - ${levelDescription}

Create a dialog with exactly 10 exchanges. Each exchange should have:
1. What the conversation partner says
2. What the learner should respond
3. Portuguese translation of both

Return ONLY a valid JSON array with this exact structure (no markdown, no explanation):
[
  {
    "context": "Brief situation description in English",
    "partner": "What the partner says in English",
    "user": "What the learner should say in English", 
    "partnerPT": "Portuguese translation of partner's line",
    "userPT": "Portuguese translation of user's line"
  }
]

Make the conversation natural, progressive, and educational. Start simple and gradually increase complexity.`;

    let response;
    
    if (state.apiProvider === 'groq') {
        // Usando Groq API (GRÁTIS)
        response = await fetch('https://api.groq.com/openai/v1/chat/completions', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${state.apiKey}`
            },
            body: JSON.stringify({
                model: 'llama-3.3-70b-versatile',
                messages: [
                    {
                        role: 'system',
                        content: 'You are an expert English teacher creating dialog exercises. Always respond with valid JSON only, no markdown formatting.'
                    },
                    {
                        role: 'user',
                        content: prompt
                    }
                ],
                temperature: 0.8,
                max_tokens: 2000
            })
        });
    } else {
        // Usando Google Gemini API (GRÁTIS)
        response = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:generateContent?key=${state.apiKey}`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({
                contents: [{
                    parts: [{
                        text: `You are an expert English teacher creating dialog exercises. Always respond with valid JSON only, no markdown formatting.\n\n${prompt}`
                    }]
                }],
                generationConfig: {
                    temperature: 0.8,
                    maxOutputTokens: 2000
                }
            })
        });
    }

    if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error?.message || 'Erro na API - Verifique sua API Key');
    }

    const data = await response.json();
    let content;
    
    if (state.apiProvider === 'groq') {
        // Formato OpenAI (Groq)
        content = data.choices[0].message.content.trim();
    } else {
        // Formato Gemini
        content = data.candidates[0].content.parts[0].text.trim();
    }
    
    // Remove markdown code blocks if present
    content = content.replace(/```json\n?/g, '').replace(/```\n?/g, '');
    
    try {
        return JSON.parse(content);
    } catch (e) {
        console.error('JSON parse error:', content);
        throw new Error('Erro ao processar resposta da IA');
    }
}

function updateUI() {
    const step = state.currentDialog[state.currentStep];
    
    if (!step) return;
    
    // Atualiza textos
    elements.contextText.textContent = step.context;
    elements.partnerText.textContent = step.partner;
    elements.userText.textContent = step.user;
    elements.partnerTranslation.textContent = '🇧🇷 ' + step.partnerPT;
    elements.userTranslation.textContent = '🇧🇷 ' + step.userPT;
    
    // Atualiza progresso
    const total = state.currentDialog.length;
    const progress = ((state.currentStep + 1) / total) * 100;
    
    elements.progressFill.style.width = `${progress}%`;
    elements.currentStepSpan.textContent = state.currentStep + 1;
    elements.totalStepsSpan.textContent = total;
    
    // Animação
    document.querySelectorAll('.dialog-box').forEach(box => {
        box.style.animation = 'none';
        box.offsetHeight; // Trigger reflow
        box.style.animation = 'fadeIn 0.5s ease';
    });
}

function nextStep() {
    if (state.isLoading) return;
    
    if (state.currentStep < state.currentDialog.length - 1) {
        state.currentStep++;
        updateUI();
        
        if (state.autoSpeak) {
            setTimeout(() => speakText('partner'), 300);
        }
    } else {
        // Fim do diálogo
        if (confirm('🎉 Parabéns! Você completou este diálogo!\n\nDeseja praticar um novo diálogo?')) {
            generateNewDialog();
        }
    }
}

function previousStep() {
    if (state.currentStep > 0) {
        state.currentStep--;
        updateUI();
    }
}

// Text-to-Speech
function speakText(who) {
    const text = who === 'partner' 
        ? elements.partnerText.textContent 
        : elements.userText.textContent;
    
    if (!text || text === '...') return;
    
    // Cancela fala anterior
    window.speechSynthesis.cancel();
    
    const utterance = new SpeechSynthesisUtterance(text);
    utterance.lang = 'en-US';
    utterance.rate = 0.9;
    utterance.pitch = 1;
    
    // Seleciona voz em inglês se disponível
    const voices = window.speechSynthesis.getVoices();
    const englishVoice = voices.find(v => v.lang.startsWith('en-') && v.name.includes('Female')) 
        || voices.find(v => v.lang.startsWith('en-'));
    
    if (englishVoice) {
        utterance.voice = englishVoice;
    }
    
    // Visual feedback
    const box = who === 'partner' 
        ? document.querySelector('.partner-box')
        : document.querySelector('.user-box');
    
    utterance.onstart = () => box.classList.add('speaking');
    utterance.onend = () => box.classList.remove('speaking');
    
    window.speechSynthesis.speak(utterance);
}

// Carrega vozes (necessário em alguns navegadores)
window.speechSynthesis.onvoiceschanged = () => {
    window.speechSynthesis.getVoices();
};
