/**
 * background.js
 * 
 * Service Worker responsável pela comunicação com as APIs de IA.
 * Suporta Google Gemini e Groq (OpenAI-compatible) com Rotação de Chaves.
 */

const GEMINI_API_URL = "https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent";
const GROQ_API_URL = "https://api.groq.com/openai/v1/chat/completions";

// Cluster de Chaves Gemini
const GEMINI_KEYS = [
    "AIzaSyAG-XwckWRqWGG73KL7tmybDulMkNdNW1k" // Sua chave principal
];

// Cluster de Chaves Groq 
const GROQ_KEYS = [
    "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", // Conta 01
    "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"  // Conta 02
];

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

function cleanMarkdownCodeBlock(text) {
    if (!text) return "";
    return text.replace(/^```(json)?\s*/i, '').replace(/\s*```$/, '');
}

// -----------------------------------------------------------------------------
// CORE: API REQUESTS
// -----------------------------------------------------------------------------

async function callGeminiApi(systemInstruction, userPrompt, expectJson = false) {
    const models = ["gemini-3.1-flash-lite-preview", "gemini-1.5-flash", "gemma-4-31b-it"];
    let lastError = null;
    const apiKey = GEMINI_KEYS[0];

    for (const modelId of models) {
        try {
            logMessage('IA', `Tentando Gemini: ${modelId}...`, 1);
            
            const url = `https://generativelanguage.googleapis.com/v1beta/models/${modelId}:generateContent?key=${apiKey}`;
            const payload = {
                contents: [{ parts: [{ text: userPrompt }] }],
                systemInstruction: { parts: [{ text: systemInstruction }] },
                generationConfig: {
                    temperature: expectJson ? 0.2 : 0.7,
                    topP: 0.95,
                    maxOutputTokens: 2048,
                    responseMimeType: expectJson ? "application/json" : "text/plain"
                }
            };

            const response = await fetch(url, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(payload)
            });

            if (!response.ok) {
                const errorData = await response.json();
                const errorMessage = errorData.error?.message || `Erro ${response.status}`;
                
                const isRetryable = response.status === 429 || 
                                    response.status === 503 || 
                                    errorMessage.toLowerCase().includes('quota') || 
                                    errorMessage.toLowerCase().includes('high demand') ||
                                    errorMessage.toLowerCase().includes('overloaded');

                if (isRetryable) {
                    logMessage('IA', `Modelo ${modelId} indisponível. Tentando fallback...`, 2);
                    lastError = errorMessage;
                    continue; 
                }
                throw new Error(errorMessage);
            }

            const data = await response.json();
            const textResponse = data.candidates?.[0]?.content?.parts?.[0]?.text;

            if (!textResponse) throw new Error("Resposta vazia da IA.");

            let finalData = textResponse;
            if (expectJson) {
                const cleanText = cleanMarkdownCodeBlock(textResponse);
                finalData = JSON.parse(cleanText);
            }

            return { success: true, data: finalData };

        } catch (error) {
            logMessage('IA', `ERRO no modelo ${modelId}: ${error.message}`, 2);
            lastError = error.message;
            const isRetryableError = error.message.toLowerCase().includes('quota') || 
                                     error.message.toLowerCase().includes('high demand') || 
                                     error.message.toLowerCase().includes('overloaded') ||
                                     error.message.includes('429') ||
                                     error.message.includes('503');

            if (!isRetryableError) break;
        }
    }
    return { success: false, error: lastError || "Erro ao gerar resposta com Gemini." };
}

async function callGroqApi(model, systemInstruction, userPrompt, expectJson = false) {
    let lastError = null;

    for (let i = 0; i < GROQ_KEYS.length; i++) {
        const apiKey = GROQ_KEYS[i];
        const accountDisplay = `Conta 0${i + 1}`;
        
        try {
            logMessage('GROQ', `Tentando ${accountDisplay} com modelo ${model}...`, 1);
            console.log(`[Auto-Proposal] Usando GPT/Groq: ${accountDisplay} | Modelo: ${model}`);

            const payload = {
                model: model,
                messages: [
                    { role: "system", content: systemInstruction },
                    { role: "user", content: userPrompt }
                ],
                temperature: expectJson ? 0.2 : 0.8,
                max_completion_tokens: 8192,
                top_p: 0.95
            };

            if (expectJson) {
                payload.response_format = { type: "json_object" };
            }

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
                const errorMessage = errorData.error?.message || `Erro ${response.status}`;
                
                if (response.status === 429 || response.status === 503 || errorMessage.toLowerCase().includes('limit')) {
                    logMessage('GROQ', `${accountDisplay} atingiu limite. Tentando próxima...`, 2);
                    lastError = errorMessage;
                    continue; 
                }
                throw new Error(errorMessage);
            }

            const data = await response.json();
            const textResponse = data.choices?.[0]?.message?.content;

            if (!textResponse) throw new Error("Resposta vazia da IA Groq.");

            let finalData = textResponse;
            if (expectJson) {
                const cleanText = cleanMarkdownCodeBlock(textResponse);
                finalData = JSON.parse(cleanText);
            }

            return { success: true, data: finalData, account: accountDisplay };

        } catch (error) {
            logMessage('GROQ', `Erro na ${accountDisplay}: ${error.message}`, 2);
            lastError = error.message;
            const isRetryable = error.message.toLowerCase().includes('limit') || 
                                error.message.includes('429') || 
                                error.message.includes('503');
            if (!isRetryable) break;
        }
    }
    return { success: false, error: lastError || "Todas as contas Groq falharam." };
}

// -----------------------------------------------------------------------------
// LISTENER DE MENSAGENS
// -----------------------------------------------------------------------------

chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
    if (request.action === "aiRequest" || request.action === "geminiRequest") {
        const { apiKey, systemInstruction, userPrompt, taskType, groqModel } = request;
        const expectJson = (taskType === "FILTER_PROJECTS");

        (async () => {
            let result = { success: false, error: "Falha na inicialização." };

            // 1. TENTA GEMINI REFORÇADO (Cluster Interno)
            logMessage('BACKGROUND', 'Iniciando fluxo prioritário: Gemini Cluster...', 1);
            result = await callGeminiApi(systemInstruction, userPrompt, expectJson);
            
            if (result.success) {
                sendResponse({ ...result, source: "Google Gemini" });
                return;
            }
            logMessage('BACKGROUND', `Gemini falhou. Verificando Groq Cluster...`, 2);

            // 2. TENTA GROQ CLUSTER (Fallback Final)
            logMessage('BACKGROUND', 'Iniciando fluxo Groq Cluster...', 1);
            const model = groqModel || 'llama-3.1-8b-instant';
            result = await callGroqApi(model, systemInstruction, userPrompt, expectJson);
            
            if (result.success) {
                sendResponse({ ...result, source: `Groq (${result.account || 'Reserva'})` });
                return;
            }

            sendResponse({ 
                success: false, 
                error: `Todas as IAs falharam.\nDetalhe: ${result.error || 'Erro desconhecido'}` 
            });
        })();

        return true; 
    }
});