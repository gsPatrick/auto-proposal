// Função para extrair dados da página (adapte para sua página!)
function extractData() {
  const nomeCliente = document.getElementsByClassName('name')[1].innerText;
  const descricaoProjeto = document.getElementsByClassName('item-text project-description formatted-text')[0].innerText;
  const valorTempoMedio = document.getElementsByClassName('generic information')[0].innerText;

  if (!nomeCliente || !descricaoProjeto || !valorTempoMedio) {
      console.error('Não foi possível encontrar todos os elementos necessários na página.');
      return null;
  }

  if (!nomeCliente || !descricaoProjeto || !valorTempoMedio) {
      console.error('Um ou mais dados extraídos estão vazios.');
      return null;
  }

  return { nomeCliente, descricaoProjeto, valorTempoMedio };
}

function extractPriceAndDeadline(inputString) {
  // Extrai o preço (R$ com ponto para milhares e vírgula para centavos)
  const priceRegex = /R\$\s*([\d.]+(?:,\d{2})?)/;
  const priceMatch = inputString.match(priceRegex);
  const price = priceMatch ? priceMatch[1] : null;

  // Extrai o prazo (número seguido de "dias")
  const deadlineRegex = /(\d+)\s+dias/;
  const deadlineMatch = inputString.match(deadlineRegex);
  const deadline = deadlineMatch ? parseInt(deadlineMatch[1], 10) : null;

  return { price, deadline };
}


function cleanString(inputString) {
  // Remove todos os "**" (dois asteriscos) da string.
  const withoutBold = inputString.replace(/\*\*/g, '');

  // Remove todos os "#" (cerquilhas) da string.
  const withoutHashtags = withoutBold.replace(/#/g, '');

  return withoutHashtags;
}

// Function to format a number to Brazilian currency format
function formatToBrazilianCurrency(number) {
  return number.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

// Listener para mensagens do background script
chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
  if (request.action === "extractData") {
    const data = extractData();
    if (data) {
      chrome.runtime.sendMessage({
        action: "makeRequest",
        nomeCliente: data.nomeCliente,
        descricaoProjeto: data.descricaoProjeto,
        valorTempoMedio: data.valorTempoMedio,
      }, response => {
        if (response.success) {
          const resultadoDiv = document.getElementById('proposta');
          const ofertaFinal = document.getElementById('oferta-final');
          const oferta = document.getElementById('oferta');
          const duracaoEstimada = document.getElementById('duracao-estimada');
          const proposta = cleanString(response.data.candidates[0].content.parts[0].text);
          const { price, deadline } = extractPriceAndDeadline(proposta);

          // Check if price is not null before processing
          if (price) {
            // Replace dots with empty string and commas with dots
            const priceStringUSFormat = price.replace(/\./g, '').replace(',', '.');
            const priceNumber = parseFloat(priceStringUSFormat);

            if (!isNaN(priceNumber)) {
              const calculatedValue = (priceNumber / 1.17648);
              console.log(calculatedValue);

              // Format the calculated value to Brazilian currency format
              const calculatedValueBrazilianFormat = formatToBrazilianCurrency(calculatedValue);

              oferta.value = calculatedValueBrazilianFormat;
              ofertaFinal.value = price;
              duracaoEstimada.value = deadline;
              resultadoDiv.value = proposta;
            } else {
              console.error("Erro: Não foi possível converter o preço para um número.");
              console.error("Preço original:", price);
            }
          } else {
            console.error("Erro: Preço não encontrado na string.");
          }
        } else {
          console.error("Erro ao fazer a requisição:", response.error);
          console.error(response);
          
        }
      });
    }
  }
});
