const url = "https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:generateContent?key=";
let apiKey;
let instructions;

// Listener para mensagens do content script (fazer a requisição)
chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
    if (request.action === "makeRequest") {
        if (!request.nomeCliente || !request.descricaoProjeto || !request.valorTempoMedio) {
            console.error('Para fazer a requisição, é necessário o nome do cliente, a descrição do projeto, o valor médio das propostas e o tempo médio das propostas, algum desses valores não foi encontrado.');
            sendResponse({ success: false, error: "Dados incompletos para a requisição." });
            return true; // Indica resposta assíncrona
        }

        // Verifica se apiKey e instructions estão definidas
        if (!apiKey || !instructions) {
            // Tenta carregar do storage
            chrome.storage.local.get(['apiKey', 'instructions'], (result) => {
                if (result.apiKey && result.instructions) {
                    apiKey = result.apiKey;
                    instructions = result.instructions;
                    makeApiRequest(request, sendResponse); // Faz a requisição
                } else {
                    console.error('Chave API ou Instruções vazias.  Por favor, preencha-os no popup.');
                    sendResponse({ success: false, error: "Chave API ou Instruções vazias." });
                }
                return true;
            });
            return true;

        } else {
            makeApiRequest(request, sendResponse); // Faz a requisição
            return true;
        }
    }
});


function makeApiRequest(request, sendResponse) {
    fetch(url + apiKey, {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json',
        },
        body: JSON.stringify({
            contents: [{
                parts: [{ text: `Descrição do Projeto: ${request.descricaoProjeto}\nNome do Cliente: ${request.nomeCliente}\n${request.valorTempoMedio}` }]
            }],
            generationConfig: {
                temperature: 0.9,
                topK: 1,
                topP: 1,
                maxOutputTokens: 2048
            },
            safetySettings: [
                {
                    category: "HARM_CATEGORY_HARASSMENT",
                    threshold: "BLOCK_MEDIUM_AND_ABOVE"
                },
                {
                    category: "HARM_CATEGORY_HATE_SPEECH",
                    threshold: "BLOCK_MEDIUM_AND_ABOVE"
                },
                {
                    category: "HARM_CATEGORY_SEXUALLY_EXPLICIT",
                    threshold: "BLOCK_MEDIUM_AND_ABOVE"
                },
                {
                    category: "HARM_CATEGORY_DANGEROUS_CONTENT",
                    threshold: "BLOCK_MEDIUM_AND_ABOVE"
                }
            ],
            tools: [],
            systemInstruction: {
                parts: [{text:instructions}]
            }
        })
    })
    .then(response => {
        if (!response.ok) {
            return response.json().then(errorData => {
                throw new Error(`Erro na requisição: ${response.status} - ${JSON.stringify(errorData)}`);
            });
        }
        return response.json();
    })
    .then(data => {
        sendResponse({ success: true, data: data });
    })
    .catch(error => {
        console.error("Erro na requisição:", error);
        sendResponse({ success: false, error: error.message });
    });
}

// Listener para o comando (atalho)
chrome.commands.onCommand.addListener((command) => {
  if (command === "run-extraction") {
    // Envia mensagem para o content script da aba ativa
    chrome.tabs.query({active: true, currentWindow: true}, (tabs) => {
      if (tabs.length > 0) { // Verifica se há uma aba ativa
          chrome.tabs.sendMessage(tabs[0].id, { action: "extractData" });
      } else {
          console.error("Nenhuma aba ativa encontrada."); //Caso não haja aba ativa
      }
    });
  }
});