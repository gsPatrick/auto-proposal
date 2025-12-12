/**
 * Função principal para extrair dados dos projetos
 */
async function extrairDadosProjetos() {
    // Seleciona todos os cards de projeto na página
    const cards = document.querySelectorAll('fl-project-contest-card.ProjectCard');
    const dadosExtraidos = [];

    console.log(`Iniciando extração de ${cards.length} projetos...`);

    // Função auxiliar para esperar um tempo (promisified setTimeout)
    const esperar = (ms) => new Promise(resolve => setTimeout(resolve, ms));

    // Iteramos sobre cada card usando for...of para permitir o uso de 'await'
    for (const card of cards) {
        try {
            // --- 1. LÓGICA DE INTERAÇÃO (Clicar no 'Read More') ---

            // Seleciona o parágrafo da descrição
            const paragrafoDescricao = card.querySelector('p.mb-xxsmall');

            if (paragrafoDescricao) {
                // Verifica se o botão existe dentro do parágrafo
                const botaoMore = paragrafoDescricao.querySelector('.ReadMoreButton');

                if (botaoMore) {
                    // Clica no botão
                    botaoMore.click();

                    // Aguarda 100ms para o DOM atualizar (Angular/React precisam de um "tick")
                    // Se a página for lenta, aumente para 300 ou 500
                    await esperar(150);
                }
            }

            // --- 2. EXTRAÇÃO DE DADOS ---

            // Nome do Projeto
            const elTitulo = card.querySelector('.Title-text');
            const titulo = elTitulo ? elTitulo.innerText.trim() : "Sem Título";

            // Budget
            const elBudget = card.querySelector('.BudgetUpgradeWrapper-budget');
            let budget = "N/A";
            if (elBudget) {
                // Remove a palavra "Budget" e espaços extras
                budget = elBudget.innerText.replace(/Budget/i, '').trim();
            }

            // Bid Média
            const elBid = card.querySelector('.AverageBid-amount');
            const bidMedia = elBid ? elBid.innerText.trim() : "Sem lances";

            // Descrição Completa (agora expandida)
            // Pegamos o texto do parágrafo. O innerText geralmente ignora tags ocultas,
            // mas pode pegar o texto do botão "less" se ele aparecer. 
            let descricao = "";
            if (paragrafoDescricao) {
                // Clonamos o nó para poder remover o botão antes de ler o texto, 
                // caso queira o texto puríssimo sem a palavra "less" ou "more"
                const cloneDesc = paragrafoDescricao.cloneNode(true);
                const btnNoClone = cloneDesc.querySelector('button');
                if (btnNoClone) btnNoClone.remove();

                descricao = cloneDesc.innerText.trim();
            }

            // --- 3. MONTAGEM DO OBJETO ---
            dadosExtraidos.push({
                projeto: titulo,
                orcamento: budget,
                lance_medio: bidMedia,
                descricao: descricao
            });

        } catch (erro) {
            console.error("Erro ao processar um card:", erro);
        }
    }

    return dadosExtraidos;
}

// --- EXECUÇÃO ---
extrairDadosProjetos().then(dados => {
    console.log("Extração concluída!");
    console.log(dados);

    // Opcional: Copiar para a área de transferência como JSON string
    // copy(dados); 
});