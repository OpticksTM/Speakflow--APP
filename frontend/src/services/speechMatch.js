// frontend/src/services/speechMatch.js
// Compara a frase-alvo em inglês com o que o reconhecimento de voz ouviu.

export function normalizeWord(word) {
    return String(word || '').toLowerCase().replace(/[^a-z0-9]/g, '');
}

// Devolve { words: [{ word, ok, skip? }], score } onde score vai de 0 a 100.
// A ordem não importa: cada palavra ouvida só "paga" uma palavra da frase-alvo.
export function compareSpeech(target, heard) {
    const targetWords = String(target || '').split(/\s+/).filter(Boolean);

    const heardCounts = new Map();
    String(heard || '')
        .split(/\s+/)
        .map(normalizeWord)
        .filter(Boolean)
        .forEach(word => heardCounts.set(word, (heardCounts.get(word) || 0) + 1));

    const words = targetWords.map(display => {
        const key = normalizeWord(display);
        if (!key) return { word: display, ok: true, skip: true }; // só pontuação

        const available = heardCounts.get(key) || 0;
        if (available > 0) {
            heardCounts.set(key, available - 1);
            return { word: display, ok: true };
        }
        return { word: display, ok: false };
    });

    const scored = words.filter(item => !item.skip);
    const matched = scored.filter(item => item.ok).length;
    const score = scored.length ? Math.round((matched / scored.length) * 100) : 0;

    return { words, score };
}