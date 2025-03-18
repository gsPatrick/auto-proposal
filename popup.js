const saveButton = document.getElementById('save-button');
const statusLabel = document.getElementById('status')

saveButton.addEventListener('click', () => {
    const apiKey = document.getElementById("api-key").value;
    const instructions = document.getElementById('instructions').value;

    chrome.storage.local.set({ apiKey: apiKey, instructions: instructions }, () => {
        alert('Configurações salvas com sucesso!');
    });
    statusLabel.innerText = ""
});

chrome.storage.local.get(['apiKey', 'instructions'], (result) => {
    if (result.apiKey) {
        document.getElementById("api-key").value = result.apiKey;
    } else {
        statusLabel.innerText = "Chave API não encontrada, insira uma."
    }
    if (result.instructions) {
        document.getElementById("instructions").value = result.instructions;
    }
});