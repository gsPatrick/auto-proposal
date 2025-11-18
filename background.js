/**
 * background.js
 * 
 * Script de serviço da extensão Chrome.
 * Responsável por:
 * 1. Ouvir por comandos de atalho para iniciar a extração de dados.
 * 2. Receber dados do content script.
 * 3. Fazer a requisição para a API do Google Gemini com os dados e credenciais.
 * 4. Retornar a resposta da API para o content script.
 * 5. Registrar logs detalhados de todas as operações.
 */

// URL base da API do Gemini. A chave será adicionada posteriormente.
const API_URL = "https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key=";

// -----------------------------------------------------------------------------
// FUNÇÃO DE LOGGING PADRONIZADA
// -----------------------------------------------------------------------------

/**
 * Gera uma mensagem de log formatada no console.
 * @param {string} context - O contexto da mensagem (ex: 'SISTEMA', 'IA', 'AUTOMAÇÃO').
 * @param {string} message - A mensagem de log a ser exibida.
 * @param {number} [indentLevel=0] - O nível de indentação para logs de subprocessos.
 */
function logMessage(context, message, indentLevel = 0) {
    const now = new Date();
    const timestamp = `[${now.getHours().toString().padStart(2, '0')}:${now.getMinutes().toString().padStart(2, '0')}:${now.getSeconds().toString().padStart(2, '0')}]`;
    const indentation = '  '.repeat(indentLevel);
    console.log(`${timestamp} | [${context}] ${indentation}-> ${message}`);
}

// -----------------------------------------------------------------------------
// LISTENER DE MENSAGENS (COMUNICAÇÃO COM CONTENT SCRIPT)
// -----------------------------------------------------------------------------

// Ouve por mensagens vindas de outras partes da extensão, como o content script.
chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
    // Verifica se a ação solicitada é para fazer a requisição à API.
    if (request.action === "makeRequest") {
        logMessage('SISTEMA', 'Recebida solicitação "makeRequest" do content script.');

        // 1. Validação dos dados recebidos do content script.
        const { nomeCliente, descricaoProjeto, valorTempoMedio } = request;
        if (!nomeCliente || !descricaoProjeto || !valorTempoMedio) {
            logMessage('SISTEMA', 'ERRO: Dados da solicitação estão incompletos.', 1);
            sendResponse({ success: false, error: "Dados incompletos para a requisição (cliente, descrição ou valores)." });
            return true; // Indica resposta assíncrona
        }
        logMessage('SISTEMA', 'Dados da solicitação validados com sucesso.', 1);

        // 2. Busca das credenciais (API Key e Instruções) no armazenamento local da extensão.
        logMessage('SISTEMA', 'Buscando credenciais (API Key e Instruções) no storage...', 1);
        chrome.storage.local.get(['apiKey', 'instructions'], (result) => {
            const { apiKey, instructions } = result;

            // 3. Validação das credenciais carregadas.
            if (!apiKey || !instructions) {
                logMessage('SISTEMA', 'ERRO: API Key ou Instruções não encontradas no storage.', 2);
                sendResponse({ success: false, error: "Chave API ou Instruções não definidas. Por favor, configure-as na extensão." });
                return; // Encerra a execução aqui pois não é possível continuar.
            }
            logMessage('SISTEMA', 'Credenciais carregadas com sucesso.', 2);

            // 4. Se tudo estiver correto, executa a requisição à API.
            makeApiRequest(apiKey, instructions, nomeCliente, descricaoProjeto, valorTempoMedio, sendResponse);
        });

        // Retorna true para indicar que a função sendResponse será chamada de forma assíncrona.
        return true;
    }
});

// -----------------------------------------------------------------------------
// FUNÇÃO DE REQUISIÇÃO À API
// -----------------------------------------------------------------------------

/**
 * Monta e executa a chamada para a API do Google Gemini.
 * @param {string} apiKey - A chave de API do usuário.
 * @param {string} instructions - As instruções de sistema para a IA.
 * @param {string} nomeCliente - O nome do cliente do projeto.
 * @param {string} descricaoProjeto - A descrição do projeto.
 * @param {string} valorTempoMedio - Informações sobre valor e tempo médio.
 * @param {function} sendResponse - A função de callback para enviar a resposta de volta ao content script.
 */
function makeApiRequest(apiKey, instructions, nomeCliente, descricaoProjeto, valorTempoMedio, sendResponse) {
    const fullUrl = API_URL + apiKey;
    const prompt = `Descrição do Projeto: ${descricaoProjeto}\nNome do Cliente: ${nomeCliente}\n${valorTempoMedio}`;
    
    logMessage('IA', 'Iniciando requisição para a API do Gemini...');
    logMessage('IA', `Endpoint: ${API_URL.split('?')[0]}`, 1);
    logMessage('IA', 'Configurações de segurança definidas como "BLOCK_ONLY_HIGH".', 1); // Log da nova configuração

    fetch(fullUrl, {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json',
        },
        body: JSON.stringify({
            // O conteúdo principal (prompt) enviado para a IA.
            contents: [{
                parts: [{ text: prompt }]
            }],
            // Instrução de sistema que define o comportamento da IA.
            systemInstruction: {
                parts: [{ text: instructions }]
            },
            // Configurações de geração de conteúdo.
            generationConfig: {
                temperature: 1,
                topK: 1,
                topP: 1,
                maxOutputTokens: 65536
            },
            // Configurações de segurança para evitar conteúdo nocivo.
            // **MUDANÇA APLICADA AQUI**
            safetySettings: [
                { category: "HARM_CATEGORY_HARASSMENT", threshold: "BLOCK_ONLY_HIGH" },
                { category: "HARM_CATEGORY_HATE_SPEECH", threshold: "BLOCK_ONLY_HIGH" },
                { category: "HARM_CATEGORY_SEXUALLY_EXPLICIT", threshold: "BLOCK_ONLY_HIGH" },
                { category: "HARM_CATEGORY_DANGEROUS_CONTENT", threshold: "BLOCK_ONLY_HIGH" }
            ]
        })
    })
    .then(response => {
        // Se a resposta HTTP não for bem-sucedida (ex: erro 400, 500), trata o erro.
        if (!response.ok) {
            return response.json().then(errorData => {
                const errorMessage = `HTTP ${response.status}: ${JSON.stringify(errorData.error?.message || errorData)}`;
                logMessage('IA', `ERRO na resposta da API: ${errorMessage}`, 1);
                // Propaga o erro para o bloco .catch()
                throw new Error(errorMessage);
            });
        }
        // Se a resposta for bem-sucedida, converte o corpo para JSON.
        return response.json();
    })
    .then(data => {
        // Envia os dados recebidos com sucesso de volta para o content script.
        logMessage('IA', 'SUCESSO: Resposta da API recebida e processada.', 1);
        sendResponse({ success: true, data: data });
    })
    .catch(error => {
        // Captura qualquer erro ocorrido durante o fetch (rede, parsing, etc.).
        logMessage('IA', `FALHA GERAL na requisição: ${error.message}`, 1);
        console.error(error); // Loga o objeto de erro completo para debugging avançado.
        sendResponse({ success: false, error: error.message });
    });
}

// -----------------------------------------------------------------------------
// LISTENER DE COMANDOS (ATALHOS DE TECLADO)
// -----------------------------------------------------------------------------

// Ouve por comandos definidos no manifest.json (ex: atalhos de teclado).
chrome.commands.onCommand.addListener((command) => {
  if (command === "run-extraction") {
    logMessage('SISTEMA', 'Comando de atalho "run-extraction" recebido.');
    // Procura pela aba ativa na janela atual.
    chrome.tabs.query({active: true, currentWindow: true}, (tabs) => {
      if (tabs.length > 0) {
          // Envia uma mensagem para o content script da aba ativa para iniciar a extração.
          logMessage('SISTEMA', `Enviando mensagem "extractData" para a aba ativa (ID: ${tabs[0].id}).`, 1);
          chrome.tabs.sendMessage(tabs[0].id, { action: "extractData" });
      } else {
          logMessage('SISTEMA', 'ERRO: Nenhuma aba ativa encontrada para enviar o comando.', 1);
      }
    });
  }
});