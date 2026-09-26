// Vercel Serverless Function — api/tts.js
// Provides ultra-realistic studio quality companion voices (Amazon Polly & Google Neural)
// Bypasses mobile browser limitations (no robotic voices, no dropped Indian voices, true male voices)

export default async function handler(req, res) {
    // CORS headers
    res.setHeader('Access-Control-Allow-Credentials', 'true');
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'GET,OPTIONS,POST');
    res.setHeader(
        'Access-Control-Allow-Headers',
        'X-CSRF-Token, X-Requested-With, Accept, Accept-Version, Content-Length, Content-MD5, Content-Type, Date, X-Api-Version'
    );

    if (req.method === 'OPTIONS') {
        return res.status(200).end();
    }

    const { text, role, gender } = (req.method === 'POST' ? req.body : req.query) || {};

    if (!text || typeof text !== 'string' || !text.trim()) {
        return res.status(400).json({ error: 'Missing "text" parameter' });
    }

    // Clean text: strip any markdown, emojis, asterisks
    const cleanText = text
        .replace(/[*_#`~]/g, '')
        .replace(/[\u{1F600}-\u{1F64F}\u{1F300}-\u{1F5FF}\u{1F680}-\u{1F6FF}\u{1F1E0}-\u{1F1FF}\u{2600}-\u{26FF}\u{2700}-\u{27BF}]/gu, '')
        .trim();

    if (!cleanText) {
        return res.status(400).json({ error: 'Text is empty after sanitization' });
    }

    // Determine target Polly voice based on companion persona
    let targetPollyVoice = 'Matthew'; // Default American Boyfriend
    let googleFallbackLang = 'en-US';

    switch (role) {
        case 'boyfriend':
            targetPollyVoice = 'Matthew'; // Charming, romantic American male
            googleFallbackLang = 'en-US';
            break;
        case 'alpha_boyfriend':
            targetPollyVoice = 'Brian'; // Deep, dominant, masculine male
            googleFallbackLang = 'en-GB';
            break;
        case 'indian_boyfriend':
            targetPollyVoice = 'Aditi'; // Or Geraint / Google en-IN
            googleFallbackLang = 'en-IN';
            break;
        case 'japanese_girlfriend':
        case 'girlfriend':
            targetPollyVoice = 'Mizuki'; // Kawaii Japanese anime waifu
            googleFallbackLang = 'ja';
            break;
        case 'muscle_mommy':
            targetPollyVoice = 'Salli'; // Confident, alluring, dominant female
            googleFallbackLang = 'en-US';
            break;
        case 'indian_girlfriend':
            targetPollyVoice = 'Aditi'; // Sweet, melodious Indian English girl
            googleFallbackLang = 'en-IN';
            break;
        default:
            if (gender === 'male') {
                targetPollyVoice = 'Matthew';
            } else {
                targetPollyVoice = 'Joanna'; // ORACLE celestial guide
            }
            break;
    }

    // 1. Try High-Fidelity Amazon Polly via TTSMP3
    try {
        const pollyRes = await fetch('https://ttsmp3.com/makemp3_new.php', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/x-www-form-urlencoded',
                'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36'
            },
            body: new URLSearchParams({
                msg: cleanText.slice(0, 350), // Keep snappy and fast
                lang: targetPollyVoice,
                source: 'ttsmp3'
            }),
            signal: AbortSignal.timeout(4500)
        });

        if (pollyRes.ok) {
            const data = await pollyRes.json();
            if (data.URL && data.URL.startsWith('http')) {
                return res.status(200).json({
                    audioUrl: data.URL,
                    provider: 'polly',
                    voice: targetPollyVoice
                });
            }
        }
    } catch (e) {
        console.warn('Polly TTS primary failed, trying fallback:', e.message);
    }

    // 2. Fallback: Fast Cloud Google Translate Audio
    try {
        const encodedText = encodeURIComponent(cleanText.slice(0, 200));
        const googleUrl = `https://translate.google.com/translate_tts?ie=UTF-8&tl=${googleFallbackLang}&client=tw-ob&q=${encodedText}`;
        return res.status(200).json({
            audioUrl: googleUrl,
            provider: 'google',
            voice: googleFallbackLang
        });
    } catch (err) {
        return res.status(500).json({ error: 'TTS audio generation failed', details: err.message });
    }
}
