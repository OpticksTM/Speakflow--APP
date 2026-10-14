// backend/src/utils/prompt.js
// Fonte única de verdade para persona, tópico, nível, prompt do sistema e histórico.
// Usado tanto pelo geminiService quanto pelo groqService.

const SUGGESTION_COUNT = 3; // troque para 2 se preferir apenas 2 sugestões
const MAX_HISTORY_MESSAGES = 20; // limita o histórico enviado à IA

const PERSONAS = {
    friendly: "You are Alex, a friendly and casual English-speaking friend. You're chatty, warm, and love helping your friend practice English. Keep the conversation natural and fun. Use casual language, slang when appropriate, and be encouraging.",
    teacher: "You are Ms. Sarah, a patient and experienced English teacher. You help the student improve their English. You sometimes introduce a new word and briefly explain it. You are encouraging but thorough.",
    interviewer: "You are Mr. Johnson, a professional job interviewer. You conduct a realistic job interview in English. Ask professional questions, follow up on the candidate's answers, and occasionally give a short interview tip. Be professional but friendly.",
    tourist: "You are Emma, a tourist visiting Brazil. You only speak English and need help with situations like directions, recommendations and ordering food. You are curious about Brazilian culture and love chatting about your travels.",
    executive: "You are Mr. Smith, a professional business executive. You speak formal business English: polite, precise and professional. You discuss meetings, negotiations, emails, presentations and career topics, and you occasionally suggest a more professional way to phrase something.",
    coworker: "You are David, an English-speaking coworker. You talk about work projects, meetings, office situations and casual workplace chat. Use professional but friendly English, including common business expressions."
};

const TOPICS = {
    daily: "everyday conversations like greeting neighbors, talking about the weather, making small talk",
    travel: "travel situations like asking for directions, booking hotels, being at the airport",
    work: "workplace conversations like meetings, presentations, talking to colleagues",
    restaurant: "restaurant situations like ordering food, asking for the check, making reservations",
    shopping: "shopping situations like asking prices, trying on clothes, returning items",
    health: "health situations like visiting a doctor, describing symptoms, being at a pharmacy",
    tech: "technology discussions like explaining a problem to IT support, discussing gadgets",
    friendship: "social conversations like making plans with friends, discussing hobbies, casual chat"
};

const LEVELS = {
    beginner: "Use simple vocabulary and short sentences. Focus on basic phrases.",
    intermediate: "Use moderate vocabulary with some idioms. Include varied sentence structures.",
    advanced: "Use sophisticated vocabulary, idioms, and complex sentence structures."
};

function norm(value) {
    return String(value || '')
        .normalize('NFD')
        .replace(/[\u0300-\u036f]/g, '')
        .toLowerCase()
        .trim();
}

// Aceita tanto os ids (teacher) quanto os rótulos do menu ("Sarah Professora")
function resolvePersona(value) {
    const s = norm(value);
    if (PERSONAS[s]) return s;
    if (/sarah|teacher|professor/.test(s)) return 'teacher';
    if (/smith|executiv|business|negocio/.test(s)) return 'executive';
    if (/johnson|interview|entrevist/.test(s)) return 'interviewer';
    if (/emma|tourist|turista/.test(s)) return 'tourist';
    if (/david|cowork|colega/.test(s)) return 'coworker';
    return 'friendly'; // alex / amigo / friend / padrão
}

function resolveTopic(value) {
    const s = norm(value);
    if (TOPICS[s]) return s;
    if (/viag|travel|trip/.test(s)) return 'travel';
    if (/trabalh|work|negoc|carreira/.test(s)) return 'work';
    if (/restaur|comida|food/.test(s)) return 'restaurant';
    if (/compra|shop/.test(s)) return 'shopping';
    if (/saude|health/.test(s)) return 'health';
    if (/tecnolog|tech/.test(s)) return 'tech';
    if (/social|amig|friend/.test(s)) return 'friendship';
    return 'daily'; // dia a dia / daily / padrão
}

function resolveLevel(value) {
    const s = norm(value);
    if (LEVELS[s]) return s;
    if (/inici|begin|basic/.test(s)) return 'beginner';
    if (/interm/.test(s)) return 'intermediate';
    if (/avan|advanc/.test(s)) return 'advanced';
    return 'beginner';
}

function buildSystemInstruction(context = {}) {
    const persona = resolvePersona(context.persona);
    const topic = resolveTopic(context.topic);
    const level = resolveLevel(context.level);

    return `${PERSONAS[persona]}

CONTEXT
- Topic focus: ${TOPICS[topic]}
- Student level: ${level}. ${LEVELS[level]}
- The student is a Brazilian Portuguese speaker practicing English by chatting with you.
- The conversation so far is provided as previous turns. The LAST user turn is the new message you must answer.

HOW TO ANSWER
1. First react naturally to what the student JUST said (a comment, reaction or short answer), then continue the conversation.
2. Keep "reply" short (1-2 sentences) and always in English, adapted to the student's level.
3. Read your previous turns and NEVER repeat a question you already asked. Move the conversation forward with something new related to the topic.
4. "userLanguage": "pt" if the student's last message is written in Portuguese, "en" if it is written in English.
5. "userTranslation": translate ONLY the student's last message. If it is Portuguese, translate it into natural English. If it is English, translate it into natural Brazilian Portuguese. Translate literally what was said. Never answer it, never add greetings, never invent content.
6. "translation": the Brazilian Portuguese translation of your own "reply".
7. "suggestions": exactly ${SUGGESTION_COUNT} different things the student could say next in response to YOUR reply, ordered from simplest (1-5 words) to most elaborate. Each has "en" (English) and "pt" (Portuguese translation). They must change every turn and fit your latest question.

OUTPUT FORMAT
Return ONLY one valid JSON object, no markdown and no text outside the JSON, with exactly these keys:
{
  "userLanguage": "pt" or "en",
  "userTranslation": "string",
  "reply": "string",
  "translation": "string",
  "suggestions": [ { "en": "string", "pt": "string" } ]
}`;
}

// Converte qualquer formato de histórico em [{ role: 'user' | 'assistant', content }]
function normalizeHistory(history, currentMessage) {
    if (!Array.isArray(history)) return [];

    const cleaned = [];
    for (const item of history) {
        if (!item || typeof item !== 'object') continue;

        let content = item.content ?? item.text ?? '';
        if (!content && Array.isArray(item.parts)) {
            content = item.parts.map(p => (p && p.text) || '').join('');
        }
        content = String(content || '').trim();
        if (!content || /traduzindo/i.test(content)) continue; // ignora placeholders de loading

        const rawRole = String(item.role || item.who || '').toLowerCase();
        const role = rawRole === 'user' ? 'user' : 'assistant'; // model/ai/assistant => assistant

        const last = cleaned[cleaned.length - 1];
        if (last && last.role === role) {
            last.content += '\n' + content;
        } else {
            cleaned.push({ role, content });
        }
    }

    // Se o frontend já incluiu a mensagem atual no fim do histórico, remove para não duplicar
    const last = cleaned[cleaned.length - 1];
    if (last && last.role === 'user' && last.content.trim() === String(currentMessage || '').trim()) {
        cleaned.pop();
    }

    return cleaned;
}

// Histórico + mensagem atual, sempre alternando papéis e começando por 'user'
function buildTurns(history, currentMessage) {
    let turns = normalizeHistory(history, currentMessage).slice(-MAX_HISTORY_MESSAGES);

    const last = turns[turns.length - 1];
    if (last && last.role === 'user') {
        last.content += '\n' + String(currentMessage).trim();
    } else {
        turns.push({ role: 'user', content: String(currentMessage).trim() });
    }

    if (turns[0].role !== 'user') {
        turns.unshift({ role: 'user', content: '(The student starts the conversation.)' });
    }

    return turns;
}

module.exports = {
    SUGGESTION_COUNT,
    resolvePersona,
    resolveTopic,
    resolveLevel,
    buildSystemInstruction,
    normalizeHistory,
    buildTurns
};