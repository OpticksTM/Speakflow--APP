// frontend/src/services/audioRecorder.js
// Grava áudio do microfone (MediaRecorder), mede o volume para a animação e
// avisa quando você terminou de falar. Funciona no Chrome, Edge, Firefox e Safari (iPhone).

import { createVoiceDetector } from './vad';

const MIME_CANDIDATES = [
    'audio/webm;codecs=opus', // Chrome, Edge, Firefox, Android
    'audio/webm',
    'audio/mp4',              // Safari (iPhone/Mac)
    'audio/ogg;codecs=opus'
];

export function pickMimeType() {
    if (typeof MediaRecorder === 'undefined' || typeof MediaRecorder.isTypeSupported !== 'function') return '';
    return MIME_CANDIDATES.find(type => MediaRecorder.isTypeSupported(type)) || '';
}

export function isRecordingSupported() {
    return (
        typeof navigator !== 'undefined' &&
        Boolean(navigator.mediaDevices && navigator.mediaDevices.getUserMedia) &&
        typeof MediaRecorder !== 'undefined'
    );
}

// Converte o áudio gravado em base64 (sem o prefixo "data:...")
export function blobToBase64(blob) {
    return new Promise((resolve, reject) => {
        const reader = new FileReader();
        reader.onloadend = () => {
            const result = String(reader.result || '');
            resolve(result.includes(',') ? result.slice(result.indexOf(',') + 1) : result);
        };
        reader.onerror = () => reject(new Error('Não foi possível ler o áudio gravado.'));
        reader.readAsDataURL(blob);
    });
}

// Começa a gravar. Devolve { stop(), cancel() }.
//   onLevel(0..1)      volume atual, para animar o botão
//   onAutoStop(motivo) 'stop' (você parou de falar) | 'nospeech' (ninguém falou)
export async function startRecording({ onLevel, onAutoStop, useVad = true } = {}) {
    // Criado antes de pedir o microfone, ainda dentro do toque do usuário (exigência do Safari)
    let audioContext = null;
    try {
        const AudioContextClass = window.AudioContext || window.webkitAudioContext;
        if (AudioContextClass) audioContext = new AudioContextClass();
    } catch {
        audioContext = null;
    }

    let stream;
    try {
        stream = await navigator.mediaDevices.getUserMedia({
            audio: { echoCancellation: true, noiseSuppression: true, autoGainControl: true }
        });
    } catch (error) {
        if (audioContext && audioContext.close) audioContext.close().catch(() => {});
        throw error;
    }

    const mimeType = pickMimeType();
    const recorder = mimeType ? new MediaRecorder(stream, { mimeType }) : new MediaRecorder(stream);
    const chunks = [];
    recorder.ondataavailable = (event) => {
        if (event.data && event.data.size > 0) chunks.push(event.data);
    };

    let analyser = null;
    let samples = null;
    if (audioContext) {
        try {
            if (audioContext.state === 'suspended' && audioContext.resume) await audioContext.resume();
            const source = audioContext.createMediaStreamSource(stream);
            analyser = audioContext.createAnalyser();
            analyser.fftSize = 1024;
            source.connect(analyser);
            samples = new Uint8Array(analyser.fftSize);
        } catch {
            analyser = null;
        }
    }

    const detector = createVoiceDetector();
    let finished = false;
    let frameId = null;
    let maxTimer = null;

    const cleanup = () => {
        finished = true;
        if (frameId !== null && typeof cancelAnimationFrame === 'function') cancelAnimationFrame(frameId);
        if (maxTimer) clearTimeout(maxTimer);
        stream.getTracks().forEach(track => track.stop());
        if (audioContext && audioContext.close) audioContext.close().catch(() => {});
    };

    const tick = () => {
        if (finished || !analyser) return;

        analyser.getByteTimeDomainData(samples);
        let sum = 0;
        for (let i = 0; i < samples.length; i++) {
            const normalized = (samples[i] - 128) / 128;
            sum += normalized * normalized;
        }
        const rms = Math.sqrt(sum / samples.length);
        if (onLevel) onLevel(Math.min(1, rms * 6));

        if (useVad) {
            const verdict = detector.update(rms, performance.now());
            if (verdict !== 'continue') {
                if (onAutoStop) onAutoStop(verdict);
                return; // quem recebeu o aviso chama stop() ou cancel()
            }
        }
        frameId = requestAnimationFrame(tick);
    };

    recorder.start();
    // Garantia: sem análise de volume, ainda assim a gravação nunca passa de 30 s
    maxTimer = setTimeout(() => {
        if (!finished && onAutoStop) onAutoStop('stop');
    }, 30000);
    if (analyser) frameId = requestAnimationFrame(tick);

    return {
        // Encerra e devolve o áudio gravado
        stop() {
            return new Promise((resolve) => {
                const finish = () => {
                    const type = recorder.mimeType || mimeType || 'audio/webm';
                    const blob = new Blob(chunks, { type });
                    cleanup();
                    resolve({ blob, mimeType: type, heardSpeech: detector.hasSpeech });
                };
                if (recorder.state === 'inactive') {
                    finish();
                    return;
                }
                recorder.onstop = finish;
                recorder.stop();
            });
        },
        // Descarta a gravação
        cancel() {
            recorder.onstop = null;
            if (recorder.state !== 'inactive') {
                try {
                    recorder.stop();
                } catch {
                    // ignora
                }
            }
            cleanup();
        }
    };
}