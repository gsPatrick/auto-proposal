// Função para extrair dados da página (adapte para sua página!)
function extractData() {
    const nomeCliente = document.getElementsByClassName('name')[1].innerText;
    const descricaoProjeto = document.getElementsByClassName('item-text project-description formatted-text')[0].innerText;
    const valorTempoMedio = document.getElementsByClassName('generic information')[0].innerText;

    if (nomeCliente && descricaoProjeto && valorTempoMedio) {
      return { nomeCliente, descricaoProjeto, valorTempoMedio };
    } else {
      console.error('Não foi possível encontrar todos os dados necessários na página.');
      return null; // Ou lança um erro.
    }
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
          const resultadoDiv = document.getElementById('proposta')
          resultadoDiv.value = response.data.candidates[0].content.parts[0].text;
        } else {
          console.error("Erro ao fazer a requisição:", response.error);
          console.error(response);
          
        }
      });
    }
  }
});