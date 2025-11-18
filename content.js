/**
 * content.js
 * 
 * Versão: 3.0 (macOS Design System)
 * - Z-Index Máximo (Acima do Zendesk)
 * - Glassmorphism Real (Blur + Saturation)
 * - UI Cinematográfica
 */

// -----------------------------------------------------------------------------
// CONSTANTES & ESTADO GLOBAL
// -----------------------------------------------------------------------------

const STATE = {
    isSidebarOpen: false,
    isHoveringEdge: false,
    scrapedProjects: [],
    settings: {
        apiKey: '',
        filterPrompt: 'Você é um filtro de projetos experiente. Analise a lista de projetos abaixo e selecione apenas aqueles que se encaixam no perfil de um Desenvolvedor Fullstack Sênior (Node.js, React, Python). Ignore projetos de design puro, marketing ou redação. Retorne APENAS um JSON array com os IDs dos projetos selecionados, sem explicações.',
        proposalPrompt: 'Você é um especialista em vendas consultivas. Escreva uma proposta comercial curta, direta e persuasiva para o projeto abaixo. Foque em resolver o problema do cliente. Use tom profissional mas próximo. Não coloque placeholders.'
    }
};

// -----------------------------------------------------------------------------
// 1. INJEÇÃO DE ESTILOS (CSS - MACOS STYLE)
// -----------------------------------------------------------------------------

function injectStyles() {
    if (document.getElementById('ap-styles')) return;

    const style = document.createElement('style');
    style.id = 'ap-styles';
    style.textContent = `
        /* --- FONTES & RESET --- */
        @import url('https://fonts.googleapis.com/css2?family=Inter:wght@300;400;500;600;700&display=swap');

        :root {
            /* Palette macOS Dark */
            --ap-glass-bg: rgba(20, 20, 25, 0.65); /* Transparência profunda */
            --ap-glass-border: rgba(255, 255, 255, 0.12);
            --ap-glass-highlight: rgba(255, 255, 255, 0.05);
            
            --ap-text-primary: #ffffff;
            --ap-text-secondary: rgba(255, 255, 255, 0.55);
            
            --ap-accent-gradient: linear-gradient(135deg, #0A84FF 0%, #007AFF 100%);
            --ap-accent-color: #0A84FF;
            
            --ap-shadow-elevation: 0 20px 50px rgba(0,0,0,0.6);
            --ap-shadow-subtle: 0 4px 12px rgba(0,0,0,0.2);
            
            --ap-radius-lg: 18px;
            --ap-radius-md: 12px;
            --ap-radius-sm: 8px;
            
            --ap-font: -apple-system, BlinkMacSystemFont, "Inter", "Segoe UI", sans-serif;
            --ap-ease: cubic-bezier(0.32, 0.72, 0, 1);
        }

        /* --- SIDEBAR CONTAINER --- */
        #ap-sidebar {
            position: fixed;
            top: 0;
            right: -420px; /* Escondido */
            width: 420px;
            height: 100vh;
            
            /* O Segredo do Glassmorphism */
            background: var(--ap-glass-bg);
            backdrop-filter: blur(50px) saturate(180%);
            -webkit-backdrop-filter: blur(50px) saturate(180%);
            
            border-left: 1px solid var(--ap-glass-border);
            box-shadow: var(--ap-shadow-elevation);
            
            z-index: 2147483647; /* MAX INT - Acima de tudo (Zendesk, etc) */
            transition: right 0.5s var(--ap-ease);
            
            display: flex;
            flex-direction: column;
            font-family: var(--ap-font);
            -webkit-font-smoothing: antialiased;
            color: var(--ap-text-primary);
        }

        #ap-sidebar.open {
            right: 0;
        }

        /* --- HANDLE (GATILHO) --- */
        #ap-sidebar-handle {
            position: absolute;
            left: -24px; /* Mais discreto */
            top: 50%;
            transform: translateY(-50%) scale(0.8);
            width: 48px;
            height: 96px;
            
            background: rgba(30, 30, 35, 0.8);
            backdrop-filter: blur(20px);
            border: 1px solid var(--ap-glass-border);
            border-radius: 24px; /* Pill shape */
            
            display: flex;
            align-items: center;
            justify-content: flex-start;
            padding-left: 8px;
            
            cursor: pointer;
            opacity: 0;
            transition: all 0.3s var(--ap-ease);
            pointer-events: none;
            box-shadow: 0 4px 20px rgba(0,0,0,0.3);
        }

        #ap-sidebar-handle.visible {
            opacity: 1;
            pointer-events: all;
            transform: translateY(-50%) translateX(-12px) scale(1);
        }

        #ap-sidebar-handle:hover {
            background: rgba(50, 50, 60, 0.9);
            transform: translateY(-50%) translateX(-16px) scale(1.05);
            border-color: var(--ap-accent-color);
        }

        /* --- HEADER --- */
        .ap-header {
            padding: 24px 28px;
            display: flex;
            justify-content: space-between;
            align-items: center;
            border-bottom: 1px solid var(--ap-glass-border);
            background: rgba(255, 255, 255, 0.02);
        }

        .ap-header h2 {
            margin: 0;
            font-size: 18px;
            font-weight: 600;
            letter-spacing: -0.02em;
            background: linear-gradient(to right, #fff, #ccc);
            -webkit-background-clip: text;
            -webkit-text-fill-color: transparent;
        }

        .ap-icon-btn {
            background: transparent;
            border: none;
            color: var(--ap-text-secondary);
            cursor: pointer;
            padding: 8px;
            border-radius: 50%;
            transition: all 0.2s;
            display: flex;
            align-items: center;
            justify-content: center;
        }

        .ap-icon-btn:hover {
            background: rgba(255,255,255,0.1);
            color: #fff;
            transform: rotate(15deg);
        }

        /* --- CONTENT AREA --- */
        .ap-content {
            flex: 1;
            overflow-y: auto;
            padding: 24px;
            display: flex;
            flex-direction: column;
            gap: 16px;
        }
        
        .ap-content::-webkit-scrollbar {
            width: 6px;
        }
        .ap-content::-webkit-scrollbar-track {
            background: transparent;
        }
        .ap-content::-webkit-scrollbar-thumb {
            background: rgba(255,255,255,0.15);
            border-radius: 10px;
        }
        .ap-content::-webkit-scrollbar-thumb:hover {
            background: rgba(255,255,255,0.25);
        }

        .ap-empty-state {
            margin-top: 80px;
            text-align: center;
            color: var(--ap-text-secondary);
            font-size: 14px;
            line-height: 1.6;
            padding: 0 20px;
        }

        /* --- PROJECT CARDS (CINEMATIC) --- */
        .ap-card {
            background: rgba(255, 255, 255, 0.03);
            border: 1px solid var(--ap-glass-border);
            border-radius: var(--ap-radius-md);
            padding: 18px;
            cursor: pointer;
            transition: all 0.3s var(--ap-ease);
            position: relative;
            overflow: hidden;
        }

        .ap-card::before {
            content: '';
            position: absolute;
            top: 0; left: 0; right: 0; bottom: 0;
            background: linear-gradient(180deg, rgba(255,255,255,0.05) 0%, transparent 100%);
            opacity: 0;
            transition: opacity 0.3s;
        }

        .ap-card:hover {
            background: rgba(255, 255, 255, 0.07);
            transform: translateY(-2px) scale(1.01);
            border-color: rgba(255, 255, 255, 0.2);
            box-shadow: 0 8px 24px rgba(0,0,0,0.2);
        }

        .ap-card:hover::before {
            opacity: 1;
        }

        .ap-card-title {
            font-size: 15px;
            font-weight: 600;
            color: #5AA9FF; /* Azul mais claro para contraste */
            margin-bottom: 10px;
            line-height: 1.3;
            letter-spacing: -0.01em;
        }

        .ap-card-desc {
            font-size: 13px;
            color: rgba(255, 255, 255, 0.8);
            line-height: 1.5;
            display: -webkit-box;
            -webkit-line-clamp: 3;
            -webkit-box-orient: vertical;
            overflow: hidden;
            transition: max-height 0.6s var(--ap-ease);
            max-height: 60px;
        }

        .ap-card:hover .ap-card-desc {
            -webkit-line-clamp: unset;
            max-height: 600px;
            transition-delay: 0.4s;
            color: #fff;
        }

        /* --- FOOTER & BUTTONS --- */
        .ap-footer {
            padding: 24px;
            border-top: 1px solid var(--ap-glass-border);
            background: rgba(0,0,0,0.2);
        }

        .ap-btn-primary {
            width: 100%;
            padding: 14px;
            background: var(--ap-accent-gradient);
            color: white;
            border: none;
            border-radius: var(--ap-radius-md);
            font-weight: 600;
            font-size: 14px;
            letter-spacing: -0.01em;
            cursor: pointer;
            transition: all 0.2s;
            box-shadow: 0 4px 12px rgba(10, 132, 255, 0.3);
            position: relative;
            overflow: hidden;
        }

        .ap-btn-primary:hover {
            box-shadow: 0 6px 20px rgba(10, 132, 255, 0.5);
            transform: translateY(-1px);
        }
        
        .ap-btn-primary:active {
            transform: scale(0.98);
        }

        .ap-btn-loading {
            filter: grayscale(0.5);
            opacity: 0.8;
            cursor: not-allowed;
        }

        /* --- MODAL SETTINGS (COMPACT & MODERN) --- */
        #ap-modal-overlay {
            position: fixed;
            top: 0; left: 0; right: 0; bottom: 0;
            background: rgba(0,0,0,0.4);
            backdrop-filter: blur(8px);
            z-index: 2147483648; /* Acima da Sidebar */
            display: none;
            align-items: center;
            justify-content: center;
            opacity: 0;
            transition: opacity 0.3s;
        }

        #ap-modal-overlay.show {
            display: flex;
            opacity: 1;
        }

        .ap-modal {
            background: #1e1e1e; /* Solid dark for modal readability */
            width: 420px;
            border-radius: var(--ap-radius-lg);
            border: 1px solid rgba(255,255,255,0.15);
            box-shadow: 0 25px 60px rgba(0,0,0,0.5);
            padding: 28px;
            display: flex;
            flex-direction: column;
            gap: 20px;
            color: #fff;
            transform: scale(0.95);
            transition: transform 0.3s var(--ap-ease);
        }
        
        #ap-modal-overlay.show .ap-modal {
            transform: scale(1);
        }

        .ap-modal-header {
            display: flex;
            justify-content: space-between;
            align-items: center;
            margin-bottom: 8px;
        }
        
        .ap-modal-header h3 {
            margin: 0;
            font-size: 16px;
            font-weight: 600;
        }

        .ap-input-group {
            display: flex;
            flex-direction: column;
            gap: 8px;
        }

        .ap-input-group label {
            font-size: 11px;
            text-transform: uppercase;
            color: var(--ap-text-secondary);
            font-weight: 700;
            letter-spacing: 0.8px;
        }

        .ap-input, .ap-textarea {
            background: rgba(0,0,0,0.3);
            border: 1px solid rgba(255,255,255,0.1);
            border-radius: 8px;
            padding: 12px;
            color: white;
            font-family: var(--ap-font);
            font-size: 13px;
            transition: border 0.2s;
        }

        .ap-input:focus, .ap-textarea:focus {
            outline: none;
            border-color: var(--ap-accent-color);
            background: rgba(0,0,0,0.5);
        }

        .ap-textarea {
            min-height: 80px;
            line-height: 1.4;
        }

        /* --- TOAST (PILL) --- */
        #ap-toast {
            position: fixed;
            top: 32px;
            left: 50%;
            transform: translateX(-50%) translateY(-100px);
            background: rgba(30, 30, 30, 0.9);
            backdrop-filter: blur(10px);
            color: white;
            padding: 10px 24px;
            border-radius: 30px;
            box-shadow: 0 8px 24px rgba(0,0,0,0.3);
            display: flex;
            align-items: center;
            gap: 10px;
            z-index: 2147483649;
            transition: transform 0.5s var(--ap-ease);
            font-size: 13px;
            font-weight: 500;
            border: 1px solid rgba(255,255,255,0.1);
        }
        
        #ap-toast.show {
            transform: translateX(-50%) translateY(0);
        }
    `;
    document.head.appendChild(style);
}

// -----------------------------------------------------------------------------
// 2. COMPONENTES DE UI (DOM)
// -----------------------------------------------------------------------------

function createSidebar() {
    if (document.getElementById('ap-sidebar')) return;

    const sidebar = document.createElement('div');
    sidebar.id = 'ap-sidebar';
    sidebar.innerHTML = `
        <!-- Handle (Pill Style) -->
        <div id="ap-sidebar-handle" title="Abrir Auto-Proposal">
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#fff" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><polyline points="15 18 9 12 15 6"></polyline></svg>
        </div>

        <!-- Header -->
        <div class="ap-header">
            <h2>Projetos em Potencial</h2>
            <button id="ap-settings-btn" class="ap-icon-btn" title="Configurações">
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="3"></circle><path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1 0 2.83 2 2 0 0 1-2.83 0l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-2 2 2 2 0 0 1-2-2v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83 0 2 2 0 0 1 0-2.83l.06-.06a1.65 1.65 0 0 0 .33-1.82 1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1-2-2 2 2 0 0 1 2-2h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 0-2.83 2 2 0 0 1 2.83 0l.06.06a1.65 1.65 0 0 0 1.82.33H9a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 2-2 2 2 0 0 1 2 2v.09a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 2 2 2 2 0 0 1-2 2h-.09a1.65 1.65 0 0 0-1.51 1z"></path></svg>
            </button>
        </div>

        <!-- Content -->
        <div id="ap-project-list" class="ap-content">
            <div class="ap-empty-state">
                <svg width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="rgba(255,255,255,0.2)" stroke-width="1" stroke-linecap="round" stroke-linejoin="round" style="margin-bottom: 16px;"><rect x="2" y="3" width="20" height="14" rx="2" ry="2"></rect><line x1="8" y1="21" x2="16" y2="21"></line><line x1="12" y1="17" x2="12" y2="21"></line></svg>
                <p>Nenhum projeto analisado.</p>
                <p>Clique em <b>"Analisar Página"</b> para a IA encontrar as melhores oportunidades.</p>
            </div>
        </div>

        <!-- Footer -->
        <div class="ap-footer">
            <button id="ap-analyze-btn" class="ap-btn-primary">
                ✨ Analisar Página com IA
            </button>
        </div>
    `;

    document.body.appendChild(sidebar);

    // Listeners
    document.getElementById('ap-sidebar-handle').addEventListener('click', toggleSidebar);
    document.getElementById('ap-settings-btn').addEventListener('click', openSettings);
    document.getElementById('ap-analyze-btn').addEventListener('click', runProjectAnalysis);
}

function createSettingsModal() {
    if (document.getElementById('ap-modal-overlay')) return;

    const overlay = document.createElement('div');
    overlay.id = 'ap-modal-overlay';
    overlay.innerHTML = `
        <div class="ap-modal">
            <div class="ap-modal-header">
                <h3>Configurações da IA</h3>
                <button id="ap-close-modal" class="ap-icon-btn" style="padding: 4px;">
                    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><line x1="18" y1="6" x2="6" y2="18"></line><line x1="6" y1="6" x2="18" y2="18"></line></svg>
                </button>
            </div>
            
            <div class="ap-input-group">
                <label>Google Gemini API Key</label>
                <input type="password" id="ap-api-key" class="ap-input" placeholder="Cole sua chave (AIza...)">
            </div>

            <div class="ap-input-group">
                <label>Prompt de Filtragem (Persona)</label>
                <textarea id="ap-filter-prompt" class="ap-textarea" placeholder="Ex: Sou Dev React Senior..."></textarea>
            </div>

            <div class="ap-input-group">
                <label>Prompt de Proposta (Estilo de Venda)</label>
                <textarea id="ap-proposal-prompt" class="ap-textarea" placeholder="Ex: Proposta curta e direta..."></textarea>
            </div>

            <button id="ap-save-settings" class="ap-btn-primary">Salvar Alterações</button>
        </div>
    `;

    document.body.appendChild(overlay);

    document.getElementById('ap-close-modal').addEventListener('click', closeSettings);
    document.getElementById('ap-save-settings').addEventListener('click', saveSettings);
    overlay.addEventListener('click', (e) => {
        if (e.target === overlay) closeSettings();
    });
}

function createToast() {
    if (document.getElementById('ap-toast')) return;
    const toast = document.createElement('div');
    toast.id = 'ap-toast';
    document.body.appendChild(toast);
}

// -----------------------------------------------------------------------------
// 3. LÓGICA DE UI
// -----------------------------------------------------------------------------

function toggleSidebar() {
    const sidebar = document.getElementById('ap-sidebar');
    STATE.isSidebarOpen = !STATE.isSidebarOpen;
    
    if (STATE.isSidebarOpen) {
        sidebar.classList.add('open');
        document.getElementById('ap-sidebar-handle').style.opacity = '0'; 
    } else {
        sidebar.classList.remove('open');
    }
}

function openSettings() {
    document.getElementById('ap-api-key').value = STATE.settings.apiKey || '';
    document.getElementById('ap-filter-prompt').value = STATE.settings.filterPrompt;
    document.getElementById('ap-proposal-prompt').value = STATE.settings.proposalPrompt;
    document.getElementById('ap-modal-overlay').classList.add('show');
}

function closeSettings() {
    document.getElementById('ap-modal-overlay').classList.remove('show');
}

function saveSettings() {
    const apiKey = document.getElementById('ap-api-key').value.trim();
    const filterPrompt = document.getElementById('ap-filter-prompt').value.trim();
    const proposalPrompt = document.getElementById('ap-proposal-prompt').value.trim();

    STATE.settings = { apiKey, filterPrompt, proposalPrompt };

    chrome.storage.local.set(STATE.settings, () => {
        showToast("✅ Configurações atualizadas.");
        closeSettings();
    });
}

function showToast(message) {
    const toast = document.getElementById('ap-toast');
    toast.innerText = message;
    toast.classList.add('show');
    setTimeout(() => {
        toast.classList.remove('show');
    }, 3000);
}

// -----------------------------------------------------------------------------
// 4. LÓGICA DE NEGÓCIO (Scraping & Renderização)
// -----------------------------------------------------------------------------

function scrapeProjectsFromPage() {
    console.log('[Auto-Proposal] -> Iniciando Scraping...');
    const items = document.querySelectorAll('.result-list > li.result-item');
    
    const projects = Array.from(items).map(li => {
        const titleEl = li.querySelector('.title a');
        const descEl = li.querySelector('.item-text.description');
        
        return {
            id: li.getAttribute('data-id'),
            title: titleEl ? titleEl.innerText.trim() : 'Sem título',
            description: descEl ? descEl.innerText.trim() : '',
            url: titleEl ? titleEl.href : '#'
        };
    });

    return projects;
}

function renderProjectCards(filteredProjects) {
    const container = document.getElementById('ap-project-list');
    container.innerHTML = '';

    if (filteredProjects.length === 0) {
        container.innerHTML = `
            <div class="ap-empty-state">
                <p>Nenhum projeto compatível encontrado.</p>
                <p style="font-size:12px; margin-top:8px;">Tente ajustar seu Prompt de Filtragem nas configurações.</p>
            </div>
        `;
        return;
    }

    filteredProjects.forEach(project => {
        const card = document.createElement('div');
        card.className = 'ap-card';
        card.title = "Clique para ver detalhes";
        
        card.innerHTML = `
            <div class="ap-card-title">${project.title}</div>
            <div class="ap-card-desc">${project.description}</div>
        `;

        card.addEventListener('click', () => {
            window.open(project.url, '_blank');
        });

        container.appendChild(card);
    });
}

function runProjectAnalysis() {
    if (!STATE.settings.apiKey) {
        showToast("⚠️ Configure sua API Key primeiro.");
        openSettings();
        return;
    }

    const btn = document.getElementById('ap-analyze-btn');
    
    // 1. Scraping
    const projects = scrapeProjectsFromPage();
    if (projects.length === 0) {
        showToast("❌ Nenhum projeto encontrado na tela.");
        return;
    }
    
    STATE.scrapedProjects = projects;
    
    // UI Loading
    const originalBtnText = btn.innerHTML;
    btn.innerHTML = `
        <svg class="spin" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" style="animation:spin 1s infinite linear; margin-right:8px;"><path d="M21 12a9 9 0 1 1-6.219-8.56"></path></svg>
        Analisando...
    `;
    btn.classList.add('ap-btn-loading');
    
    // Adiciona keyframes para o spin se não existir
    if (!document.getElementById('ap-spin-style')) {
        const s = document.createElement('style');
        s.id = 'ap-spin-style';
        s.innerText = `@keyframes spin { 100% { transform: rotate(360deg); } }`;
        document.head.appendChild(s);
    }

    showToast("🤖 IA: Analisando projetos...");

    const projectsPayload = projects.map(p => ({
        id: p.id,
        title: p.title,
        description: p.description
    }));

    // 2. Request
    chrome.runtime.sendMessage({
        action: "geminiRequest",
        taskType: "FILTER_PROJECTS",
        apiKey: STATE.settings.apiKey,
        systemInstruction: STATE.settings.filterPrompt,
        userPrompt: JSON.stringify(projectsPayload)
    }, (response) => {
        
        btn.innerHTML = originalBtnText;
        btn.classList.remove('ap-btn-loading');

        if (!response || !response.success) {
            console.error('[Auto-Proposal] Error:', response?.error);
            showToast("❌ Erro na IA.");
            return;
        }

        const approvedIds = response.data;
        if (!Array.isArray(approvedIds)) {
            showToast("⚠️ IA retornou dados inválidos.");
            return;
        }

        const matches = STATE.scrapedProjects.filter(p => approvedIds.includes(p.id));
        
        renderProjectCards(matches);
        showToast(`✅ ${matches.length} oportunidades encontradas!`);
        
        if (!STATE.isSidebarOpen) toggleSidebar();
    });
}

// -----------------------------------------------------------------------------
// 5. INICIALIZAÇÃO
// -----------------------------------------------------------------------------

function init() {
    injectStyles();
    createSidebar();
    createSettingsModal();
    createToast();

    chrome.storage.local.get(['apiKey', 'filterPrompt', 'proposalPrompt'], (result) => {
        if (result.apiKey) STATE.settings.apiKey = result.apiKey;
        if (result.filterPrompt) STATE.settings.filterPrompt = result.filterPrompt;
        if (result.proposalPrompt) STATE.settings.proposalPrompt = result.proposalPrompt;
    });

    // Mouse Hover Edge Detection (Área maior para facilitar)
    document.addEventListener('mousemove', (e) => {
        if (STATE.isSidebarOpen) return;

        const threshold = 30; // 30px da borda
        const isNearEdge = (window.innerWidth - e.clientX) < threshold;
        const handle = document.getElementById('ap-sidebar-handle');

        if (isNearEdge && !STATE.isHoveringEdge) {
            STATE.isHoveringEdge = true;
            handle.classList.add('visible');
        } else if (!isNearEdge && STATE.isHoveringEdge) {
            const rect = handle.getBoundingClientRect();
            // Delay para não sumir instantaneamente se o mouse sair um pouco
            const isOverHandle = (
                e.clientX >= rect.left - 20 && // Margem de erro
                e.clientX <= rect.right + 20 &&
                e.clientY >= rect.top - 20 &&
                e.clientY <= rect.bottom + 20
            );

            if (!isOverHandle) {
                STATE.isHoveringEdge = false;
                handle.classList.remove('visible');
            }
        }
    });
}

if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
} else {
    init();
}