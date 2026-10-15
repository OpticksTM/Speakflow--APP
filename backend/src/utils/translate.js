// backend/src/utils/translate.js
// Modo "Frase rápida": o usuário diz algo em português e recebe a frase pronta em inglês.

const { TOPICS, LEVELS, resolveTopic, resolveLevel } = require('./prompt');
const { formatError } = require('./aiJson');

function buildTranslateInstruction(context = {}) {
    const topic = resolveTopic(context.topic);
    const level = resolveLevel(context.level);

    return `You are a fast "say it in English" assistant for a Brazilian Portuguese speaker who struggles to come up with English sentences on the spot.

The user gives you something they want to say, written in Portuguese. It may come from speech recognition, so ignore filler words, hesitations and small recognition mistakes. If the text is already in English, just polish it into natural English.

RULES
1. "english": the natural English sentence the user should say out loud, in the first person, keeping exactly their meaning. Do NOT answer the user, do NOT add new ideas, do NOT explain. Keep it easy to say out loud.
2. Adapt the English to the learner's level: ${level}. ${LEVELS[level]} Keep the original tone and register (casual stays casual, polite stays polite): the level only changes how simple or rich the vocabulary is, never the meaning.
3. Typical context: ${TOPICS[topic]}. Use it only to choose the right wording and register.
4. "casual": a more relaxed, everyday way to say the same thing. "polite": a more polite or formal way to say it. Both keep the same meaning as "english". If one of them would be identical to "english", give a slightly different natural variation anyway.
5. "original": the user's Portuguese, cleaned up (fix recognition errors and punctuation) without changing the meaning.
6. "tip": one very short tip in Brazilian Portuguese (at most 14 words) about a useful pattern in the sentence, or an empty string if nothing is worth noting.

Return ONLY one valid JSON object, no markdown and no text outside the JSON, with exactly these keys:
{
  "original": "string",
  "english": "string",
  "casual": "string",
  "polite": "string",
  "tip": "string"
}`;
}

function str(value) {
    return typeof value === 'string' ? value.trim() : '';
}

// Devolve { original, english, alternatives: [{ label, en }], tip }
function normalizeTranslation(parsed, originalText) {
    let data = parsed;
    if (data && typeof data.english === 'object' && data.english !== null) {
        const { english: inner, ...outer } = data;
        data = { ...outer, ...inner };
    }

    const english = str(data && (data.english ?? data.translation ?? data.reply));
    if (!english) throw formatError('A resposta da IA não contém o campo "english".');

    const alternatives = [
        { label: 'Informal', en: str(data.casual) },
        { label: 'Educado', en: str(data.polite) }
    ].filter(alt => alt.en && alt.en.toLowerCase() !== english.toLowerCase());

    return {
        original: str(data.original) || String(originalText || '').trim(),
        english,
        alternatives,
        tip: str(data.tip)
    };
}

module.exports = { buildTranslateInstruction, normalizeTranslation };