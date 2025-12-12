/**
 * content.js
 * 
 * Versão: 4.7 (Fix: Card Expansion Delay & Scroll)
 * - Ajuste de CSS: Cards agora mostram "..." e só expandem após 0.6s de hover.
 * - Scroll: Reforçado comportamento de scroll na lista de projetos.
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

const PROPOSAL_SYSTEM_INSTRUCTION = `
Você é um especialista em vendas consultivas no 99freelas.
Sua missão é criar uma proposta comercial e definir preço e prazo baseados no PROMPT DO USUÁRIO e nos DADOS DO PROJETO.

REGRAS DE SAÍDA (IMPORTANTE):
1. Retorne APENAS um JSON válido (sem markdown blocks).
2. Formato estrito:
34: {
  "message": "Texto persuasivo da proposta aqui...",
  "price": 1500,
  "duration": 7
}
3. "price" deve ser um NÚMERO (ex: 1500) representando o valor em Reais.
4. "duration" deve ser um NÚMERO (ex: 7) representando dias úteis.
5. Use o contexto do projeto para ser específico na mensagem.
`;

// Detecta qual site está sendo acessado
const CURRENT_SITE = window.location.hostname.includes('freelancer.com')
    ? 'freelancer'
    : '99freelas';

const STATE = {
    isSidebarOpen: false,
    isHoveringEdge: false,
    scrapedProjects: [],
    lastAutoRunUrl: '', // Para evitar loop no modo automático
    settings: {
        apiKey: '',
        userProfile: 'Sou um Desenvolvedor Fullstack Sênior (Node.js, React, Python). Busco projetos de desenvolvimento web, automação e APIs.',
        proposalPrompt: 'Escreva uma proposta curta, direta e persuasiva. Foque em resolver o problema do cliente. Use tom profissional mas próximo.',
        autoProposalMode: false,
        shortcuts: {
            analyze: { modifier: 'Shift', key: 'P' },
            generate: { modifier: 'Shift', key: 'G' }
        }
    }
};

// -----------------------------------------------------------------------------
// 1. INJEÇÃO DE ESTILOS (CSS)
// -----------------------------------------------------------------------------

function injectStyles() {
    if (document.getElementById('ap-styles')) return;

    const style = document.createElement('style');
    style.id = 'ap-styles';
    style.textContent = `
        /* --- FONTES & RESET --- */
        @import url('https://fonts.googleapis.com/css2?family=Inter:wght@300;400;500;600;700&display=swap');

        :root {
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

        #ap-sidebar.open { right: 0; }

        /* --- HANDLE --- */
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
            flex-shrink: 0; /* Impede encolhimento */
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

        /* --- CONTENT AREA (SCROLLABLE) --- */
        .ap-content {
            flex: 1; /* Ocupa o espaço restante */
            overflow-y: auto; /* Habilita Scroll Vertical */
            padding: 24px;
            display: flex;
            flex-direction: column;
            gap: 16px;
            min-height: 0; /* Fix para Firefox/Flexbox scroll */
        }
        
        /* Custom Scrollbar */
        .ap-content::-webkit-scrollbar { width: 6px; }
        .ap-content::-webkit-scrollbar-track { background: transparent; }
        .ap-content::-webkit-scrollbar-thumb { background: rgba(255,255,255,0.15); border-radius: 10px; }
        .ap-content::-webkit-scrollbar-thumb:hover { background: rgba(255,255,255,0.3); }

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
            flex-shrink: 0; /* Garante que o card não encolha no flex */
        }

        .ap-card:hover {
            background: rgba(255, 255, 255, 0.07);
            transform: translateY(-2px) scale(1.01);
            border-color: rgba(255, 255, 255, 0.2);
            z-index: 10; /* Traz pra frente */
        }

        .ap-card-title {
            font-size: 15px;
            font-weight: 600;
            color: #5AA9FF;
            margin-bottom: 10px;
            line-height: 1.3;
        }

        /* --- EXPANDABLE DESCRIPTION --- */
        .ap-card-desc {
            font-size: 13px;
            color: rgba(255, 255, 255, 0.8);
            line-height: 1.5;
            
            /* Lógica de Truncamento */
            display: -webkit-box;
            -webkit-line-clamp: 3; /* Mostra apenas 3 linhas */
            -webkit-box-orient: vertical;
            overflow: hidden;
            text-overflow: ellipsis;
            
            /* Lógica de Animação */
            max-height: 65px; /* Altura aproximada de 3 linhas */
            transition: max-height 0.5s ease-in-out, color 0.3s;
        }

        /* Estado Expandido (Hover Prolongado) */
        .ap-card:hover .ap-card-desc {
            -webkit-line-clamp: unset; /* Remove o limite de linhas */
            max-height: 800px; /* Altura máxima segura para texto longo */
            color: #fff;
            transition-delay: 0.6s; /* ATRASO: Só expande após 0.6s */
        }
        
        /* Estilos internos do texto */
        .ap-card-desc strong, .ap-card-desc b { color: #fff; font-weight: 700; }
        .ap-card-desc em, .ap-card-desc i { color: #ccc; font-style: italic; }
        .ap-card-desc code { background: rgba(255,255,255,0.1); padding: 2px 4px; border-radius: 4px; font-family: monospace; font-size: 0.9em; }
        .ap-card-desc ul { padding-left: 16px; margin: 4px 0; }

        /* --- FOOTER --- */
        .ap-footer {
            padding: 16px 24px;
            border-top: 1px solid var(--ap-glass-border);
            background: rgba(0,0,0,0.2);
            text-align: center;
            font-size: 12px;
            color: var(--ap-text-secondary);
            flex-shrink: 0;
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
            background: rgba(0,0,0,0.6);
            backdrop-filter: blur(8px);
            z-index: 2147483648;
            display: none;
            align-items: center;
            justify-content: center;
            opacity: 0;
            transition: opacity 0.3s;
        }

        #ap-modal-overlay.show { display: flex; opacity: 1; }

        .ap-modal {
            background: #1e1e1e;
            width: 450px;
            max-height: 85vh;
            border-radius: 18px;
            border: 1px solid rgba(255,255,255,0.15);
            box-shadow: 0 25px 60px rgba(0,0,0,0.5);
            padding: 24px;
            display: flex;
            flex-direction: column;
            color: #fff;
            transform: scale(0.95);
            transition: transform 0.3s var(--ap-ease);
            overflow: hidden;
        }
        
        #ap-modal-overlay.show .ap-modal { transform: scale(1); }

        .ap-modal-header { 
            display: flex; 
            justify-content: space-between; 
            align-items: center; 
            margin-bottom: 16px;
            flex-shrink: 0;
        }
        .ap-modal-header h3 { margin: 0; font-size: 16px; font-weight: 600; }

        /* Scrollable Body */
        .ap-modal-body {
            flex: 1;
            overflow-y: auto;
            display: flex;
            flex-direction: column;
            gap: 20px;
            padding-right: 8px;
            margin-bottom: 16px;
        }

        .ap-modal-body::-webkit-scrollbar { width: 6px; }
        .ap-modal-body::-webkit-scrollbar-track { background: rgba(255,255,255,0.05); border-radius: 4px; }
        .ap-modal-body::-webkit-scrollbar-thumb { background: rgba(255,255,255,0.2); border-radius: 4px; }

        .ap-input-group { display: flex; flex-direction: column; gap: 8px; }
        .ap-input-group label { font-size: 11px; text-transform: uppercase; color: var(--ap-text-secondary); font-weight: 700; }

        .ap-input, .ap-textarea {
            background: rgba(0,0,0,0.3);
            border: 1px solid rgba(255,255,255,0.1);
            border-radius: 8px;
            padding: 12px;
            color: #ffffff !important; /* FIX: Always white */
            font-family: var(--ap-font);
            font-size: 13px;
        }
        
        .ap-input:focus, .ap-textarea:focus {
            background: rgba(0,0,0,0.5) !important;
            color: #ffffff !important;
            outline: 1px solid var(--ap-accent-color);
        }

        /* Shortcut Button */
        .ap-shortcut-row {
            display: flex;
            justify-content: space-between;
            align-items: center;
            margin-bottom: 8px;
        }
        .ap-shortcut-row span { font-size: 13px; color: #ddd; }

        .ap-shortcut-btn {
            background: rgba(255,255,255,0.1);
            border: 1px solid rgba(255,255,255,0.2);
            color: #fff;
            padding: 6px 12px;
            border-radius: 6px;
            cursor: pointer;
            font-family: monospace;
            font-size: 12px;
            transition: all 0.2s;
            text-align: center;
            min-width: 80px;
        }
        .ap-shortcut-btn:hover { background: rgba(255,255,255,0.2); border-color: #fff; }
        .ap-shortcut-btn.recording {
            background: var(--ap-accent-color);
            border-color: var(--ap-accent-color);
            animation: pulse 1s infinite;
        }

        /* Toggle Switch */
        .ap-toggle {
            display: flex;
            align-items: center;
            gap: 10px;
            cursor: pointer;
        }
        .ap-toggle input { display: none; }
        .ap-toggle-track {
            width: 40px; height: 22px;
            background: rgba(255,255,255,0.1);
            border-radius: 20px;
            position: relative;
            transition: background 0.3s;
        }
        .ap-toggle-thumb {
            width: 18px; height: 18px;
            background: #fff;
            border-radius: 50%;
            position: absolute;
            top: 2px; left: 2px;
            transition: transform 0.3s;
        }
        .ap-toggle input:checked + .ap-toggle-track { background: var(--ap-accent-color); }
        .ap-toggle input:checked + .ap-toggle-track .ap-toggle-thumb { transform: translateX(18px); }
        
        @keyframes pulse { 0% { opacity: 1; } 50% { opacity: 0.7; } 100% { opacity: 1; } }

        /* --- TOAST --- */
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
        .ap-spin { animation: spin 1s infinite linear; display: block; }
        @keyframes spin { 100% { transform: rotate(360deg); } }
    `;
    document.head.appendChild(style);
}

// -----------------------------------------------------------------------------
// 2. HELPERS
// -----------------------------------------------------------------------------

function parseSimpleMarkdown(text) {
    if (!text) return '';
    return text
        .replace(/&/g, "&amp;")
        .replace(/</g, "&lt;")
        .replace(/>/g, "&gt;")
        .replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>')
        .replace(/\*(.*?)\*/g, '<em>$1</em>')
        .replace(/`(.*?)`/g, '<code>$1</code>')
        .replace(/^\s*-\s+(.*)$/gm, '• $1<br>')
        .replace(/\n/g, '<br>');
}

function sanitizeNumber(value) {
    if (typeof value === 'number') return value;
    if (typeof value === 'string') {
        // Remove tudo que não for dígito ou ponto/vírgula
        const clean = value.replace(/[^\d,.-]/g, '').replace(',', '.');
        return parseFloat(clean) || 0;
    }
    return 0;
}

function formatCurrencyBR(value) {
    if (value === undefined || value === null) return '';
    // Garante que é um número
    const number = typeof value === 'string' ? parseFloat(value) : value;
    if (isNaN(number)) return '';

    // Formata para o padrão brasileiro: X.XXX,XX
    return number.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

// -----------------------------------------------------------------------------
// 3. COMPONENTES DE UI
// -----------------------------------------------------------------------------

function createSidebar() {
    if (document.getElementById('ap-sidebar')) return;

    const sidebar = document.createElement('div');
    sidebar.id = 'ap-sidebar';
    sidebar.innerHTML = `
        <div id="ap-sidebar-handle" title="Abrir Auto-Proposal">
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#fff" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><polyline points="15 18 9 12 15 6"></polyline></svg>
        </div>
        <div class="ap-header">
            <h2>Projetos em Potencial</h2>
            <button id="ap-settings-btn" class="ap-icon-btn" title="Configurações">
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="3"></circle><path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1 0 2.83 2 2 0 0 1-2.83 0l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-2 2 2 2 0 0 1-2-2v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83 0 2 2 0 0 1 0-2.83l.06-.06a1.65 1.65 0 0 0 .33-1.82 1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1-2-2 2 2 0 0 1 2-2h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 0-2.83 2 2 0 0 1 2.83 0l.06.06a1.65 1.65 0 0 0 1.82.33H9a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 2-2 2 2 0 0 1 2 2v.09a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 2 2 2 2 0 0 1-2 2h-.09a1.65 1.65 0 0 0-1.51 1z"></path></svg>
            </button>
        </div>
        <div id="ap-project-list" class="ap-content">
            <div class="ap-empty-state">
                <svg width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="rgba(255,255,255,0.2)" stroke-width="1" stroke-linecap="round" stroke-linejoin="round" style="margin-bottom: 16px;"><rect x="2" y="3" width="20" height="14" rx="2" ry="2"></rect><line x1="8" y1="21" x2="16" y2="21"></line><line x1="12" y1="17" x2="12" y2="21"></line></svg>
                <p>Use o atalho para analisar.</p>
            </div>
        </div>
        <div class="ap-footer">Auto-Proposal AI</div>
    `;

    document.body.appendChild(sidebar);
    document.getElementById('ap-sidebar-handle').addEventListener('click', (e) => { e.stopPropagation(); openSidebar(); });
    document.getElementById('ap-settings-btn').addEventListener('click', openSettings);

    document.addEventListener('click', (e) => {
        const sidebar = document.getElementById('ap-sidebar');
        const handle = document.getElementById('ap-sidebar-handle');
        const settingsModal = document.getElementById('ap-modal-overlay');
        if (STATE.isSidebarOpen && !sidebar.contains(e.target) && !handle.contains(e.target) && !settingsModal.contains(e.target)) {
            closeSidebar();
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
            
            <div class="ap-modal-body">
                <div class="ap-input-group">
                    <label>Google Gemini API Key</label>
                    <input type="password" id="ap-api-key" class="ap-input" placeholder="Cole sua chave (AIza...)">
                </div>

                <div class="ap-input-group">
                    <label>Seu Perfil Profissional</label>
                    <textarea id="ap-user-profile" class="ap-textarea" rows="4" placeholder="Ex: Sou desenvolvedor React Sênior..."></textarea>
                </div>

                <div class="ap-input-group">
                    <label>Prompt de Proposta</label>
                    <textarea id="ap-proposal-prompt" class="ap-textarea" rows="4" placeholder="Ex: Proposta curta e direta..."></textarea>
                </div>

                <div class="ap-input-group">
                    <label>Atalhos & Automação</label>
                    
                    <div class="ap-shortcut-row">
                        <span>Analisar Lista de Projetos</span>
                        <button id="ap-shortcut-analyze" class="ap-shortcut-btn">Shift + P</button>
                    </div>

                    <div class="ap-shortcut-row">
                        <span>Gerar Proposta (Bid)</span>
                        <button id="ap-shortcut-generate" class="ap-shortcut-btn">Shift + G</button>
                    </div>

                    <div style="margin-top: 8px;">
                        <label class="ap-toggle">
                            <input type="checkbox" id="ap-auto-mode">
                            <div class="ap-toggle-track"><div class="ap-toggle-thumb"></div></div>
                            <span style="font-size:13px; color:#fff;">Modo Automático (Página de Proposta)</span>
                        </label>
                    </div>
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

    const btnGenerate = document.getElementById('ap-shortcut-generate');
    btnGenerate.addEventListener('click', () => recordShortcut('generate', btnGenerate));

    overlay.addEventListener('click', (e) => { if (e.target === overlay) closeSettings(); });
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
    // Esconde o handle enquanto a sidebar está aberta
    document.getElementById('ap-sidebar-handle').style.opacity = '0';
}

function closeSidebar() {
    const sidebar = document.getElementById('ap-sidebar');
    STATE.isSidebarOpen = false;
    sidebar.classList.remove('open');
    // FIX CRÍTICO: Limpa o estilo inline para que o CSS (.visible) volte a funcionar no hover
    document.getElementById('ap-sidebar-handle').style.opacity = '';
}

function openSettings() {
    document.getElementById('ap-api-key').value = STATE.settings.apiKey || '';
    document.getElementById('ap-user-profile').value = STATE.settings.userProfile;
    document.getElementById('ap-proposal-prompt').value = STATE.settings.proposalPrompt;
    document.getElementById('ap-auto-mode').checked = STATE.settings.autoProposalMode;

    // Garante que as chaves existem antes de acessar
    const scAnalyze = STATE.settings.shortcuts.analyze || { modifier: 'Shift', key: 'P' };
    const scGenerate = STATE.settings.shortcuts.generate || { modifier: 'Shift', key: 'G' };

    document.getElementById('ap-shortcut-analyze').innerText = `${scAnalyze.modifier} + ${scAnalyze.key}`;
    document.getElementById('ap-shortcut-generate').innerText = `${scGenerate.modifier} + ${scGenerate.key}`;

    document.getElementById('ap-modal-overlay').classList.add('show');
}

function closeSettings() {
    document.getElementById('ap-modal-overlay').classList.remove('show');
}

function saveSettings() {
    const apiKey = document.getElementById('ap-api-key').value.trim();
    const userProfile = document.getElementById('ap-user-profile').value.trim();
    const proposalPrompt = document.getElementById('ap-proposal-prompt').value.trim();
    const autoProposalMode = document.getElementById('ap-auto-mode').checked;

    const shortcuts = STATE.settings.shortcuts;

    STATE.settings = { apiKey, userProfile, proposalPrompt, autoProposalMode, shortcuts };

    chrome.storage.local.set(STATE.settings, () => {
        showToast("✅ Configurações salvas.");
        closeSettings();
    });
}

function recordShortcut(actionName, btnElement) {
    const originalText = btnElement.innerText;
    btnElement.innerText = "Detectando...";
    btnElement.classList.add('recording');

    function handleKey(e) {
        e.preventDefault();
        e.stopPropagation();
        if (['Shift', 'Control', 'Alt', 'Meta', 'Command'].includes(e.key)) return;

        let modifier = '';
        if (e.shiftKey) modifier = 'Shift';
        else if (e.ctrlKey) modifier = 'Ctrl';
        else if (e.altKey) modifier = 'Alt';
        else if (e.metaKey) modifier = 'Cmd';

        if (modifier && e.key) {
            const key = e.key.toUpperCase();
            STATE.settings.shortcuts[actionName] = { modifier, key };
            btnElement.innerText = `${modifier} + ${key}`;
            cleanup();
        }
    }

    function cleanup() {
        btnElement.classList.remove('recording');
        document.removeEventListener('keydown', handleKey, true);
        document.removeEventListener('click', cancelClick, true);
    }

    function cancelClick(e) {
        if (e.target !== btnElement) {
            btnElement.innerText = originalText;
            cleanup();
        }
    }

    document.addEventListener('keydown', handleKey, true);
    setTimeout(() => document.addEventListener('click', cancelClick, true), 100);
}

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
        toastTimeout = setTimeout(() => { toast.classList.remove('show'); }, 3000);
    }
}

// -----------------------------------------------------------------------------
// 5. LÓGICA: FILTRO DE PROJETOS (SIDEBAR)
// -----------------------------------------------------------------------------

// Dispatcher: escolhe a função correta baseada no site
async function scrapeProjectsFromPage() {
    if (CURRENT_SITE === 'freelancer') {
        return await scrapeProjectsFreelancer();
    }
    return scrapeProjects99freelas();
}

// Scraper específico para 99freelas
function scrapeProjects99freelas() {
    const items = document.querySelectorAll('.result-list > li.result-item');
    return Array.from(items).map(li => {
        const titleEl = li.querySelector('.title a');
        const descEl = li.querySelector('.item-text.description');
        let fullDescription = '';
        if (descEl) {
            const clone = descEl.cloneNode(true);
            if (clone.querySelector('.read-more')) clone.querySelector('.read-more').remove();
            if (clone.querySelector('.read-less')) clone.querySelector('.read-less').remove();
            clone.querySelectorAll('br').forEach(br => br.replaceWith('\n'));
            fullDescription = clone.textContent.trim();
        }

        // Modificação: Transforma URL de detalhes em URL de proposta (Bid)
        let originalUrl = titleEl ? titleEl.href : '#';
        let bidUrl = originalUrl.replace('/project/', '/project/bid/');

        return {
            id: li.getAttribute('data-id'),
            title: titleEl ? titleEl.innerText.trim() : 'Sem título',
            description: fullDescription,
            url: bidUrl
        };
    });
}

// Scraper específico para Freelancer.com
async function scrapeProjectsFreelancer() {
    const cards = document.querySelectorAll('fl-project-contest-card.ProjectCard');
    const projects = [];

    const esperar = (ms) => new Promise(resolve => setTimeout(resolve, ms));

    console.log(`[Auto-Proposal] Freelancer: Encontrados ${cards.length} cards de projetos...`);

    for (const card of cards) {
        try {
            // Expandir descrição clicando em "Read More"
            const paragrafoDescricao = card.querySelector('p.mb-xxsmall');
            if (paragrafoDescricao) {
                const botaoMore = paragrafoDescricao.querySelector('.ReadMoreButton');
                if (botaoMore) {
                    botaoMore.click();
                    await esperar(150);
                }
            }

            // Título do Projeto
            const elTitulo = card.querySelector('.Title-text');
            const titulo = elTitulo ? elTitulo.innerText.trim() : "Sem Título";

            // URL do projeto - Estratégias de busca:
            // 1. Buscar link no wrapper pai (o card pode estar dentro de um <a>)
            // 2. Buscar qualquer link com href contendo /projects/
            // 3. Buscar link com fltrackinglabel
            let url = '#';

            // Estratégia 1: Verificar se o card está dentro de um link
            const parentLink = card.closest('a[href*="/projects/"]');
            if (parentLink) {
                url = parentLink.href;
            } else {
                // Estratégia 2: Buscar link em qualquer lugar próximo do card (irmãos ou ancestrais)
                const wrapper = card.parentElement;
                if (wrapper) {
                    const nearbyLink = wrapper.querySelector('a[href*="/projects/"]')
                        || wrapper.closest('a[href*="/projects/"]');
                    if (nearbyLink) {
                        url = nearbyLink.href;
                    }
                }
            }

            // Estratégia 3: Fallback - buscar dentro do card
            if (url === '#') {
                const innerLink = card.querySelector('a[href*="/projects/"]')
                    || card.querySelector('a[fltrackinglabel="RedirectToPVP"]');
                if (innerLink) {
                    url = innerLink.href;
                }
            }

            // Log para debug se não encontrou URL
            if (url === '#') {
                console.warn(`[Auto-Proposal] URL não encontrada para: "${titulo}"`);
            }

            // Descrição (sem botão)
            let descricao = "";
            if (paragrafoDescricao) {
                const cloneDesc = paragrafoDescricao.cloneNode(true);
                const btnNoClone = cloneDesc.querySelector('button');
                if (btnNoClone) btnNoClone.remove();
                descricao = cloneDesc.innerText.trim();
            }

            // ID único baseado no URL ou título
            const id = url !== '#'
                ? url.split('/').pop().split('?')[0]
                : titulo.toLowerCase().replace(/\s+/g, '-').substring(0, 50);

            projects.push({
                id: id,
                title: titulo,
                description: descricao,
                url: url
            });
        } catch (erro) {
            console.error("[Auto-Proposal] Erro ao processar card do Freelancer:", erro);
        }
    }

    return projects;
}

function renderProjectCards(filteredProjects) {
    const container = document.getElementById('ap-project-list');
    container.innerHTML = '';
    if (filteredProjects.length === 0) {
        container.innerHTML = `<div class="ap-empty-state"><p>Nenhum projeto compatível.</p></div>`;
        return;
    }
    filteredProjects.forEach(project => {
        const card = document.createElement('div');
        card.className = 'ap-card';
        const displayContent = project.summary ? parseSimpleMarkdown(project.summary) : project.description;
        card.innerHTML = `<div class="ap-card-title">${project.title}</div><div class="ap-card-desc">${displayContent}</div>`;
        card.addEventListener('click', () => window.open(project.url, '_blank'));
        container.appendChild(card);
    });
}

async function runProjectAnalysis() {
    if (!STATE.settings.apiKey) { showToast("⚠️ Configure sua API Key."); openSettings(); return; }
    showToast("Analisando projetos...", "loading");

    // Aguarda o scraping (necessário para Freelancer.com que é async)
    const projects = await scrapeProjectsFromPage();
    if (projects.length === 0) { showToast("❌ Nenhum projeto na tela."); return; }

    STATE.scrapedProjects = projects;
    const projectsPayload = projects.map(p => ({ id: p.id, title: p.title, description: p.description }));
    const finalInstruction = `${SYSTEM_INSTRUCTION_TEMPLATE}\n${STATE.settings.userProfile}`;

    chrome.runtime.sendMessage({
        action: "geminiRequest",
        taskType: "FILTER_PROJECTS",
        apiKey: STATE.settings.apiKey,
        systemInstruction: finalInstruction,
        userPrompt: JSON.stringify(projectsPayload)
    }, (response) => {
        if (!response || !response.success) { showToast("❌ Erro na IA."); return; }
        const aiData = response.data;
        let finalProjects = [];
        if (Array.isArray(aiData) && aiData.length > 0 && aiData[0].id) {
            finalProjects = aiData.map(aiItem => {
                const original = STATE.scrapedProjects.find(p => p.id == aiItem.id);
                return original ? { ...original, summary: aiItem.summary } : null;
            }).filter(Boolean);
        } else {
            finalProjects = STATE.scrapedProjects.filter(p => aiData.includes(p.id));
        }
        renderProjectCards(finalProjects);
        showToast("✅ Projetos selecionados");
        if (!STATE.isSidebarOpen) setTimeout(() => openSidebar(), 500);
    });
}

// -----------------------------------------------------------------------------
// 6. LÓGICA: GERAÇÃO DE PROPOSTA (BID PAGE)
// -----------------------------------------------------------------------------

// Dispatcher: escolhe a função correta baseada no site
function scrapeProposalContext() {
    if (CURRENT_SITE === 'freelancer') {
        return scrapeProposalContextFreelancer();
    }
    return scrapeProposalContext99freelas();
}

// Dispatcher: escolhe a função correta baseada no site
function fillProposalForm(data) {
    if (CURRENT_SITE === 'freelancer') {
        return fillProposalFormFreelancer(data);
    }
    return fillProposalForm99freelas(data);
}

// Scraper de contexto para 99freelas
function scrapeProposalContext99freelas() {
    // 1. Nome do Cliente
    const clientEl = document.querySelector('.info-usuario-nome .name');
    const clientName = clientEl ? clientEl.innerText.trim() : 'Cliente';

    // 2. Descrição do Projeto
    const descEl = document.querySelector('.item-text.project-description');
    let description = '';
    if (descEl) {
        // Clona para não estragar o DOM visual
        const clone = descEl.cloneNode(true);
        clone.querySelectorAll('br').forEach(br => br.replaceWith('\n'));
        description = clone.textContent.trim();
    }

    // 3. Valor e Prazo Médios
    const infoEl = document.querySelector('.generic.information');
    let avgValue = 'Não informado';
    let avgTime = 'Não informado';

    if (infoEl) {
        const bTags = infoEl.querySelectorAll('b');
        if (bTags.length >= 1) avgValue = bTags[0].innerText.trim();
        if (bTags.length >= 2) avgTime = bTags[1].innerText.trim();
    }

    return { clientName, description, avgValue, avgTime };
}

// Scraper de contexto para Freelancer.com
function scrapeProposalContextFreelancer() {
    // 1. Título do Projeto (geralmente no header da página)
    const titleEl = document.querySelector('h1.PageProjectViewLogout-header-title, .project-header h1, app-project-view-header h1');
    const projectTitle = titleEl ? titleEl.innerText.trim() : 'Projeto';

    // 2. Descrição do Projeto
    // Freelancer usa várias estruturas possíveis para a descrição
    let description = '';
    const descSelectors = [
        '.project-details p',
        '.ProjectDescription',
        'app-project-view-description p',
        '.PageProjectViewLogout-detail'
    ];

    for (const selector of descSelectors) {
        const descEl = document.querySelector(selector);
        if (descEl) {
            const clone = descEl.cloneNode(true);
            clone.querySelectorAll('br').forEach(br => br.replaceWith('\n'));
            description = clone.textContent.trim();
            if (description) break;
        }
    }

    // Se ainda não encontrou, tenta buscar todo o conteúdo da página de descrição
    if (!description) {
        const mainContent = document.querySelector('app-project-view, .project-view-content');
        if (mainContent) {
            const paragraphs = mainContent.querySelectorAll('p');
            const texts = Array.from(paragraphs).map(p => p.textContent.trim()).filter(t => t.length > 50);
            description = texts.join('\n\n');
        }
    }

    // 3. Budget do projeto
    let avgValue = 'Não informado';
    const budgetEl = document.querySelector('.BudgetPrice, .project-budget, [data-budget]');
    if (budgetEl) {
        avgValue = budgetEl.textContent.trim();
    }

    // 4. Prazo (geralmente não disponível diretamente, usar genérico)
    let avgTime = 'A definir';

    // 5. Skills do projeto
    let skills = '';
    const skillEls = document.querySelectorAll('.project-skills fl-tag, .Skills fl-tag, .SkillsWrapper fl-tag');
    if (skillEls.length > 0) {
        skills = Array.from(skillEls).map(el => el.textContent.trim()).join(', ');
    }

    // 6. Moeda do projeto (extraída do formulário de bid)
    let currency = 'USD'; // Default
    const currencyEl = document.querySelector('#bidAmountInput')?.closest('.InputContainer')?.querySelector('.AfterLabel .LabelText');
    if (currencyEl) {
        currency = currencyEl.textContent.trim();
    } else {
        // Fallback: tentar extrair do budget
        const currencyMatch = avgValue.match(/([A-Z]{3}|[$€£])/);
        if (currencyMatch) {
            currency = currencyMatch[0];
        }
    }

    console.log('[Auto-Proposal] Contexto Freelancer:', { projectTitle, description: description.substring(0, 200) + '...', avgValue, skills, currency });

    return {
        clientName: projectTitle, // Usamos o título do projeto como referência
        description: description + (skills ? `\n\nSkills: ${skills}` : ''),
        avgValue: avgValue,
        avgTime: avgTime,
        currency: currency
    };
}

// Preenchimento de formulário para 99freelas
function fillProposalForm99freelas(data) {
    // Data: { message, price, duration }

    // 1. Preencher Textarea da Proposta
    const txtProposta = document.getElementById('proposta');
    if (txtProposta) {
        txtProposta.value = data.message;
        txtProposta.dispatchEvent(new Event('input', { bubbles: true }));
    }

    // 2. Preencher Inputs de Valor (Oferta)
    const inputOferta = document.getElementById('oferta');
    const inputOfertaFinal = document.getElementById('oferta-final');

    if (inputOferta) {
        inputOferta.value = formatCurrencyBR(data.price);
        inputOferta.dispatchEvent(new Event('input', { bubbles: true }));
        inputOferta.dispatchEvent(new Event('change', { bubbles: true }));
    }
    if (inputOfertaFinal) {
        inputOfertaFinal.value = formatCurrencyBR(data.price * 1.17647059);
        inputOfertaFinal.dispatchEvent(new Event('input', { bubbles: true }));
    }

    // 3. Preencher Duração
    const inputDuracao = document.getElementById('duracao-estimada');
    if (inputDuracao) {
        inputDuracao.value = data.duration;
        inputDuracao.dispatchEvent(new Event('input', { bubbles: true }));
        inputDuracao.dispatchEvent(new Event('change', { bubbles: true }));
    }
}

// Preenchimento de formulário para Freelancer.com
function fillProposalFormFreelancer(data) {
    // Data: { message, price, duration }

    console.log('[Auto-Proposal] Preenchendo formulário Freelancer:', data);

    // 1. Preencher Textarea da Proposta (descrição)
    const txtDescription = document.getElementById('descriptionTextArea');
    if (txtDescription) {
        txtDescription.value = data.message;
        txtDescription.dispatchEvent(new Event('input', { bubbles: true }));
        txtDescription.dispatchEvent(new Event('change', { bubbles: true }));
        // Angular às vezes precisa de blur para detectar mudanças
        txtDescription.dispatchEvent(new Event('blur', { bubbles: true }));
    } else {
        console.warn('[Auto-Proposal] Campo descriptionTextArea não encontrado');
    }

    // 2. Preencher Bid Amount (valor)
    const inputBidAmount = document.getElementById('bidAmountInput');
    if (inputBidAmount) {
        // Freelancer usa valores numéricos diretos (sem formatação BR)
        inputBidAmount.value = data.price;
        inputBidAmount.dispatchEvent(new Event('input', { bubbles: true }));
        inputBidAmount.dispatchEvent(new Event('change', { bubbles: true }));
        inputBidAmount.dispatchEvent(new Event('blur', { bubbles: true }));
    } else {
        console.warn('[Auto-Proposal] Campo bidAmountInput não encontrado');
    }

    // 3. Preencher Period (dias)
    const inputPeriod = document.getElementById('periodInput');
    if (inputPeriod) {
        inputPeriod.value = data.duration;
        inputPeriod.dispatchEvent(new Event('input', { bubbles: true }));
        inputPeriod.dispatchEvent(new Event('change', { bubbles: true }));
        inputPeriod.dispatchEvent(new Event('blur', { bubbles: true }));
    } else {
        console.warn('[Auto-Proposal] Campo periodInput não encontrado');
    }
}

function runProposalGeneration() {
    // Validação de URL (aceita 99freelas e Freelancer.com)
    const isBidPage99freelas = window.location.href.includes("/project/bid/");
    const isBidPageFreelancer = CURRENT_SITE === 'freelancer' && window.location.href.includes("/projects/");

    if (!isBidPage99freelas && !isBidPageFreelancer) {
        showToast("❌ Funcionalidade disponível apenas na página de enviar proposta.");
        return;
    }

    if (!STATE.settings.apiKey) {
        showToast("⚠️ Configure sua API Key.");
        openSettings();
        return;
    }

    showToast("Gerando proposta...", "loading");

    // Coleta dados
    const context = scrapeProposalContext();

    // Monta Prompt (inclui moeda se disponível)
    const currencyInfo = context.currency ? `\n    Moeda: ${context.currency}` : '';
    const userPrompt = `
    DADOS DO PROJETO:
    Cliente/Projeto: ${context.clientName}
    Descrição: ${context.description}
    Orçamento/Budget: ${context.avgValue}${currencyInfo}
    Prazo Médio: ${context.avgTime}

    MEU PROMPT DE PROPOSTA:
    ${STATE.settings.proposalPrompt}

    IMPORTANTE: O preço deve ser sugerido na moeda ${context.currency || 'do projeto'}. Retorne apenas o valor numérico no campo "price".
    
    Gere o JSON com a mensagem, preço sugerido (apenas número) e prazo em dias.
    `;

    const systemInstruction = `${PROPOSAL_SYSTEM_INSTRUCTION}\nMEU PERFIL: ${STATE.settings.userProfile}`;

    // Chama API
    chrome.runtime.sendMessage({
        action: "geminiRequest",
        taskType: "GENERATE_PROPOSAL",
        apiKey: STATE.settings.apiKey,
        systemInstruction: systemInstruction,
        userPrompt: userPrompt
    }, (response) => {
        if (!response || !response.success) {
            console.error("[Auto-Proposal] Error:", response?.error);
            showToast("❌ Erro ao gerar proposta.");
            return;
        }

        let data = response.data; // Pode vir como String ou Objeto

        // --- DEBUG LOGGING ---
        console.group("[Auto-Proposal Debug]");
        console.log("Raw Response Type:", typeof data);
        console.log("Raw Response Content:", data);
        console.groupEnd();
        // ---------------------

        // SAFETY PARSER: Se for string, limpa Markdown e faz parse
        if (typeof data === 'string') {
            try {
                console.log("[Auto-Proposal] Cleaning Markdown from String...");
                // Remove ```json e ``` (e possíveis espaços extras)
                const cleanText = data.replace(/```json\s*/i, '').replace(/```/g, '').trim();
                data = JSON.parse(cleanText);
                console.log("[Auto-Proposal] Parsed JSON:", data);
            } catch (e) {
                console.error("[Auto-Proposal] Failed to parse JSON string:", e);
                showToast("❌ Erro ao processar resposta da IA.");
                return;
            }
        }

        // Sanitização (Tenta converter string para numero se a IA mandou "15 dias")
        const cleanPrice = sanitizeNumber(data.price);
        const cleanDuration = sanitizeNumber(data.duration);

        if (data.message && (cleanPrice || cleanPrice === 0) && (cleanDuration || cleanDuration === 0)) {
            fillProposalForm({
                message: data.message,
                price: cleanPrice,
                duration: cleanDuration
            });
            showToast("✅ Proposta preenchida!");
        } else {
            console.warn("[Auto-Proposal] Validation Failed. Missing keys or invalid types.", data);
            showToast("⚠️ Resposta da IA incompleta. Veja o Console.");
        }
    });
}

// -----------------------------------------------------------------------------
// 7. INICIALIZAÇÃO & LISTENERS
// -----------------------------------------------------------------------------

function init() {
    injectStyles();
    createSidebar();
    createSettingsModal();
    createToast();

    chrome.storage.local.get(['apiKey', 'userProfile', 'proposalPrompt', 'shortcuts', 'autoProposalMode'], (result) => {
        if (result.apiKey) STATE.settings.apiKey = result.apiKey;
        if (result.userProfile) STATE.settings.userProfile = result.userProfile;
        if (result.proposalPrompt) STATE.settings.proposalPrompt = result.proposalPrompt;
        if (result.autoProposalMode !== undefined) STATE.settings.autoProposalMode = result.autoProposalMode;

        // FIX CRÍTICO: Merge de shortcuts com validação completa
        if (result.shortcuts) {
            STATE.settings.shortcuts = {
                ...STATE.settings.shortcuts, // Padrões
                ...result.shortcuts          // Salvos
            };

            // Garante que 'analyze' exista (caso o storage antigo esteja incompleto)
            if (!STATE.settings.shortcuts.analyze) {
                STATE.settings.shortcuts.analyze = { modifier: 'Shift', key: 'P' };
            }

            // Garante que 'generate' exista
            if (!STATE.settings.shortcuts.generate) {
                STATE.settings.shortcuts.generate = { modifier: 'Shift', key: 'G' };
            }
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
            const isOverHandle = (e.clientX >= rect.left - 20 && e.clientX <= rect.right + 20 && e.clientY >= rect.top - 20 && e.clientY <= rect.bottom + 20);
            if (!isOverHandle) {
                STATE.isHoveringEdge = false;
                handle.classList.remove('visible');
            }
        }
    });

    // KEYDOWN HANDLER (Shortcuts)
    document.addEventListener('keydown', (e) => {
        if (e.target.tagName === 'INPUT' || e.target.tagName === 'TEXTAREA') return;

        const checkShortcut = (sc) => {
            if (!sc) return false; // Segurança
            let modifierPressed = false;
            if (sc.modifier === 'Shift') modifierPressed = e.shiftKey;
            if (sc.modifier === 'Ctrl') modifierPressed = e.ctrlKey;
            if (sc.modifier === 'Alt') modifierPressed = e.altKey;
            if (sc.modifier === 'Cmd') modifierPressed = e.metaKey;
            return modifierPressed && e.key.toUpperCase() === sc.key.toUpperCase();
        };

        // Usa optional chaining ou fallback
        const scAnalyze = STATE.settings.shortcuts.analyze;
        const scGenerate = STATE.settings.shortcuts.generate;

        if (scAnalyze && checkShortcut(scAnalyze)) {
            e.preventDefault();
            runProjectAnalysis();
        }

        if (scGenerate && checkShortcut(scGenerate)) {
            e.preventDefault();
            runProposalGeneration();
        }
    });

    // URL MONITOR (Auto Mode)
    setInterval(() => {
        if (!STATE.settings.autoProposalMode) return;

        const currentUrl = window.location.href;
        // Usamos includes para ser mais permissivo com query params
        const isBidPage = currentUrl.includes("/project/bid/");

        // Se não estamos na página de bid, limpamos o lastAutoRunUrl
        // Isso garante que se o usuário voltar para a página, o script rode novamente
        if (!isBidPage) {
            STATE.lastAutoRunUrl = '';
            return;
        }

        // Se estamos na página de bid E ainda não rodamos para esta URL específica
        if (isBidPage && STATE.lastAutoRunUrl !== currentUrl) {

            // FIX IMPORTANTE: Verifica se o formulário já existe no DOM
            // Evita rodar em página de "Loading..." ou antes do render completo
            const proposalForm = document.getElementById('proposta');

            if (proposalForm) {
                STATE.lastAutoRunUrl = currentUrl;
                console.log("[Auto-Proposal] Página de Proposta detectada e carregada. Iniciando...");
                showToast("🤖 Modo Auto: Gerando proposta...", "loading");
                runProposalGeneration();
            }
        }
    }, 1000); // Intervalo de checagem mais rápido (1s)
}

if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
} else {
    init();
}