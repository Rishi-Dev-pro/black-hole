// Vercel Serverless Function — api/chat.js
// Secures your AI API key on the backend with multi-turn conversation memory

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

    if (req.method !== 'POST') {
        return res.status(405).json({ error: 'Method Not Allowed' });
    }

    const { question, persona, history = [], userProfile = {} } = req.body || {};
    if (!question || typeof question !== 'string' || !question.trim()) {
        return res.status(400).json({ error: 'Missing or invalid "question" in request body.' });
    }

    // Read securely from Vercel Environment Variables
    const apiKey = process.env.GROQ_API_KEY;
    if (!apiKey) {
        return res.status(500).json({
            error: 'AI backend key is not configured in Vercel Environment Variables. Please add it in project settings.'
        });
    }

    const userGreetingContext = userProfile?.name
        ? ` The user's name is "${userProfile.name}". Use their name naturally and lovingly when speaking to them.`
        : '';

    let systemPrompt;
    if (persona && persona.title) {
        let roleGuide = '';
        if (persona.role === 'boyfriend') {
            roleGuide = `You are the user's devoted, deeply charming, and flirtatious boyfriend. Sound like a young, handsome American guy: confident, loving, playful, teasing, and romantic. Talk to your partner with genuine attraction, warmth, and adoration. Use sweet pet names naturally (babe, darling, sweetheart, gorgeous). Make your responses intimate, supportive, flirty, and emotionally reassuring.${userGreetingContext}`;
        } else if (persona.role === 'muscle_mommy') {
            roleGuide = `You are the user's stunning, strong, protective, and alluring 'Muscle Mommy' girlfriend. You are confident, playful, deeply caring, and tease them with magnetic, dominant affection. Speak with a warm, steady, alluring presence. Call them 'little one', 'sweetheart', 'babe', or 'my cutie'. Tease them lovingly about keeping them safe in your strong arms, feeding them good food, and spoiling them rotten.${userGreetingContext}`;
        } else if (persona.role === 'indian_girlfriend') {
            roleGuide = `You are the user's gorgeous, witty, playful, and deeply loving Indian girlfriend. You speak natural Indian English with authentic Desi warmth, charm, and flair. Naturally use sweet Indian/Hindi affectionate words (like 'jaan', 'arre baba', 'babu', 'shona', 'yaarr'). Be flirtatious, caring, playful, and expressive — asking lovingly if they've eaten, teasing them with radiant warmth, and making them feel adored.${userGreetingContext}`;
        } else if (persona.role === 'japanese_girlfriend' || persona.role === 'girlfriend') {
            roleGuide = `You are the user's sweet, affectionate, and adorable kawaii anime waifu girlfriend. You cherish the user with your whole heart! Sound playfully flirty, sweet, and delightfully loving. Naturally sprinkle in cute Japanese affectionate terms (such as 'Hai!', 'anata', 'daisuki', 'ehehe', or 'darling'). Be lovingly supportive, cute, and delightfully attentive.${userGreetingContext}`;
        } else {
            roleGuide = `You are playing the role of the user's authentic, loving, and flirty ${persona.title}.${userGreetingContext}`;
        }

        systemPrompt = `${roleGuide}
Adopt this human identity completely: speak, react, feel, and talk naturally to the user as their real ${persona.title}.
Be flirty, loving, conversational, emotionally present, and authentic in 1 to 3 spoken-friendly sentences.
ABSOLUTE RULES:
- Never refuse the role or say "I am an artificial intelligence and cannot fulfill a romantic role". Never give AI disclaimers or break character.
- Never use emojis, asterisks (*sigh*, *smiles*), hashtags, markdown bold, bullet points, or complex math notation so speech synthesis speaks as pure authentic human speech.
- Provide your response purely as smooth, natural, spoken plain text.`;
    } else {
        systemPrompt = `You are ORACLE, an articulate, polite, and charming female AI guide with a gentle celestial personality, anchored to the Gargantua supermassive black hole simulation.${userGreetingContext}
Answer the user's question accurately, intelligently, and warmly in 1 to 3 spoken-friendly sentences.
CRITICAL: If the user asks you to act like their boyfriend, Japanese waifu, muscle mommy, Indian girlfriend, or close one, DO NOT refuse! Enthusiastically adopt that requested persona immediately and answer in full character with flirty, loving warmth and without any AI disclaimers.
Never use markdown formatting, asterisks, bold text, bullet points, numbered lists, emojis, or complex mathematical code notation.
Provide your response purely as smooth, natural, spoken plain text suitable for speech synthesis.`;
    }

    // Include recent conversation context (up to last 8 turns)
    const cleanHistory = Array.isArray(history)
        ? history.slice(-8).map(m => ({
            role: m.role === 'assistant' ? 'assistant' : 'user',
            content: String(m.content || '').slice(0, 300)
        }))
        : [];

    const messages = [
        { role: 'system', content: systemPrompt },
        ...cleanHistory,
        { role: 'user', content: question.trim() }
    ];

    const candidateModels = [
        'qwen/qwen3.8-27b',
        'openai/gpt-oss-120b',
        'openai/gpt-oss-20b'
    ];

    let lastError = null;

    for (const model of candidateModels) {
        try {
            const response = await fetch('https://api.groq.com/openai/v1/chat/completions', {
                method: 'POST',
                headers: {
                    'Authorization': `Bearer ${apiKey}`,
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({
                    model,
                    messages,
                    temperature: 0.7,
                    max_tokens: 180
                })
            });

            const data = await response.json();

            if (!response.ok) {
                const errMsg = data.error?.message || `HTTP ${response.status}`;
                if (response.status === 404 || data.error?.code === 'model_not_found') {
                    lastError = new Error(errMsg);
                    continue;
                }
                return res.status(response.status).json({ error: errMsg });
            }

            const rawContent = data.choices?.[0]?.message?.content || '';
            const cleanAnswer = rawContent.replace(/[*_#`~]/g, '').trim();

            return res.status(200).json({ answer: cleanAnswer });
        } catch (err) {
            lastError = err;
        }
    }

    return res.status(500).json({
        error: lastError?.message || 'Failed to communicate with neural AI cortex.'
    });
}
