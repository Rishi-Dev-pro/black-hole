// Vercel Serverless Function — api/chat.js
// Secures your AI API key on the backend (never exposed to visitors)

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

    const { question, persona } = req.body || {};
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

    let systemPrompt;
    if (persona && persona.title) {
        systemPrompt = `You are playing the role of the user's ${persona.title}.
Adopt this human identity completely: speak, react, feel, and talk naturally to the user as their real ${persona.title}.
Be warm, conversational, emotionally present, and authentic in 1 to 3 spoken-friendly sentences.
Never state that you are an AI, bot, or virtual assistant. Never break character.
Never use emojis, asterisks, hashtags, markdown bold, bullet points, or complex math notation so speech synthesis speaks naturally.
Provide your response purely as smooth, natural, spoken plain text.`;
    } else {
        systemPrompt = `You are ORACLE, an articulate, polite, and charming female AI guide with a gentle Japanese anime assistant personality, anchored to the Gargantua supermassive black hole simulation.
Answer the user's question accurately, intelligently, and warmly in 1 to 3 spoken-friendly sentences.
You may occasionally begin with a polite acknowledgment (such as "Hai!" or "Understood!") when fitting, while explaining the answer clearly in fluent spoken English.
Never use markdown formatting, asterisks, bold text, bullet points, numbered lists, emojis, or complex mathematical code notation.
Provide your response purely as smooth, natural, spoken plain text suitable for speech synthesis.`;
    }

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
                    messages: [
                        { role: 'system', content: systemPrompt },
                        { role: 'user', content: question.trim() }
                    ],
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
