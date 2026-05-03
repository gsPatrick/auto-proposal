/**
 * background.js
 * 
 * Service Worker responsável pela comunicação com as APIs de IA.
 * Suporta Google Gemini, Groq, OpenAI (GPT) e Anthropic (Claude) com Rotação de Chaves.
 */

const GROQ_API_URL = "https://api.groq.com/openai/v1/chat/completions";
const OPENAI_API_URL = "https://api.openai.com/v1/chat/completions";
const CLAUDE_API_URL = "https://api.anthropic.com/v1/messages";

// Cluster de Chaves Gemini (Fallback gratuito)
const GEMINI_KEYS = [
    "AIzaSyAG-XwckWRqWGG73KL7tmybDulMkNdNW1k" // Sua chave principal
];

// Cluster de Chaves Groq (Fallback gratuito)
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
// CORE: GEMINI API
// -----------------------------------------------------------------------------

/**
 * Executa a requisição para o Gemini.
 * Suporta fallback automático entre modelos e rotação de chaves.
 */
async function callGeminiApi(geminiKeys, systemInstruction, userPrompt, expectJson = false) {
    const models = ["gemini-3.1-flash-lite-preview", "gemini-1.5-flash", "gemma-4-31b-it"];
    let lastError = null;

    // Se não houver chaves, aborta
    if (!geminiKeys || geminiKeys.length === 0) return { success: false, error: "Nenhuma chave Gemini configurada." };

    for (let k = 0; k < geminiKeys.length; k++) {
        const apiKey = geminiKeys[k];
        const accountDisplay = `Gemini Conta 0${k + 1}`;

        for (const modelId of models) {
            try {
                logMessage('IA', `Tentando ${accountDisplay} (${modelId})...`, 1);
                
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
                        logMessage('IA', `${accountDisplay} / ${modelId} indisponível. Tentando fallback...`, 2);
                        lastError = errorMessage;
                        continue; // Próximo modelo ou próxima chave
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

                return { success: true, data: finalData, source: accountDisplay };

            } catch (error) {
                logMessage('IA', `ERRO no ${accountDisplay}: ${error.message}`, 2);
                lastError = error.message;
                const isRetryableError = error.message.toLowerCase().includes('quota') || 
                                         error.message.toLowerCase().includes('high demand') || 
                                         error.message.toLowerCase().includes('overloaded') ||
                                         error.message.includes('429') ||
                                         error.message.includes('503');

                if (!isRetryableError) break;
            }
        }
    }
    return { success: false, error: lastError || "Erro ao gerar resposta com Gemini Cluster." };
}

// -----------------------------------------------------------------------------
// CORE: GROQ API
// -----------------------------------------------------------------------------

/**
 * Executa a requisição para a API Groq com suporte a rotação de chaves (Cluster).
 */
async function callGroqApi(groqKeys, model, systemInstruction, userPrompt, expectJson = false) {
    let lastError = null;

    if (!groqKeys || groqKeys.length === 0) return { success: false, error: "Nenhuma chave Groq configurada." };

    for (let i = 0; i < groqKeys.length; i++) {
        const apiKey = groqKeys[i];
        const accountDisplay = `Groq Conta 0${i + 1}`;
        
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
// CORE: OPENAI (GPT) API
// -----------------------------------------------------------------------------

/**
 * Executa a requisição para a API OpenAI (GPT-4o / GPT-4o-mini).
 * Formato OpenAI Chat Completions padrão.
 */
async function callOpenAIApi(openaiKeys, model, systemInstruction, userPrompt, expectJson = false) {
    let lastError = null;

    if (!openaiKeys || openaiKeys.length === 0) return { success: false, error: "Nenhuma chave OpenAI configurada." };

    for (let i = 0; i < openaiKeys.length; i++) {
        const apiKey = openaiKeys[i];
        const accountDisplay = `OpenAI Conta 0${i + 1}`;

        try {
            logMessage('OPENAI', `Tentando ${accountDisplay} com modelo ${model}...`, 1);
            console.log(`%c[Auto-Proposal] Usando OpenAI: ${accountDisplay} | Modelo: ${model}`, "color: #10a37f; font-weight: bold;");

            const payload = {
                model: model,
                messages: [
                    { role: "system", content: systemInstruction },
                    { role: "user", content: userPrompt }
                ],
                temperature: expectJson ? 0.2 : 0.7,
                max_completion_tokens: 2048,
                top_p: 0.95
            };

            if (expectJson) {
                payload.response_format = { type: "json_object" };
            }

            const response = await fetch(OPENAI_API_URL, {
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

                if (response.status === 429 || response.status === 503 || errorMessage.toLowerCase().includes('quota') || errorMessage.toLowerCase().includes('rate')) {
                    logMessage('OPENAI', `${accountDisplay} atingiu limite. Tentando próxima...`, 2);
                    lastError = errorMessage;
                    continue;
                }
                throw new Error(errorMessage);
            }

            const data = await response.json();
            const textResponse = data.choices?.[0]?.message?.content;

            if (!textResponse) throw new Error("Resposta vazia da OpenAI.");

            // Log de uso de tokens
            if (data.usage) {
                logMessage('OPENAI', `Tokens usados — Input: ${data.usage.prompt_tokens}, Output: ${data.usage.completion_tokens}, Total: ${data.usage.total_tokens}`, 2);
            }

            let finalData = textResponse;
            if (expectJson) {
                const cleanText = cleanMarkdownCodeBlock(textResponse);
                finalData = JSON.parse(cleanText);
            }

            return { success: true, data: finalData, source: `${accountDisplay} (${model})` };

        } catch (error) {
            logMessage('OPENAI', `Erro na ${accountDisplay}: ${error.message}`, 2);
            lastError = error.message;
            const isRetryable = error.message.toLowerCase().includes('rate') ||
                                error.message.toLowerCase().includes('quota') ||
                                error.message.includes('429') ||
                                error.message.includes('503');
            if (!isRetryable) break;
        }
    }
    return { success: false, error: lastError || "Todas as contas OpenAI falharam." };
}

// -----------------------------------------------------------------------------
// CORE: ANTHROPIC (CLAUDE) API
// -----------------------------------------------------------------------------

/**
 * Executa a requisição para a API Anthropic (Claude).
 * Usa o formato Messages API com header x-api-key e anthropic-version.
 */
async function callClaudeApi(claudeKeys, model, systemInstruction, userPrompt, expectJson = false) {
    let lastError = null;

    if (!claudeKeys || claudeKeys.length === 0) return { success: false, error: "Nenhuma chave Claude configurada." };

    for (let i = 0; i < claudeKeys.length; i++) {
        const apiKey = claudeKeys[i];
        const accountDisplay = `Claude Conta 0${i + 1}`;

        try {
            logMessage('CLAUDE', `Tentando ${accountDisplay} com modelo ${model}...`, 1);
            console.log(`%c[Auto-Proposal] Usando Claude: ${accountDisplay} | Modelo: ${model}`, "color: #d97706; font-weight: bold;");

            // Claude usa formato diferente: system é um campo top-level, não uma mensagem
            const payload = {
                model: model,
                max_tokens: 2048,
                system: systemInstruction,
                messages: [
                    { role: "user", content: userPrompt }
                ],
                temperature: expectJson ? 0.2 : 0.7,
                top_p: 0.95
            };

            const response = await fetch(CLAUDE_API_URL, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'x-api-key': apiKey,
                    'anthropic-version': '2023-06-01'
                },
                body: JSON.stringify(payload)
            });

            if (!response.ok) {
                const errorData = await response.json();
                const errorMessage = errorData.error?.message || `Erro ${response.status}`;

                if (response.status === 429 || response.status === 529 || response.status === 503 || errorMessage.toLowerCase().includes('rate') || errorMessage.toLowerCase().includes('overloaded')) {
                    logMessage('CLAUDE', `${accountDisplay} atingiu limite. Tentando próxima...`, 2);
                    lastError = errorMessage;
                    continue;
                }
                throw new Error(errorMessage);
            }

            const data = await response.json();

            // Claude retorna content como array: [{type: "text", text: "..."}]
            const textResponse = data.content?.[0]?.text;

            if (!textResponse) throw new Error("Resposta vazia da Claude.");

            // Log de uso de tokens
            if (data.usage) {
                logMessage('CLAUDE', `Tokens usados — Input: ${data.usage.input_tokens}, Output: ${data.usage.output_tokens}`, 2);
            }

            let finalData = textResponse;
            if (expectJson) {
                const cleanText = cleanMarkdownCodeBlock(textResponse);
                finalData = JSON.parse(cleanText);
            }

            return { success: true, data: finalData, source: `${accountDisplay} (${model})` };

        } catch (error) {
            logMessage('CLAUDE', `Erro na ${accountDisplay}: ${error.message}`, 2);
            lastError = error.message;
            const isRetryable = error.message.toLowerCase().includes('rate') ||
                                error.message.toLowerCase().includes('overloaded') ||
                                error.message.includes('429') ||
                                error.message.includes('529') ||
                                error.message.includes('503');
            if (!isRetryable) break;
        }
    }
    return { success: false, error: lastError || "Todas as contas Claude falharam." };
}

// -----------------------------------------------------------------------------
// LISTENER DE MENSAGENS
// -----------------------------------------------------------------------------

chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
    if (request.action === "aiRequest" || request.action === "geminiRequest") {
        const { 
            geminiKeys, groqKeys, openaiKeys, claudeKeys,
            systemInstruction, userPrompt, taskType, 
            groqModel, openaiModel, claudeModel,
            preferredProvider,
            apiUrl, useBackend, platform, proposalData
        } = request;
        const expectJson = (taskType === "FILTER_PROJECTS");

        (async () => {
            // ---------------------------------------------------------------
            // ROTA 0: BACKEND CENTRALIZADO (OPCIONAL)
            // ---------------------------------------------------------------
            if (useBackend && apiUrl && taskType === "GENERATE_PROPOSAL") {
                try {
                    logMessage('BACKGROUND', `Encaminhando para BACKEND: ${apiUrl}`, 1);
                    const response = await fetch(`${apiUrl}/api/proposals/generate`, {
                        method: 'POST',
                        headers: { 'Content-Type': 'application/json' },
                        body: JSON.stringify({
                            provider: preferredProvider,
                            model: preferredProvider === 'openai' ? openaiModel : claudeModel,
                            platform,
                            systemInstruction,
                            userPrompt,
                            proposalData,
                            userId: request.userId,
                            userName: request.userName
                        })
                    });

                    if (response.ok) {
                        const result = await response.json();
                        if (result.success) {
                            logMessage('BACKGROUND', `✅ Sucesso via Backend (Custo: $${result.cost})`, 1);
                            // Garante que o formato retornado é o que o content.js espera
                            const finalData = result.data || result;
                            sendResponse({ success: true, data: finalData });
                            return;
                        }
                    }
                    logMessage('BACKGROUND', `⚠️ Backend falhou ou retornou erro. Usando autonomia local...`, 1);
                } catch (error) {
                    logMessage('BACKGROUND', `❌ Erro ao conectar no Backend: ${error.message}. Usando autonomia local...`, 1);
                }
            }

            let result = { success: false, error: "Nenhuma chave configurada localmente ou backend indisponível." };

            // ---------------------------------------------------------------
            // ORDEM DE PRIORIDADE LOCAL (AUTONOMIA)
            // ---------------------------------------------------------------

            // Constrói a lista de providers na ordem de prioridade
            const providers = [];

            // Se o usuário selecionou um provider preferido, ele vai primeiro
            if (preferredProvider === 'openai' && openaiKeys?.length > 0) {
                providers.push({ type: 'openai', keys: openaiKeys, model: openaiModel || 'gpt-4o-mini' });
            }
            if (preferredProvider === 'claude' && claudeKeys?.length > 0) {
                providers.push({ type: 'claude', keys: claudeKeys, model: claudeModel || 'claude-haiku-4-5' });
            }
            if (preferredProvider === 'gemini' && geminiKeys?.length > 0) {
                providers.push({ type: 'gemini', keys: geminiKeys });
            }
            if (preferredProvider === 'groq' && groqKeys?.length > 0) {
                providers.push({ type: 'groq', keys: groqKeys, model: groqModel || 'llama-3.1-8b-instant' });
            }

            // Depois adiciona os demais como fallback (se não já adicionados)
            if (preferredProvider !== 'openai' && openaiKeys?.length > 0) {
                providers.push({ type: 'openai', keys: openaiKeys, model: openaiModel || 'gpt-4o-mini' });
            }
            if (preferredProvider !== 'claude' && claudeKeys?.length > 0) {
                providers.push({ type: 'claude', keys: claudeKeys, model: claudeModel || 'claude-haiku-4-5' });
            }
            if (preferredProvider !== 'gemini' && geminiKeys?.length > 0) {
                providers.push({ type: 'gemini', keys: geminiKeys });
            }
            if (preferredProvider !== 'groq' && groqKeys?.length > 0) {
                providers.push({ type: 'groq', keys: groqKeys, model: groqModel || 'llama-3.1-8b-instant' });
            }

            // ---------------------------------------------------------------
            // EXECUTA NA ORDEM DE PRIORIDADE COM FALLBACK AUTOMÁTICO
            // ---------------------------------------------------------------

            for (const provider of providers) {
                logMessage('BACKGROUND', `Tentando provider: ${provider.type.toUpperCase()}...`, 1);

                switch (provider.type) {
                    case 'openai':
                        result = await callOpenAIApi(provider.keys, provider.model, systemInstruction, userPrompt, expectJson);
                        break;
                    case 'claude':
                        result = await callClaudeApi(provider.keys, provider.model, systemInstruction, userPrompt, expectJson);
                        break;
                    case 'gemini':
                        result = await callGeminiApi(provider.keys, systemInstruction, userPrompt, expectJson);
                        break;
                    case 'groq':
                        result = await callGroqApi(provider.keys, provider.model, systemInstruction, userPrompt, expectJson);
                        break;
                }

                if (result.success) {
                    logMessage('BACKGROUND', `✅ Sucesso com ${provider.type.toUpperCase()}: ${result.source || result.account}`, 1);
                    sendResponse({ ...result, source: result.source || result.account });
                    return;
                }

                logMessage('BACKGROUND', `${provider.type.toUpperCase()} falhou. Tentando próximo provider...`, 2);
            }

            // Se chegou aqui, nada funcionou
            const hasAnyKey = providers.length > 0;
            const finalError = hasAnyKey
                ? `Todas as IAs configuradas falharam.\nDetalhe: ${result.error}`
                : "Sistema sem chaves. Por favor, cole suas chaves no menu de configurações e clique em Salvar.";

            sendResponse({ 
                success: false, 
                error: finalError
            });
        })();

        return true; 
    }
});