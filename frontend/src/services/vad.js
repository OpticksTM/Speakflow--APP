// frontend/src/services/vad.js
// Detector simples de fala/pausa: decide quando parar de gravar sozinho.
// Recebe o volume (0 a 1) várias vezes por segundo e devolve:
//   'continue' | 'stop' (falou e fez uma pausa) | 'nospeech' (ninguém falou)

export function createVoiceDetector(options = {}) {
    const {
        speechThreshold = 0.035, // volume mínimo para considerar fala
        minSpeechMs = 250,       // fala precisa durar isso para valer (ignora estalos)
        silenceMs = 1400,        // pausa depois da fala que encerra a gravação
        noSpeechMs = 9000,       // sem fala nenhuma por esse tempo: desiste
        maxMs = 30000            // limite máximo de gravação
    } = options;

    let startedAt = null;
    let speechStart = null;
    let lastSpeechAt = null;
    let hasSpeech = false;

    return {
        update(level, now) {
            if (startedAt === null) startedAt = now;

            if (level >= speechThreshold) {
                if (speechStart === null) speechStart = now;
                lastSpeechAt = now;
                if (now - speechStart >= minSpeechMs) hasSpeech = true;
            } else if (!hasSpeech && speechStart !== null && now - lastSpeechAt > 300) {
                speechStart = null; // ruído curto: descarta e espera a fala de verdade
            }

            if (now - startedAt >= maxMs) return hasSpeech ? 'stop' : 'nospeech';
            if (hasSpeech && now - lastSpeechAt >= silenceMs) return 'stop';
            if (!hasSpeech && now - startedAt >= noSpeechMs) return 'nospeech';
            return 'continue';
        },
        get hasSpeech() {
            return hasSpeech;
        }
    };
}