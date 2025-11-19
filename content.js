/**
 * content.js
 * 
 * Versão: 3.4 (Shortcuts Engine & Style Fixes)
 * - Correção do background branco nos inputs/textareas (Focus state).
 * - Sistema de configuração de atalhos customizáveis (2 teclas).
 * - Persistência total de configurações e atalhos.
 */

// -----------------------------------------------------------------------------
// CONSTANTES & ESTADO GLOBAL
// -----------------------------------------------------------------------------

const SYSTEM_INSTRUCTION_TEMPLATE = `
Você é um filtro de projetos experiente e tech recruiter.
Sua missão é analisar uma lista de projetos e selecionar apenas os melhores baseados no PERFIL DO USUÁRIO fornecido.

REGRAS DE SAÍDA (IMPORTANTE):
1. Retorne APENAS um JSON Array de objetos.
2. O formato deve ser estritamente: [{"id": "string", "summary": "string"}].
3. No campo "summary", escreva um resumo curto (max 30 palavras) vendendo o projeto para o candidato.
4. Use formatação Markdown no resumo (negrito **texto** para tecnologias/skills principais).
5. Não inclua explicações, intro ou markdown code blocks (\`\`\`json). Apenas o JSON cru.

PERFIL DO USUÁRIO PARA FILTRAGEM:
`;

const STATE = {
    isSidebarOpen: false,
    isHoveringEdge: false,
    scrapedProjects: [],
    settings: {
        apiKey: '',
        userProfile: 'Sou um Desenvolvedor Fullstack Sênior (Node.js, React, Python). Busco projetos de desenvolvimento web, automação e APIs. Ignore design gráfico, redação e marketing puro.',
        proposalPrompt: 'Você é um especialista em vendas consultivas. Escreva uma proposta comercial curta, direta e persuasiva para o projeto abaixo. Foque em resolver o problema do cliente. Use tom profissional mas próximo. Não coloque placeholders.',
        // Novo objeto de atalhos
        shortcuts: {
            analyze: { modifier: 'Shift', key: 'P' }
        }
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
            --ap-glass-bg: rgba(20, 20, 25, 0.65);
            --ap-glass-border: rgba(255, 255, 255, 0.12);
            --ap-text-primary: #ffffff;
            --ap-text-secondary: rgba(255, 255, 255, 0.55);
            --ap-accent-gradient: linear-gradient(135deg, #0A84FF 0%, #007AFF 100%);
            --ap-accent-color: #0A84FF;
            --ap-shadow-elevation: 0 20px 50px rgba(0,0,0,0.6);
            --ap-radius-md: 12px;
            --ap-font: -apple-system, BlinkMacSystemFont, "Inter", "Segoe UI", sans-serif;
            --ap-ease: cubic-bezier(0.32, 0.72, 0, 1);
        }

        /* --- SIDEBAR CONTAINER --- */
        #ap-sidebar {
            position: fixed;
            top: 0;
            right: -420px;
            width: 420px;
            height: 100vh;
            background: var(--ap-glass-bg);
            backdrop-filter: blur(50px) saturate(180%);
            -webkit-backdrop-filter: blur(50px) saturate(180%);
            border-left: 1px solid var(--ap-glass-border);
            box-shadow: var(--ap-shadow-elevation);
            z-index: 2147483647;
            transition: right 0.5s var(--ap-ease);
            display: flex;
            flex-direction: column;
            font-family: var(--ap-font);
            color: var(--ap-text-primary);
        }

        #ap-sidebar.open {
            right: 0;
        }

        /* --- HANDLE (GATILHO) --- */
        #ap-sidebar-handle {
            position: absolute;
            left: -24px;
            top: 50%;
            transform: translateY(-50%) scale(0.8);
            width: 48px;
            height: 96px;
            background: rgba(30, 30, 35, 0.8);
            backdrop-filter: blur(20px);
            border: 1px solid var(--ap-glass-border);
            border-radius: 24px;
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
        
        .ap-content::-webkit-scrollbar { width: 6px; }
        .ap-content::-webkit-scrollbar-track { background: transparent; }
        .ap-content::-webkit-scrollbar-thumb { background: rgba(255,255,255,0.15); border-radius: 10px; }

        .ap-empty-state {
            margin-top: 80px;
            text-align: center;
            color: var(--ap-text-secondary);
            font-size: 14px;
            line-height: 1.6;
            padding: 0 20px;
        }

        /* --- PROJECT CARDS --- */
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

        .ap-card:hover {
            background: rgba(255, 255, 255, 0.07);
            transform: translateY(-2px) scale(1.01);
            border-color: rgba(255, 255, 255, 0.2);
        }

        .ap-card-title {
            font-size: 15px;
            font-weight: 600;
            color: #5AA9FF;
            margin-bottom: 10px;
            line-height: 1.3;
        }

        .ap-card-desc {
            font-size: 13px;
            color: rgba(255, 255, 255, 0.8);
            line-height: 1.5;
            display: -webkit-box;
            -webkit-line-clamp: 4; 
            -webkit-box-orient: vertical;
            overflow: hidden;
            transition: max-height 0.6s var(--ap-ease);
            max-height: 85px;
        }

        .ap-card:hover .ap-card-desc {
            -webkit-line-clamp: unset;
            max-height: 600px;
            transition-delay: 0.2s;
            color: #fff;
        }
        
        /* Markdown Styles inside Card */
        .ap-card-desc strong, .ap-card-desc b { color: #fff; font-weight: 700; }
        .ap-card-desc em, .ap-card-desc i { color: #ccc; font-style: italic; }
        .ap-card-desc code { background: rgba(255,255,255,0.1); padding: 2px 4px; border-radius: 4px; font-family: monospace; font-size: 0.9em; }
        .ap-card-desc ul { padding-left: 16px; margin: 4px 0; }

        /* --- FOOTER & BUTTONS --- */
        .ap-footer {
            padding: 16px 24px;
            border-top: 1px solid var(--ap-glass-border);
            background: rgba(0,0,0,0.2);
            text-align: center;
            font-size: 12px;
            color: var(--ap-text-secondary);
        }

        .ap-btn-primary {
            width: 100%;
            padding: 14px;
            background: var(--ap-accent-gradient);
            color: white;
            border: none;
            border-radius: var(--ap-radius-md);
            font-weight: 600;
            cursor: pointer;
            transition: all 0.2s;
        }

        /* --- MODAL SETTINGS --- */
        #ap-modal-overlay {
            position: fixed;
            top: 0; left: 0; right: 0; bottom: 0;
            background: rgba(0,0,0,0.4);
            backdrop-filter: blur(8px);
            z-index: 2147483648;
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
            background: #1e1e1e;
            width: 420px;
            border-radius: 18px;
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
        
        #ap-modal-overlay.show .ap-modal { transform: scale(1); }

        .ap-modal-header { display: flex; justify-content: space-between; align-items: center; }
        .ap-modal-header h3 { margin: 0; font-size: 16px; font-weight: 600; }

        .ap-input-group { display: flex; flex-direction: column; gap: 8px; }
        .ap-input-group label { font-size: 11px; text-transform: uppercase; color: var(--ap-text-secondary); font-weight: 700; }

        .ap-input, .ap-textarea {
            background: rgba(0,0,0,0.3);
            border: 1px solid rgba(255,255,255,0.1);
            border-radius: 8px;
            padding: 12px;
            color: white;
            font-family: var(--ap-font);
            font-size: 13px;
        }
        
        /* FIX: Force Dark Background on Focus */
        .ap-input:focus, .ap-textarea:focus {
            background: rgba(0,0,0,0.5) !important;
            color: white !important;
            outline: 1px solid var(--ap-accent-color);
        }

        /* Shortcut Button */
        .ap-shortcut-btn {
            background: rgba(255,255,255,0.1);
            border: 1px solid rgba(255,255,255,0.2);
            color: #fff;
            padding: 8px 16px;
            border-radius: 6px;
            cursor: pointer;
            font-family: monospace;
            font-size: 13px;
            transition: all 0.2s;
            text-align: center;
        }
        .ap-shortcut-btn:hover {
            background: rgba(255,255,255,0.2);
            border-color: #fff;
        }
        .ap-shortcut-btn.recording {
            background: var(--ap-accent-color);
            border-color: var(--ap-accent-color);
            animation: pulse 1s infinite;
        }
        
        @keyframes pulse { 0% { opacity: 1; } 50% { opacity: 0.7; } 100% { opacity: 1; } }

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
            gap: 12px;
            z-index: 2147483649;
            transition: transform 0.5s var(--ap-ease);
            font-size: 13px;
            font-weight: 500;
            border: 1px solid rgba(255,255,255,0.1);
        }
        
        #ap-toast.show { transform: translateX(-50%) translateY(0); }

        /* Spin Animation */
        @keyframes spin { 100% { transform: rotate(360deg); } }
        .ap-spin { animation: spin 1s infinite linear; display: block; }
    `;
    document.head.appendChild(style);
}

// -----------------------------------------------------------------------------
// 2. HELPERS: MARKDOWN PARSER
// -----------------------------------------------------------------------------

function parseSimpleMarkdown(text) {
    if (!text) return '';
    
    let html = text
        .replace(/&/g, "&amp;")
        .replace(/</g, "&lt;")
        .replace(/>/g, "&gt;")
        .replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>')
        .replace(/\*(.*?)\*/g, '<em>$1</em>')
        .replace(/`(.*?)`/g, '<code>$1</code>')
        .replace(/^\s*-\s+(.*)$/gm, '• $1<br>')
        .replace(/\n/g, '<br>');

    return html;
}

// -----------------------------------------------------------------------------
// 3. COMPONENTES DE UI (DOM)
// -----------------------------------------------------------------------------

function createSidebar() {
    if (document.getElementById('ap-sidebar')) return;

    const sidebar = document.createElement('div');
    sidebar.id = 'ap-sidebar';
    sidebar.innerHTML = `
        <!-- Handle -->
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
                <p>Use o atalho para analisar.</p>
            </div>
        </div>

        <!-- Footer -->
        <div class="ap-footer">
            Auto-Proposal AI v3.4
        </div>
    `;

    document.body.appendChild(sidebar);

    // Listeners
    document.getElementById('ap-sidebar-handle').addEventListener('click', (e) => {
        e.stopPropagation();
        openSidebar();
    });
    document.getElementById('ap-settings-btn').addEventListener('click', openSettings);
    
    // Click Outside Logic
    document.addEventListener('click', (e) => {
        const sidebar = document.getElementById('ap-sidebar');
        const handle = document.getElementById('ap-sidebar-handle');
        const settingsModal = document.getElementById('ap-modal-overlay');
        
        if (STATE.isSidebarOpen) {
            if (!sidebar.contains(e.target) && !handle.contains(e.target) && !settingsModal.contains(e.target)) {
                closeSidebar();
            }
        }
    });
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
                <label>Seu Perfil Profissional</label>
                <textarea id="ap-user-profile" class="ap-textarea" placeholder="Ex: Sou desenvolvedor React Sênior..."></textarea>
            </div>

            <div class="ap-input-group">
                <label>Prompt de Proposta</label>
                <textarea id="ap-proposal-prompt" class="ap-textarea" placeholder="Ex: Proposta curta e direta..."></textarea>
            </div>

            <!-- Atalhos -->
            <div class="ap-input-group">
                <label>Atalhos</label>
                <div style="display: flex; justify-content: space-between; align-items: center;">
                    <span style="font-size: 13px; color: #ddd;">Analisar Projetos</span>
                    <button id="ap-shortcut-analyze" class="ap-shortcut-btn">Shift + P</button>
                </div>
            </div>

            <button id="ap-save-settings" class="ap-btn-primary">Salvar Alterações</button>
        </div>
    `;

    document.body.appendChild(overlay);

    document.getElementById('ap-close-modal').addEventListener('click', closeSettings);
    document.getElementById('ap-save-settings').addEventListener('click', saveSettings);
    
    // Shortcut Logic
    const btnAnalyze = document.getElementById('ap-shortcut-analyze');
    btnAnalyze.addEventListener('click', () => recordShortcut('analyze', btnAnalyze));

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
// 4. LÓGICA DE UI & SHORTCUTS
// -----------------------------------------------------------------------------

function openSidebar() {
    const sidebar = document.getElementById('ap-sidebar');
    STATE.isSidebarOpen = true;
    sidebar.classList.add('open');
    document.getElementById('ap-sidebar-handle').style.opacity = '0';
}

function closeSidebar() {
    const sidebar = document.getElementById('ap-sidebar');
    STATE.isSidebarOpen = false;
    sidebar.classList.remove('open');
}

function openSettings() {
    document.getElementById('ap-api-key').value = STATE.settings.apiKey || '';
    document.getElementById('ap-user-profile').value = STATE.settings.userProfile;
    document.getElementById('ap-proposal-prompt').value = STATE.settings.proposalPrompt;
    
    // Atualiza botão com atalho atual
    const sc = STATE.settings.shortcuts.analyze;
    document.getElementById('ap-shortcut-analyze').innerText = `${sc.modifier} + ${sc.key}`;

    document.getElementById('ap-modal-overlay').classList.add('show');
}

function closeSettings() {
    document.getElementById('ap-modal-overlay').classList.remove('show');
}

function saveSettings() {
    const apiKey = document.getElementById('ap-api-key').value.trim();
    const userProfile = document.getElementById('ap-user-profile').value.trim();
    const proposalPrompt = document.getElementById('ap-proposal-prompt').value.trim();

    // Mantém os shortcuts atuais do STATE (já foram atualizados pela função recordShortcut)
    const shortcuts = STATE.settings.shortcuts;

    STATE.settings = { apiKey, userProfile, proposalPrompt, shortcuts };

    chrome.storage.local.set(STATE.settings, () => {
        showToast("✅ Configurações salvas.");
        closeSettings();
    });
}

// --- SHORTCUT RECORDER LOGIC ---

function recordShortcut(actionName, btnElement) {
    const originalText = btnElement.innerText;
    btnElement.innerText = "Detectando...";
    btnElement.classList.add('recording');

    // Handler temporário
    function handleKey(e) {
        e.preventDefault();
        e.stopPropagation();

        // Ignora se for apenas teclas modificadoras sozinhas
        if (['Shift', 'Control', 'Alt', 'Meta', 'Command'].includes(e.key)) return;

        // Identifica modificador
        let modifier = '';
        if (e.shiftKey) modifier = 'Shift';
        else if (e.ctrlKey) modifier = 'Ctrl';
        else if (e.altKey) modifier = 'Alt';
        else if (e.metaKey) modifier = 'Cmd';

        // Exige 2 teclas (Modificador + Tecla)
        if (modifier && e.key) {
            const key = e.key.toUpperCase();
            
            // Atualiza STATE
            STATE.settings.shortcuts[actionName] = { modifier, key };
            
            // Atualiza UI
            btnElement.innerText = `${modifier} + ${key}`;
            
            // Cleanup
            cleanup();
        }
    }

    function cleanup() {
        btnElement.classList.remove('recording');
        document.removeEventListener('keydown', handleKey, true);
        document.removeEventListener('click', cancelClick, true);
    }
    
    // Se clicar fora, cancela
    function cancelClick(e) {
        if (e.target !== btnElement) {
            btnElement.innerText = originalText;
            cleanup();
        }
    }

    document.addEventListener('keydown', handleKey, true);
    // Pequeno delay para não registrar o clique atual
    setTimeout(() => document.addEventListener('click', cancelClick, true), 100);
}

// --- TOAST LOGIC ---
let toastTimeout;

function showToast(message, type = 'normal') {
    const toast = document.getElementById('ap-toast');
    
    if (toastTimeout) clearTimeout(toastTimeout);

    if (type === 'loading') {
        toast.innerHTML = `
            <svg class="ap-spin" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M21 12a9 9 0 1 1-6.219-8.56"></path></svg>
            <span>${message}</span>
        `;
        toast.classList.add('show');
    } else {
        toast.innerHTML = `<span>${message}</span>`;
        toast.classList.add('show');
        
        toastTimeout = setTimeout(() => {
            toast.classList.remove('show');
        }, 3000);
    }
}

// -----------------------------------------------------------------------------
// 5. LÓGICA DE NEGÓCIO (Scraping & Renderização)
// -----------------------------------------------------------------------------

function scrapeProjectsFromPage() {
    console.log('[Auto-Proposal] -> Iniciando Scraping Profundo...');
    const items = document.querySelectorAll('.result-list > li.result-item');
    
    const projects = Array.from(items).map(li => {
        const titleEl = li.querySelector('.title a');
        const descEl = li.querySelector('.item-text.description');
        let fullDescription = '';

        if (descEl) {
            const clone = descEl.cloneNode(true);
            const readMore = clone.querySelector('.read-more');
            if (readMore) readMore.remove();
            const readLess = clone.querySelector('.read-less');
            if (readLess) readLess.remove();

            clone.querySelectorAll('br').forEach(br => br.replaceWith('\n'));
            fullDescription = clone.textContent.trim();
        }
        
        return {
            id: li.getAttribute('data-id'),
            title: titleEl ? titleEl.innerText.trim() : 'Sem título',
            description: fullDescription,
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
                <p style="font-size:12px; margin-top:8px;">Verifique se seu Perfil Profissional está bem detalhado.</p>
            </div>
        `;
        return;
    }

    filteredProjects.forEach(project => {
        const card = document.createElement('div');
        card.className = 'ap-card';
        card.title = "Clique para ver detalhes";
        
        const displayContent = project.summary 
            ? parseSimpleMarkdown(project.summary) 
            : project.description;

        card.innerHTML = `
            <div class="ap-card-title">${project.title}</div>
            <div class="ap-card-desc">${displayContent}</div>
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

    showToast("Analisando projetos...", "loading");
    
    const projects = scrapeProjectsFromPage();
    if (projects.length === 0) {
        showToast("❌ Nenhum projeto encontrado na tela.");
        return;
    }
    
    STATE.scrapedProjects = projects;

    const projectsPayload = projects.map(p => ({
        id: p.id,
        title: p.title,
        description: p.description
    }));

    const finalSystemInstruction = `${SYSTEM_INSTRUCTION_TEMPLATE}\n${STATE.settings.userProfile}`;

    chrome.runtime.sendMessage({
        action: "geminiRequest",
        taskType: "FILTER_PROJECTS",
        apiKey: STATE.settings.apiKey,
        systemInstruction: finalSystemInstruction,
        userPrompt: JSON.stringify(projectsPayload)
    }, (response) => {
        
        if (!response || !response.success) {
            console.error('[Auto-Proposal] Error:', response?.error);
            showToast("❌ Erro na IA.");
            return;
        }

        const aiData = response.data;
        let finalProjects = [];

        if (Array.isArray(aiData)) {
            if (aiData.length > 0 && typeof aiData[0] === 'object' && aiData[0].id) {
                finalProjects = aiData.map(aiItem => {
                    const original = STATE.scrapedProjects.find(p => p.id == aiItem.id);
                    if (original) {
                        return { ...original, summary: aiItem.summary };
                    }
                    return null;
                }).filter(p => p !== null);
            } else {
                finalProjects = STATE.scrapedProjects.filter(p => aiData.includes(p.id));
            }
        } else {
            showToast("⚠️ Formato de resposta inválido.");
            return;
        }
        
        renderProjectCards(finalProjects);
        
        showToast("✅ Projetos selecionados");
        
        if (!STATE.isSidebarOpen) {
            setTimeout(() => openSidebar(), 500);
        }
    });
}

// -----------------------------------------------------------------------------
// 6. INICIALIZAÇÃO
// -----------------------------------------------------------------------------

function init() {
    injectStyles();
    createSidebar();
    createSettingsModal();
    createToast();

    // Carrega configurações do Storage (incluindo shortcuts)
    chrome.storage.local.get(['apiKey', 'userProfile', 'proposalPrompt', 'shortcuts'], (result) => {
        if (result.apiKey) STATE.settings.apiKey = result.apiKey;
        if (result.userProfile) STATE.settings.userProfile = result.userProfile;
        if (result.proposalPrompt) STATE.settings.proposalPrompt = result.proposalPrompt;
        
        // Carrega shortcuts salvos ou usa o default
        if (result.shortcuts) {
            STATE.settings.shortcuts = result.shortcuts;
        }
    });

    // Mouse Hover Edge Detection
    document.addEventListener('mousemove', (e) => {
        if (STATE.isSidebarOpen) return;

        const threshold = 30;
        const isNearEdge = (window.innerWidth - e.clientX) < threshold;
        const handle = document.getElementById('ap-sidebar-handle');

        if (isNearEdge && !STATE.isHoveringEdge) {
            STATE.isHoveringEdge = true;
            handle.classList.add('visible');
        } else if (!isNearEdge && STATE.isHoveringEdge) {
            const rect = handle.getBoundingClientRect();
            const isOverHandle = (
                e.clientX >= rect.left - 20 &&
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

    // DYNAMIC SHORTCUT LISTENER
    document.addEventListener('keydown', (e) => {
        if (e.target.tagName === 'INPUT' || e.target.tagName === 'TEXTAREA') return;

        const sc = STATE.settings.shortcuts.analyze;
        
        // Verifica se a tecla bate com a configurada
        // sc.modifier: 'Shift', 'Ctrl', 'Alt'
        // sc.key: 'P'
        
        let modifierPressed = false;
        if (sc.modifier === 'Shift') modifierPressed = e.shiftKey;
        if (sc.modifier === 'Ctrl') modifierPressed = e.ctrlKey;
        if (sc.modifier === 'Alt') modifierPressed = e.altKey;
        if (sc.modifier === 'Cmd') modifierPressed = e.metaKey;

        if (modifierPressed && e.key.toUpperCase() === sc.key.toUpperCase()) {
            e.preventDefault();
            runProjectAnalysis();
        }
    });
}

if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
} else {
    init();
}