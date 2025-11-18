/**
 * content.js
 * 
 * Script injetado na página do 99Freelas.
 * Responsável por:
 * 1. Extrair dados do projeto (cliente, descrição, etc.) quando solicitado.
 * 2. Enviar os dados para o background script.
 * 3. Receber a resposta processada pela IA.
 * 4. Validar a resposta da IA de forma segura para evitar erros.
 * 5. Preencher os campos do formulário de proposta com os dados da IA.
 * 6. Registrar logs detalhados de todas as operações de automação.
 */

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
// FUNÇÕES DE EXTRAÇÃO E MANIPULAÇÃO DE DADOS
// -----------------------------------------------------------------------------

/**
 * Extrai os dados relevantes do projeto diretamente da página.
 * @returns {object|null} Um objeto com os dados ou null se a extração falhar.
 */
function extractData() {
    logMessage('AUTOMAÇÃO', 'Iniciando extração de dados da página...');
    
    // Tenta encontrar os elementos na página
    const nomeClienteElement = document.getElementsByClassName('name')[1];
    const descricaoProjetoElement = document.getElementsByClassName('item-text project-description formatted-text')[0];
    const valorTempoMedioElement = document.getElementsByClassName('generic information')[0];

    // Valida se os elementos essenciais foram encontrados
    if (!nomeClienteElement) {
        logMessage('AUTOMAÇÃO', 'ERRO: Elemento "nome do cliente" não encontrado na página.', 1);
        return null;
    }
    const nomeCliente = nomeClienteElement.innerText;
    logMessage('AUTOMAÇÃO', `Nome do Cliente encontrado: "${nomeCliente}"`, 1);

    if (!descricaoProjetoElement) {
        logMessage('AUTOMAÇÃO', 'ERRO: Elemento "descrição do projeto" não encontrado.', 1);
        return null;
    }
    const descricaoProjeto = descricaoProjetoElement.innerText;
    logMessage('AUTOMAÇÃO', 'Descrição do projeto encontrada.', 1);

    // Trata o campo de valor/tempo médio, que é opcional
    let valorTempoMedio;
    if (valorTempoMedioElement) {
        valorTempoMedio = valorTempoMedioElement.innerText;
        logMessage('AUTOMAÇÃO', `Valor/Tempo médio encontrado: "${valorTempoMedio}"`, 1);
    } else {
        valorTempoMedio = "Projeto não tem propostas o bastante para cálculo de valor/prazo médio. Estipule um de acordo com a descrição do projeto, sempre tendendo para baixos preços. Geralmente projetos para wordpress estão com valores menores do que 1000.";
        logMessage('AUTOMAÇÃO', 'Valor/Tempo médio não encontrado. Usando texto padrão.', 1);
    }

    logMessage('AUTOMAÇÃO', 'Extração de dados concluída com sucesso.');
    return { nomeCliente, descricaoProjeto, valorTempoMedio };
}

/**
 * Extrai o preço e o prazo de uma string de texto.
 * @param {string} inputString - O texto gerado pela IA.
 * @returns {{price: string|null, deadline: number|null}}
 */
function extractPriceAndDeadline(inputString) {
    const priceRegex = /R\$\s*([\d.]+(?:,\d{2})?)/;
    const deadlineRegex = /(\d+)\s+dias/;
    
    const priceMatch = inputString.match(priceRegex);
    const deadlineMatch = inputString.match(deadlineRegex);

    const price = priceMatch ? priceMatch[1] : null;
    const deadline = deadlineMatch ? parseInt(deadlineMatch[1], 10) : null;

    return { price, deadline };
}

/**
 * Limpa a string de caracteres de formatação Markdown.
 * @param {string} inputString - O texto original.
 * @returns {string} O texto limpo.
 */
function cleanString(inputString) {
    return inputString.replace(/\*\*|#/g, '');
}

/**
 * Formata um número para o padrão de moeda brasileiro (BRL).
 * @param {number} number - O número a ser formatado.
 * @returns {string} A string formatada.
 */
function formatToBrazilianCurrency(number) {
    return number.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

// -----------------------------------------------------------------------------
// LISTENER PRINCIPAL (COMUNICAÇÃO COM BACKGROUND SCRIPT)
// -----------------------------------------------------------------------------

chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
    // Verifica se a ação recebida é para iniciar a extração de dados.
    if (request.action === "extractData") {
        logMessage('AUTOMAÇÃO', 'Comando "extractData" recebido do background script.');
        const data = extractData();

        if (data) {
            logMessage('AUTOMAÇÃO', 'Enviando dados extraídos para o background script para requisição à IA.');
            chrome.runtime.sendMessage({ action: "makeRequest", ...data }, response => {
                logMessage('AUTOMAÇÃO', 'Resposta recebida do background script.');

                // --- VALIDAÇÃO DE SEGURANÇA APRIMORADA ---
                if (!response || !response.success) {
                    logMessage('AUTOMAÇÃO', `ERRO: A requisição falhou. Motivo: ${response?.error || 'Erro desconhecido.'}`, 1);
                    console.error("Objeto de resposta completo:", response);
                    return;
                }

                const candidate = response.data?.candidates?.[0];

                // 1. Verifica se existe um candidato na resposta.
                if (!candidate) {
                    logMessage('AUTOMAÇÃO', 'ERRO: A resposta da API não contém um "candidato" válido.', 1);
                    console.error("Objeto de resposta completo:", response.data);
                    return;
                }

                // 2. Verifica se a resposta foi bloqueada por SEGURANÇA.
                if (candidate.finishReason === "SAFETY") {
                    logMessage('AUTOMAÇÃO', 'ERRO CRÍTICO: A resposta foi bloqueada pela API por motivos de segurança.', 1);
                    logMessage('AUTOMAÇÃO', 'O prompt ou as instruções podem conter conteúdo sensível. Tente ajustar as instruções no popup.', 2);
                    console.error("Objeto de resposta completo:", response.data);
                    return;
                }

                // 3. Verifica se a resposta tem o conteúdo de texto esperado.
                const textContent = candidate.content?.parts?.[0]?.text;
                if (!textContent) {
                    logMessage('AUTOMAÇÃO', 'ERRO: Resposta da IA veio em um formato inesperado ou sem conteúdo de texto.', 1);
                    logMessage('AUTOMAÇÃO', `Razão de finalização: ${candidate.finishReason || 'Não especificada'}.`, 2);
                    console.error("Objeto de resposta completo:", response.data);
                    return;
                }
                // --- FIM DA VALIDAÇÃO ---

                logMessage('AUTOMAÇÃO', 'Resposta da IA validada com sucesso. Processando dados...', 1);
                
                // Extrai e preenche os campos do formulário
                const proposta = cleanString(textContent);
                const { price, deadline } = extractPriceAndDeadline(proposta);

                const resultadoDiv = document.getElementById('proposta');
                const ofertaFinal = document.getElementById('oferta-final');
                const oferta = document.getElementById('oferta');
                const duracaoEstimada = document.getElementById('duracao-estimada');

                logMessage('AUTOMAÇÃO', 'Iniciando preenchimento do formulário...');
                if (price) {
                    const priceStringUSFormat = price.replace(/\./g, '').replace(',', '.');
                    const priceNumber = parseFloat(priceStringUSFormat);

                    if (!isNaN(priceNumber)) {
                        const calculatedValue = (priceNumber / 1.17648);
                        const calculatedValueBrazilianFormat = formatToBrazilianCurrency(calculatedValue);

                        oferta.value = calculatedValueBrazilianFormat;
                        logMessage('AUTOMAÇÃO', `Campo 'oferta' preenchido com: ${calculatedValueBrazilianFormat}`, 1);
                        ofertaFinal.value = price;
                        logMessage('AUTOMAÇÃO', `Campo 'oferta-final' preenchido com: ${price}`, 1);
                    } else {
                        logMessage('AUTOMAÇÃO', `ERRO: Não foi possível converter o preço extraído ("${price}") para um número.`, 1);
                    }
                } else {
                    logMessage('AUTOMAÇÃO', 'ERRO: Preço não encontrado na resposta da IA.', 1);
                }

                if (deadline) {
                    duracaoEstimada.value = deadline;
                    logMessage('AUTOMAÇÃO', `Campo 'duracao-estimada' preenchido com: ${deadline}`, 1);
                } else {
                    logMessage('AUTOMAÇÃO', 'ERRO: Prazo não encontrado na resposta da IA.', 1);
                }
                
                resultadoDiv.value = proposta;
                logMessage('AUTOMAÇÃO', 'Campo \'proposta\' preenchido.', 1);
                logMessage('AUTOMAÇÃO', 'Preenchimento do formulário concluído.');

            });
        } else {
            logMessage('AUTOMAÇÃO', 'Extração de dados falhou. A operação foi cancelada.');
        }
    }
});