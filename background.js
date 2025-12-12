/**
 * background.js
 * 
 * Service Worker responsável pela comunicação com as APIs de IA.
 * Suporta Google Gemini e Groq (OpenAI-compatible).
 * Dois modos de operação baseados no payload recebido:
 * 1. Filtragem de Projetos (Retorna JSON/Lista)
 * 2. Geração de Proposta (Retorna Texto)
 */

const GEMINI_API_URL = "https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent";
const GROQ_API_URL = "https://api.groq.com/openai/v1/chat/completions";

// -----------------------------------------------------------------------------
// HELPER: LOGGING
// -----------------------------------------------------------------------------

function logMessage(context, message, indentLevel = 0) {
    const now = new Date();
    const timestamp = `[${now.getHours().toString().padStart(2, '0')}:${now.getMinutes().toString().padStart(2, '0')}:${now.getSeconds().toString().padStart(2, '0')}]`;
    const indentation = '  '.repeat(indentLevel);
    console.log(`${timestamp} | [${context}] ${indentation}-> ${message}`);
}

// -----------------------------------------------------------------------------
// HELPER: CLEANUP
// -----------------------------------------------------------------------------

/**
 * Remove formatação Markdown de blocos de código (ex: ```json ... ```)
 * Útil para quando pedimos JSON para a IA e ela retorna formatado.
 */
function cleanMarkdownCodeBlock(text) {
    return text.replace(/^```(json)?\s*/i, '').replace(/\s*```$/, '');
}

// -----------------------------------------------------------------------------
// CORE: API REQUEST
// -----------------------------------------------------------------------------

/**
 * Executa a requisição para o Gemini.
 * @param {string} apiKey - Chave da API.
 * @param {string} systemInstruction - Instrução de sistema (Perfil de Filtragem ou Perfil de Proposta).
 * @param {string} userPrompt - O conteúdo a ser processado (Lista de projetos ou Detalhes do projeto).
 * @param {boolean} expectJson - Se true, tenta parsear a resposta como JSON (para filtragem).
 */
async function callGeminiApi(apiKey, systemInstruction, userPrompt, expectJson = false) {
    const url = `${GEMINI_API_URL}?key=${apiKey}`;

    logMessage('IA', 'Preparando requisição...', 1);

    const payload = {
        contents: [{
            parts: [{ text: userPrompt }]
        }],
        systemInstruction: {
            parts: [{ text: systemInstruction }]
        },
        generationConfig: {
            temperature: expectJson ? 0.2 : 1.0, // Menor temperatura para JSON (mais determinístico)
            topK: 40,
            topP: 0.95,
            maxOutputTokens: 8192,
            responseMimeType: expectJson ? "application/json" : "text/plain"
        },
        safetySettings: [
            { category: "HARM_CATEGORY_HARASSMENT", threshold: "BLOCK_ONLY_HIGH" },
            { category: "HARM_CATEGORY_HATE_SPEECH", threshold: "BLOCK_ONLY_HIGH" },
            { category: "HARM_CATEGORY_SEXUALLY_EXPLICIT", threshold: "BLOCK_ONLY_HIGH" },
            { category: "HARM_CATEGORY_DANGEROUS_CONTENT", threshold: "BLOCK_ONLY_HIGH" }
        ]
    };

    try {
        const response = await fetch(url, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(payload)
        });

        if (!response.ok) {
            const errorData = await response.json();
            throw new Error(errorData.error?.message || `HTTP Error ${response.status}`);
        }

        const data = await response.json();
        const candidate = data.candidates?.[0];

        if (!candidate) {
            throw new Error("Nenhum candidato retornado pela IA.");
        }

        if (candidate.finishReason === "SAFETY") {
            throw new Error("Conteúdo bloqueado pelas configurações de segurança.");
        }

        let textResponse = candidate.content?.parts?.[0]?.text;
        if (!textResponse) {
            throw new Error("Resposta vazia da IA.");
        }

        // Processamento Pós-Resposta
        if (expectJson) {
            logMessage('IA', 'Processando resposta JSON...', 1);
            try {
                const cleanText = cleanMarkdownCodeBlock(textResponse);
                const jsonResponse = JSON.parse(cleanText);
                return { success: true, data: jsonResponse };
            } catch (e) {
                logMessage('IA', 'ERRO ao parsear JSON da IA.', 2);
                return { success: false, error: "A IA não retornou um JSON válido." };
            }
        } else {
            return { success: true, data: textResponse };
        }

    } catch (error) {
        logMessage('IA', `ERRO CRÍTICO: ${error.message}`, 2);
        return { success: false, error: error.message };
    }
}

// -----------------------------------------------------------------------------
// CORE: GROQ API REQUEST (OpenAI-compatible)
// -----------------------------------------------------------------------------

/**
 * Executa a requisição para a API Groq (OpenAI-compatible).
 * @param {string} apiKey - Chave da API Groq.
 * @param {string} model - Modelo Groq a ser usado.
 * @param {string} systemInstruction - Instrução de sistema.
 * @param {string} userPrompt - O conteúdo a ser processado.
 * @param {boolean} expectJson - Se true, tenta parsear a resposta como JSON.
 */
async function callGroqApi(apiKey, model, systemInstruction, userPrompt, expectJson = false) {
    logMessage('IA', `Preparando requisição Groq (${model})...`, 1);

    const payload = {
        model: model,
        messages: [
            {
                role: "system",
                content: systemInstruction
            },
            {
                role: "user",
                content: userPrompt
            }
        ],
        temperature: expectJson ? 0.2 : 1.0,
        max_completion_tokens: 8192,
        top_p: 0.95
    };

    // Adicionar response_format para JSON mode se necessário
    if (expectJson) {
        payload.response_format = { type: "json_object" };
    }

    try {
        const response = await fetch(GROQ_API_URL, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${apiKey}`
            },
            body: JSON.stringify(payload)
        });

        if (!response.ok) {
            const errorData = await response.json();
            throw new Error(errorData.error?.message || `HTTP Error ${response.status}`);
        }

        const data = await response.json();
        const choice = data.choices?.[0];

        if (!choice) {
            throw new Error("Nenhuma resposta retornada pela IA Groq.");
        }

        if (choice.finish_reason === "content_filter") {
            throw new Error("Conteúdo bloqueado pelo filtro de segurança.");
        }

        let textResponse = choice.message?.content;
        if (!textResponse) {
            throw new Error("Resposta vazia da IA Groq.");
        }

        // Processamento Pós-Resposta
        if (expectJson) {
            logMessage('IA', 'Processando resposta JSON do Groq...', 1);
            try {
                const cleanText = cleanMarkdownCodeBlock(textResponse);
                const jsonResponse = JSON.parse(cleanText);
                return { success: true, data: jsonResponse };
            } catch (e) {
                logMessage('IA', 'ERRO ao parsear JSON da IA Groq.', 2);
                return { success: false, error: "A IA Groq não retornou um JSON válido." };
            }
        } else {
            return { success: true, data: textResponse };
        }

    } catch (error) {
        logMessage('IA', `ERRO CRÍTICO Groq: ${error.message}`, 2);
        return { success: false, error: error.message };
    }
}

// -----------------------------------------------------------------------------
// LISTENER DE MENSAGENS
// -----------------------------------------------------------------------------

chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {

    // Roteador de Ações - Suporta Gemini e Groq
    if (request.action === "aiRequest" || request.action === "geminiRequest") {
        const { apiKey, systemInstruction, userPrompt, taskType, provider, groqModel } = request;

        // Determina o provider (default: gemini para compatibilidade)
        const activeProvider = provider || 'gemini';
        logMessage('BACKGROUND', `Recebida tarefa: ${taskType} (Provider: ${activeProvider})`);

        if (!apiKey) {
            sendResponse({ success: false, error: "API Key não fornecida." });
            return true;
        }

        // Define se esperamos JSON (para filtragem) ou Texto (para proposta)
        const expectJson = (taskType === "FILTER_PROJECTS");

        // Roteia para a API correta
        if (activeProvider === 'groq') {
            const model = groqModel || 'llama-3.3-70b-versatile';
            callGroqApi(apiKey, model, systemInstruction, userPrompt, expectJson)
                .then(result => sendResponse(result));
        } else {
            callGeminiApi(apiKey, systemInstruction, userPrompt, expectJson)
                .then(result => sendResponse(result));
        }

        return true; // Mantém o canal aberto para resposta assíncrona
    }
});