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
🔥 PROMPT DEFINITIVO — PROPOSTAS QUE FECHAM PROJETO
Você é uma IA especialista em fechamento de projetos de tecnologia, com foco em conversão, autoridade, clareza estratégica e persuasão profissional.
Seu papel não é listar tecnologias, mas convencer o cliente de que a solução será entregue com excelência, previsibilidade e impacto real no negócio.

📌 PERFIL DO PROFISSIONAL
O profissional que você representa é Patrick Gomes Siqueira, Desenvolvedor Full Stack Sênior, com mais de 7 anos de experiência.
Patrick é Top Freelancer Plus no 99Freelas, está entre os Top 60–100 profissionais da plataforma, possui avaliação 5 estrelas e histórico consistente de projetos entregues com alto nível técnico, organização e responsabilidade.
Ele não atua como executor de tarefas, mas como parceiro técnico estratégico, responsável por decisões que impactam diretamente o resultado do projeto e o sucesso do cliente.

  🎯 OBJETIVO PRINCIPAL
  Gerar uma proposta profissional, formal, humana e altamente persuasiva. Retorne APENAS um JSON válido.
  
  📐 REGRAS OBRIGATÓRIAS DO TEXTO
  ✔ LIMITE DE TAMANHO: A proposta deve ter no MÁXIMO 2.500 caracteres. Nunca ultrapasse este limite.
  ✔ 100% Formal — Sem informalidades, emojis ou linguagem coloquial
  ✔ 100% Confiante — Proibido: "posso", "consigo", "tentarei". Usar: "realizarei", "implementarei", "entregarei"
  ✔ Humano, direto e profissional — Texto fluido, sem frases genéricas
  ✔ Sem redundâncias — Nunca repetir o texto do projeto
  ✔ Texto em funil — Cada parágrafo deve aumentar a confiança
  
  🧩 ESTRUTURA OBRIGATÓRIA (Dentro do campo "message"):
  1. SAUDAÇÃO INICIAL — Nome, senioridade, interesse estratégico no projeto
  2. ENTENDIMENTO DO PROJETO — Problema real, impacto de negócio (sem copiar o enunciado)
  3. SOLUÇÃO — Como o problema será resolvido, método e domínio
  4. ORÇAMENTO — Apresentado com custo-benefício
  5. PRAZO — Apresentado como realista e atrativo
  6. FINALIZAÇÃO (EXATA): "Fico na expectativa de seu pronunciamento e me encontro às ordens para maiores esclarecimentos.\\nSaudações,\\nPatrick Siqueira"
  
  REGRAS DE FORMATAÇÃO (ESTRITO):
  1. Retorne APENAS um JSON válido.
  2. Formato JSON:
  {
    "message": "Texto completo e persuasivo aqui...",
    "price": 0,
    "duration": 0
  }
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
    user: null, // Usuário logado na extensão
    settings: {
        apiKey: '',  // Gemini API Key
        groqApiKey: '', // Groq API Key
        groqModel: 'llama-3.3-70b-versatile', // Modelo Groq padrão
        openaiKeys: [],    // OpenAI API Keys (cluster)
        claudeKeys: [],    // Anthropic Claude API Keys (cluster)
        openaiModel: 'gpt-4o-mini',     // Modelo OpenAI padrão
        claudeModel: 'claude-haiku-4-5', // Modelo Claude padrão
        preferredProvider: 'openai',     // Provider preferido
        apiUrl: 'https://geral-auto-proposal-api.r954jc.easypanel.host', // Sua API em produção
        useBackend: true,               // Ativado por padrão agora que está no ar
        activePlatform: '99freelas', // '99freelas' ou 'freelancer'
        // Prompts para 99freelas
        userProfile_99freelas: 'Sou um Desenvolvedor Fullstack Sênior (Node.js, React, Python). Busco projetos de desenvolvimento web, automação e APIs.',
        proposalPrompt_99freelas: 'Escreva uma proposta curta, direta e persuasiva. Foque em resolver o problema do cliente. Use tom profissional mas próximo.',
        // Prompts para Freelancer.com
        userProfile_freelancer: 'I am a Senior Fullstack Developer (Node.js, React, Python). Looking for web development, automation and API projects.',
        proposalPrompt_freelancer: 'Write a short, direct and persuasive proposal. Focus on solving the client problem. Use professional but friendly tone.',
        // Configurações gerais (mantidas para compatibilidade)
        userProfile: '',
        proposalPrompt: '',
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
            /* --- SUPERFÍCIES (macOS Vibrancy) --- */
            --ap-glass-bg: rgba(38, 38, 42, 0.72);
            --ap-glass-bg-elevated: rgba(52, 52, 58, 0.82);
            --ap-glass-border: rgba(255, 255, 255, 0.08);
            --ap-glass-border-highlight: rgba(255, 255, 255, 0.14);
            
            /* --- TIPOGRAFIA --- */
            --ap-text-primary: rgba(255, 255, 255, 0.98);
            --ap-text-secondary: rgba(255, 255, 255, 0.55);
            --ap-text-tertiary: rgba(255, 255, 255, 0.35);
            
            /* --- CORES DE ACENTO (Apple Blue) --- */
            --ap-accent-color: #0A84FF;
            --ap-accent-hover: #409CFF;
            --ap-accent-gradient: linear-gradient(180deg, #3B9EFF 0%, #0A84FF 100%);
            
            /* --- SEMÂNTICAS --- */
            --ap-success: #30D158;
            --ap-warning: #FFD60A;
            --ap-danger: #FF453A;
            
            /* --- SOMBRAS (Elevation) --- */
            --ap-shadow-sm: 0 2px 8px rgba(0,0,0,0.2);
            --ap-shadow-md: 0 8px 24px rgba(0,0,0,0.35);
            --ap-shadow-lg: 0 24px 56px rgba(0,0,0,0.55);
            --ap-shadow-glow: 0 0 20px rgba(10, 132, 255, 0.3);
            
            /* --- ESPAÇAMENTOS --- */
            --ap-spacing-xs: 4px;
            --ap-spacing-sm: 8px;
            --ap-spacing-md: 16px;
            --ap-spacing-lg: 24px;
            --ap-spacing-xl: 32px;
            
            /* --- RAIOS DE BORDA --- */
            --ap-radius-sm: 6px;
            --ap-radius-md: 10px;
            --ap-radius-lg: 14px;
            --ap-radius-xl: 18px;
            
            /* --- ANIMAÇÕES --- */
            --ap-ease: cubic-bezier(0.25, 0.46, 0.45, 0.94);
            --ap-ease-spring: cubic-bezier(0.175, 0.885, 0.32, 1.275);
            --ap-ease-out: cubic-bezier(0.16, 1, 0.3, 1);
            --ap-duration-fast: 150ms;
            --ap-duration-normal: 250ms;
            --ap-duration-slow: 400ms;
            
            /* --- FONTE --- */
            --ap-font: -apple-system, BlinkMacSystemFont, "SF Pro Display", "Inter", "Segoe UI", sans-serif;
            --ap-font-mono: "SF Mono", "Fira Code", "Consolas", monospace;
        }

        /* --- LOGIN SCREEN --- */
        .ap-login-container {
            display: flex;
            flex-direction: column;
            align-items: center;
            justify-content: center;
            height: 100%;
            padding: var(--ap-spacing-xl);
            text-align: center;
        }

        .ap-login-logo {
            font-size: 24px;
            font-weight: 800;
            margin-bottom: 8px;
            background: var(--ap-accent-gradient);
            -webkit-background-clip: text;
            -webkit-text-fill-color: transparent;
        }

        .ap-login-subtitle {
            color: var(--ap-text-secondary);
            font-size: 14px;
            margin-bottom: 32px;
        }

        .ap-login-form {
            width: 100%;
            display: flex;
            flex-direction: column;
            gap: 16px;
        }

        .ap-login-input-group {
            display: flex;
            flex-direction: column;
            align-items: flex-start;
            gap: 6px;
        }

        .ap-login-label {
            font-size: 12px;
            font-weight: 600;
            color: var(--ap-text-secondary);
            margin-left: 4px;
        }

        .ap-login-input {
            width: 100%;
            background: rgba(255,255,255,0.04);
            border: 1px solid var(--ap-glass-border);
            border-radius: var(--ap-radius-md);
            padding: 12px 16px;
            color: white;
            font-size: 14px;
            transition: all 0.2s;
        }

        .ap-login-input:focus {
            outline: none;
            border-color: var(--ap-accent-color);
            background: rgba(255,255,255,0.08);
            box-shadow: 0 0 0 4px rgba(10, 132, 255, 0.15);
        }

        .ap-login-button {
            margin-top: 12px;
            background: var(--ap-accent-gradient);
            border: none;
            border-radius: var(--ap-radius-md);
            padding: 14px;
            color: white;
            font-weight: 700;
            cursor: pointer;
            transition: all 0.2s;
            box-shadow: var(--ap-shadow-sm);
        }

        .ap-login-button:hover {
            transform: translateY(-1px);
            box-shadow: var(--ap-shadow-glow);
        }

        .ap-login-button:active {
            transform: translateY(0);
        }

        .ap-login-error {
            color: var(--ap-danger);
            font-size: 12px;
            margin-top: 12px;
            display: none;
        }

        .ap-logout-btn {
            background: transparent;
            border: 1px solid rgba(255,255,255,0.1);
            border-radius: var(--ap-radius-md);
            padding: 8px 12px;
            color: var(--ap-text-secondary);
            font-size: 12px;
            cursor: pointer;
            transition: all 0.2s;
            display: flex;
            align-items: center;
            gap: 6px;
        }

        .ap-logout-btn:hover {
            background: rgba(255, 69, 58, 0.1);
            color: var(--ap-danger);
            border-color: rgba(255, 69, 58, 0.2);
        }

        /* --- SIDEBAR CONTAINER (macOS Vibrancy) --- */
        #ap-sidebar {
            position: fixed;
            top: 0;
            right: -420px;
            width: 420px;
            height: 100vh;
            background: linear-gradient(180deg, rgba(44, 44, 50, 0.85) 0%, rgba(30, 30, 36, 0.92) 100%);
            backdrop-filter: blur(80px) saturate(200%);
            -webkit-backdrop-filter: blur(80px) saturate(200%);
            border-left: 1px solid rgba(255,255,255,0.1);
            box-shadow: 
                -1px 0 0 rgba(255,255,255,0.05) inset,
                -20px 0 60px rgba(0,0,0,0.5);
            z-index: 2147483647;
            transition: right 0.5s var(--ap-ease-out);
            display: flex;
            flex-direction: column;
            font-family: var(--ap-font);
            color: var(--ap-text-primary);
        }

        #ap-sidebar.open { right: 0; }

        /* --- HANDLE (Floating Pill) --- */
        #ap-sidebar-handle {
            position: absolute;
            left: -18px;
            top: 50%;
            transform: translateY(-50%) scale(0.9);
            width: 36px;
            height: 72px;
            background: linear-gradient(180deg, rgba(60,60,68,0.9) 0%, rgba(45,45,52,0.95) 100%);
            backdrop-filter: blur(40px) saturate(180%);
            -webkit-backdrop-filter: blur(40px) saturate(180%);
            border: 1px solid rgba(255,255,255,0.12);
            border-radius: 18px;
            display: flex;
            align-items: center;
            justify-content: center;
            cursor: pointer;
            opacity: 0;
            transition: all 0.4s var(--ap-ease-spring);
            pointer-events: none;
            box-shadow: 
                0 0 0 0.5px rgba(255,255,255,0.08) inset,
                0 8px 32px rgba(0,0,0,0.4);
        }

        #ap-sidebar-handle svg {
            opacity: 0.6;
            transition: opacity 0.2s, transform 0.3s var(--ap-ease);
            filter: drop-shadow(0 1px 2px rgba(0,0,0,0.3));
        }

        #ap-sidebar-handle.visible {
            opacity: 1;
            pointer-events: all;
            transform: translateY(-50%) translateX(-6px) scale(1);
        }

        #ap-sidebar-handle:hover {
            background: linear-gradient(180deg, rgba(70,70,80,0.95) 0%, rgba(50,50,60,0.98) 100%);
            transform: translateY(-50%) translateX(-10px) scale(1.08);
            border-color: var(--ap-accent-color);
            box-shadow: 
                0 0 0 0.5px rgba(255,255,255,0.12) inset,
                0 0 24px rgba(10, 132, 255, 0.25),
                0 8px 32px rgba(0,0,0,0.5);
        }

        #ap-sidebar-handle:hover svg {
            opacity: 1;
            transform: translateX(-2px);
        }

        /* --- HEADER (macOS Window Title Bar) --- */
        .ap-header {
            padding: 18px 20px;
            display: flex;
            justify-content: space-between;
            align-items: center;
            border-bottom: 1px solid rgba(255,255,255,0.06);
            background: linear-gradient(180deg, rgba(255,255,255,0.04) 0%, transparent 100%);
            flex-shrink: 0;
            position: relative;
        }

        .ap-header::after {
            content: '';
            position: absolute;
            bottom: -1px;
            left: 20px;
            right: 20px;
            height: 1px;
            background: linear-gradient(90deg, transparent, rgba(255,255,255,0.08), transparent);
        }

        .ap-header h2 {
            margin: 0;
            font-size: 14px;
            font-weight: 600;
            letter-spacing: -0.2px;
            color: var(--ap-text-primary);
            text-shadow: 0 1px 2px rgba(0,0,0,0.3);
        }

        .ap-icon-btn {
            background: rgba(255,255,255,0.06);
            border: 1px solid rgba(255,255,255,0.08);
            color: var(--ap-text-secondary);
            cursor: pointer;
            padding: 7px;
            border-radius: 8px;
            transition: all var(--ap-duration-fast) var(--ap-ease);
            display: flex;
            align-items: center;
            justify-content: center;
        }

        .ap-icon-btn:hover {
            background: rgba(255,255,255,0.12);
            border-color: rgba(255,255,255,0.15);
            color: var(--ap-text-primary);
        }

        .ap-icon-btn:active {
            transform: scale(0.94);
            background: rgba(255,255,255,0.08);
        }

        /* --- CONTENT AREA (SCROLLABLE) --- */
        .ap-content {
            flex: 1;
            overflow-y: auto;
            padding: 16px 16px 20px;
            display: flex;
            flex-direction: column;
            gap: 10px;
            min-height: 0;
        }

        .ap-content p {
            color: #fff;
        }
        
        /* Custom Scrollbar (macOS Style) */
        .ap-content::-webkit-scrollbar { width: 10px; }
        .ap-content::-webkit-scrollbar-track { background: transparent; margin: 8px 0; }
        .ap-content::-webkit-scrollbar-thumb { 
            background: rgba(255,255,255,0.12); 
            border-radius: 100px;
            border: 3px solid transparent;
            background-clip: padding-box;
        }
        .ap-content::-webkit-scrollbar-thumb:hover { 
            background: rgba(255,255,255,0.2); 
            background-clip: padding-box;
        }

        .ap-empty-state {
            margin-top: 80px;
            text-align: center;
            color: var(--ap-text-tertiary);
            font-size: 13px;
            line-height: 1.7;
            padding: 0 40px;
        }

        .ap-empty-state svg {
            margin-bottom: 20px;
            opacity: 0.3;
            filter: drop-shadow(0 2px 4px rgba(0,0,0,0.3));
        }

        /* --- PROJECT CARDS (macOS List Item Style) --- */
        .ap-card {
            background: linear-gradient(135deg, rgba(255,255,255,0.05) 0%, rgba(255,255,255,0.02) 100%);
            border: 1px solid rgba(255,255,255,0.06);
            border-radius: 12px;
            padding: 14px 16px 14px 18px;
            cursor: pointer;
            transition: all 0.25s var(--ap-ease);
            position: relative;
            overflow: hidden;
            flex-shrink: 0;
        }

        /* Accent indicator bar (left side) */
        .ap-card::before {
            content: '';
            position: absolute;
            top: 12px;
            bottom: 12px;
            left: 0;
            width: 3px;
            background: var(--ap-accent-color);
            border-radius: 0 3px 3px 0;
            opacity: 0;
            transform: scaleY(0.5);
            transition: all 0.25s var(--ap-ease-spring);
        }

        /* Subtle top highlight */
        .ap-card::after {
            content: '';
            position: absolute;
            top: 0;
            left: 20px;
            right: 20px;
            height: 1px;
            background: linear-gradient(90deg, transparent, rgba(255,255,255,0.06), transparent);
        }

        .ap-card:hover {
            background: linear-gradient(135deg, rgba(255,255,255,0.09) 0%, rgba(255,255,255,0.04) 100%);
            border-color: rgba(255,255,255,0.12);
            transform: translateX(-4px);
            box-shadow: 
                4px 4px 20px rgba(0,0,0,0.2),
                0 0 0 1px rgba(255,255,255,0.05) inset;
        }

        .ap-card:hover::before {
            opacity: 1;
            transform: scaleY(1);
        }

        .ap-card:active {
            transform: translateX(-2px) scale(0.995);
            transition-duration: 0.1s;
        }

        .ap-hidden { display: none !important; }

        .ap-card-title {
            font-size: 13px;
            font-weight: 600;
            color: #5CB8FF;
            margin-bottom: 6px;
            line-height: 1.4;
            letter-spacing: -0.1px;
            display: flex;
            align-items: center;
            gap: 6px;
        }

        /* Optional: Add arrow icon on hover */
        .ap-card-title::after {
            content: '→';
            font-size: 12px;
            opacity: 0;
            transform: translateX(-8px);
            transition: all 0.25s var(--ap-ease);
            color: var(--ap-accent-color);
        }

        .ap-card:hover .ap-card-title::after {
            opacity: 0.7;
            transform: translateX(0);
        }

        /* --- EXPANDABLE DESCRIPTION --- */
        .ap-card-desc {
            font-size: 12px;
            color: rgba(255,255,255,0.6);
            line-height: 1.6;
            
            display: -webkit-box;
            -webkit-line-clamp: 2;
            -webkit-box-orient: vertical;
            overflow: hidden;
            text-overflow: ellipsis;
            
            max-height: 42px;
            transition: max-height 0.5s var(--ap-ease), color 0.3s;
        }

        .ap-card:hover .ap-card-desc {
            -webkit-line-clamp: unset;
            max-height: 600px;
            color: rgba(255,255,255,0.85);
            transition-delay: 0.5s;
        }
        
        .ap-card-desc strong, .ap-card-desc b { 
            color: #fff; 
            font-weight: 600; 
        }
        .ap-card-desc em, .ap-card-desc i { 
            color: var(--ap-text-secondary); 
            font-style: italic; 
        }
        .ap-card-desc code { 
            background: rgba(255,255,255,0.1); 
            padding: 1px 5px; 
            border-radius: 4px; 
            font-family: var(--ap-font-mono); 
            font-size: 0.85em; 
        }
        .ap-card-desc ul { padding-left: 14px; margin: 4px 0; }

        /* --- FOOTER (Subtle Branding) --- */
        .ap-footer {
            padding: 12px 20px;
            border-top: 1px solid rgba(255,255,255,0.05);
            background: linear-gradient(180deg, rgba(0,0,0,0.1) 0%, rgba(0,0,0,0.2) 100%);
            text-align: center;
            font-size: 10px;
            color: rgba(18, 183, 224, 0.7);
            flex-shrink: 0;
            letter-spacing: 0.8px;
            text-transform: uppercase;
            font-weight: 500;
        }

        /* --- PRIMARY BUTTON (macOS Style) --- */
        .ap-btn-primary {
            width: 100%;
            padding: 12px 20px;
            background: var(--ap-accent-gradient);
            color: white;
            border: none;
            border-radius: var(--ap-radius-md);
            font-size: 14px;
            font-weight: 600;
            letter-spacing: -0.2px;
            cursor: pointer;
            transition: all var(--ap-duration-fast) var(--ap-ease);
            box-shadow: 
                0 1px 0 rgba(255,255,255,0.1) inset,
                0 -1px 0 rgba(0,0,0,0.1) inset,
                var(--ap-shadow-sm);
        }

        .ap-btn-primary:hover {
            filter: brightness(1.1);
            box-shadow: 
                0 1px 0 rgba(255,255,255,0.15) inset,
                0 -1px 0 rgba(0,0,0,0.1) inset,
                var(--ap-shadow-glow);
        }

        .ap-btn-primary:active {
            transform: scale(0.98);
            filter: brightness(0.95);
        }

        /* --- MODAL OVERLAY (macOS Backdrop) --- */
        #ap-modal-overlay {
            position: fixed;
            top: 0; left: 0; right: 0; bottom: 0;
            background: rgba(0, 0, 0, 0.5);
            backdrop-filter: blur(20px) saturate(180%);
            -webkit-backdrop-filter: blur(20px) saturate(180%);
            z-index: 2147483648;
            display: none;
            align-items: center;
            justify-content: center;
            opacity: 0;
            transition: opacity 0.25s var(--ap-ease);
        }

        #ap-modal-overlay.show { display: flex; opacity: 1; }

        /* --- MODAL (macOS Window) --- */
        .ap-modal {
            background: var(--ap-glass-bg);
            backdrop-filter: blur(72px) saturate(190%);
            -webkit-backdrop-filter: blur(72px) saturate(190%);
            width: 540px !important; /* Força a largura fixa */
            max-width: 90vw;
            max-height: 85vh;
            border-radius: var(--ap-radius-xl);
            border: 1px solid var(--ap-glass-border-highlight);
            box-shadow: 
                0 0 0 0.5px rgba(255,255,255,0.1) inset,
                var(--ap-shadow-lg);
            display: flex !important;
            flex-direction: column !important;
            color: var(--ap-text-primary);
            transform: scale(0.96) translateY(10px);
            transition: transform 0.3s var(--ap-ease-spring);
            overflow: hidden;
            position: relative;
        }
        
        #ap-modal-overlay.show .ap-modal { 
            transform: scale(1) translateY(0); 
        }

        /* --- MODAL HEADER (macOS Title Bar) --- */
        .ap-modal-header { 
            display: flex; 
            justify-content: space-between; 
            align-items: center; 
            padding: 16px 20px;
            background: linear-gradient(180deg, rgba(255,255,255,0.04) 0%, rgba(255,255,255,0) 100%);
            border-bottom: 1px solid var(--ap-glass-border);
            flex-shrink: 0;
        }

        .ap-modal-header h3 { 
            margin: 0; 
            font-size: 14px; 
            font-weight: 600;
            letter-spacing: -0.2px;
            color: #fff;
        }

        /* Close Button (macOS Red Dot) */
        .ap-close-btn {
            width: 13px;
            height: 13px;
            border-radius: 50%;
            background: var(--ap-danger);
            border: none;
            cursor: pointer;
            transition: all var(--ap-duration-fast);
            position: relative;
            display: flex;
            align-items: center;
            justify-content: center;
        }

        .ap-close-btn::before,
        .ap-close-btn::after {
            content: '';
            position: absolute;
            width: 7px;
            height: 1.5px;
            background: rgba(0,0,0,0.5);
            opacity: 0;
            transition: opacity var(--ap-duration-fast);
        }

        .ap-close-btn::before { transform: rotate(45deg); }
        .ap-close-btn::after { transform: rotate(-45deg); }

        .ap-close-btn:hover::before,
        .ap-close-btn:hover::after {
            opacity: 1;
        }

        .ap-close-btn:active {
            transform: scale(0.9);
        }

        /* --- MODAL BODY (Scrollable) --- */
        .ap-modal-body {
            flex: 1 !important;
            overflow-y: auto !important;
            overflow-x: hidden !important;
            display: flex !important;
            flex-direction: column !important;
            gap: 20px !important;
            padding: 24px !important;
            min-height: 0; /* Essencial para scroll em flexbox */
        }

        .ap-modal-body::-webkit-scrollbar { width: 8px; }
        .ap-modal-body::-webkit-scrollbar-track { background: transparent; }
        .ap-modal-body::-webkit-scrollbar-thumb { 
            background: rgba(255,255,255,0.12); 
            border-radius: 100px;
            border: 2px solid transparent;
            background-clip: padding-box;
        }

        /* --- INPUT GROUPS (macOS Style) --- */
        .ap-input-group { 
            display: flex; 
            flex-direction: column; 
            gap: 8px; 
        }

        .ap-input-group label { 
            font-size: 12px; 
            text-transform: uppercase; 
            color: var(--ap-text-secondary); 
            font-weight: 600; 
            letter-spacing: 0.5px;
        }

        .ap-input, .ap-textarea {
            background: rgba(0, 0, 0, 0.25);
            border: 1px solid var(--ap-glass-border);
            border-radius: var(--ap-radius-md);
            padding: 12px 14px;
            color: var(--ap-text-primary) !important;
            font-family: var(--ap-font);
            font-size: 13px;
            line-height: 1.5;
            transition: all var(--ap-duration-fast) var(--ap-ease);
        }

        .ap-input::placeholder, .ap-textarea::placeholder {
            color: var(--ap-text-tertiary);
        }
        
        .ap-input:hover, .ap-textarea:hover {
            border-color: var(--ap-glass-border-highlight);
        }
        
        .ap-input:focus, .ap-textarea:focus {
            background: rgba(0, 0, 0, 0.35) !important;
            border-color: var(--ap-accent-color) !important;
            outline: none;
            box-shadow: 0 0 0 3px rgba(10, 132, 255, 0.2);
        }

        .ap-textarea {
            display: block !important;
            width: 100% !important;
            min-height: 100px !important;
            resize: vertical;
            box-sizing: border-box;
        }

        /* --- SELECT (macOS Style) --- */
        .ap-select {
            background: rgba(0, 0, 0, 0.25);
            border: 1px solid var(--ap-glass-border);
            border-radius: var(--ap-radius-md);
            padding: 12px 14px;
            color: var(--ap-text-primary) !important;
            font-family: var(--ap-font);
            font-size: 13px;
            line-height: 1.5;
            transition: all var(--ap-duration-fast) var(--ap-ease);
            cursor: pointer;
            appearance: none;
            -webkit-appearance: none;
            background-image: url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='12' height='12' viewBox='0 0 24 24' fill='none' stroke='rgba(255,255,255,0.5)' stroke-width='2' stroke-linecap='round' stroke-linejoin='round'%3E%3Cpolyline points='6 9 12 15 18 9'%3E%3C/polyline%3E%3C/svg%3E");
            background-repeat: no-repeat;
            background-position: right 14px center;
            padding-right: 40px;
        }

        .ap-select:hover {
            border-color: var(--ap-glass-border-highlight);
        }

        .ap-select:focus {
            background-color: rgba(0, 0, 0, 0.35);
            border-color: var(--ap-accent-color) !important;
            outline: none;
            box-shadow: 0 0 0 3px rgba(10, 132, 255, 0.2);
        }

        .ap-select option {
            background: #2a2a2e;
            color: #fff;
            padding: 8px;
        }

        /* --- SECTION DIVIDER --- */
        .ap-section-divider {
            height: 1px;
            background: var(--ap-glass-border);
            margin: 4px 0;
        }

        /* --- SHORTCUT BUTTONS (Keyboard Style) --- */
        .ap-shortcut-row {
            display: flex;
            justify-content: space-between;
            align-items: center;
            padding: 8px 0;
        }

        .ap-shortcut-row span { 
            font-size: 13px; 
            color: var(--ap-text-secondary);
        }

        .ap-shortcut-btn {
            background: linear-gradient(180deg, rgba(255,255,255,0.1) 0%, rgba(255,255,255,0.05) 100%);
            border: 1px solid var(--ap-glass-border-highlight);
            border-bottom-width: 2px;
            color: var(--ap-text-primary);
            padding: 6px 14px;
            border-radius: var(--ap-radius-sm);
            cursor: pointer;
            font-family: var(--ap-font-mono);
            font-size: 11px;
            font-weight: 500;
            letter-spacing: 0.5px;
            transition: all var(--ap-duration-fast) var(--ap-ease);
            text-align: center;
            min-width: 90px;
            box-shadow: 
                0 1px 0 rgba(255,255,255,0.05) inset,
                0 2px 4px rgba(0,0,0,0.15);
        }

        .ap-shortcut-btn:hover { 
            background: linear-gradient(180deg, rgba(255,255,255,0.15) 0%, rgba(255,255,255,0.08) 100%);
            border-color: var(--ap-text-secondary);
        }

        .ap-shortcut-btn:active {
            transform: translateY(1px);
            box-shadow: none;
        }

        .ap-shortcut-btn.recording {
            background: var(--ap-accent-gradient);
            border-color: var(--ap-accent-color);
            animation: pulse 1s infinite;
        }

        /* --- TOGGLE SWITCH (iOS 17 Style) --- */
        .ap-toggle {
            display: flex;
            align-items: center;
            gap: 12px;
            cursor: pointer;
            padding: 8px 0;
        }

        .ap-toggle input { display: none; }

        .ap-toggle-track {
            width: 51px; 
            height: 31px;
            background: rgba(120, 120, 128, 0.32);
            border-radius: 16px;
            position: relative;
            transition: background 0.3s var(--ap-ease);
            flex-shrink: 0;
        }

        .ap-toggle-thumb {
            width: 27px; 
            height: 27px;
            background: #fff;
            border-radius: 50%;
            position: absolute;
            top: 2px; 
            left: 2px;
            transition: transform 0.3s var(--ap-ease-spring);
            box-shadow: 
                0 3px 8px rgba(0,0,0,0.15),
                0 3px 1px rgba(0,0,0,0.06);
        }

        .ap-toggle input:checked + .ap-toggle-track { 
            background: var(--ap-success); 
        }

        .ap-toggle input:checked + .ap-toggle-track .ap-toggle-thumb { 
            transform: translateX(20px); 
        }

        .ap-toggle-label {
            font-size: 13px;
            color: var(--ap-text-primary);
            font-weight: 400;
        }

        /* --- MODAL FOOTER --- */
        .ap-modal-footer {
            padding: 16px 20px;
            border-top: 1px solid var(--ap-glass-border);
            background: rgba(0,0,0,0.1);
        }
        
        @keyframes pulse { 
            0%, 100% { opacity: 1; } 
            50% { opacity: 0.7; } 
        }

        /* --- TOAST (iOS Notification Style) --- */
        #ap-toast {
            position: fixed;
            top: 24px;
            left: 50%;
            transform: translateX(-50%) translateY(-120px);
            background: var(--ap-glass-bg-elevated);
            backdrop-filter: blur(40px) saturate(180%);
            -webkit-backdrop-filter: blur(40px) saturate(180%);
            color: var(--ap-text-primary);
            padding: 12px 20px;
            border-radius: 980px;
            box-shadow: 
                0 0 0 0.5px rgba(255,255,255,0.1) inset,
                0 12px 40px rgba(0,0,0,0.4);
            display: flex;
            align-items: center;
            gap: 10px;
            z-index: 2147483649;
            transition: transform 0.5s var(--ap-ease-spring);
            font-size: 13px;
            font-weight: 500;
            letter-spacing: -0.1px;
            border: 1px solid var(--ap-glass-border-highlight);
        }

        #ap-toast.show { 
            transform: translateX(-50%) translateY(0); 
        }

        .ap-spin { 
            animation: spin 1s infinite linear; 
            display: block; 
        }

        @keyframes spin { 
            100% { transform: rotate(360deg); } 
        }
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

function renderSidebarContent() {
    const sidebar = document.getElementById('ap-sidebar');
    if (!sidebar) return;

    // Remove conteúdo anterior mantendo o handle
    const handle = document.getElementById('ap-sidebar-handle');
    sidebar.innerHTML = '';
    sidebar.appendChild(handle);

    if (!STATE.user) {
        // TELA DE LOGIN
        const loginContainer = document.createElement('div');
        loginContainer.className = 'ap-login-container';
        loginContainer.innerHTML = `
            <div class="ap-login-logo">Auto-Proposal</div>
            <div class="ap-login-subtitle">Faça login para começar a converter.</div>
            
            <form id="ap-login-form" class="ap-login-form">
                <div class="ap-login-input-group">
                    <label class="ap-login-label">E-mail</label>
                    <input type="email" id="ap-login-email" class="ap-login-input" placeholder="seu@email.com" required>
                </div>
                <div class="ap-login-input-group">
                    <label class="ap-login-label">Senha</label>
                    <input type="password" id="ap-login-password" class="ap-login-input" placeholder="••••••••" required>
                </div>
                <div id="ap-login-error" class="ap-login-error">Credenciais inválidas.</div>
                <button type="submit" id="ap-login-btn" class="ap-login-button">Entrar no Sistema</button>
            </form>
            <div class="ap-footer" style="margin-top: auto; padding-top: 20px;">v4.8 • Multi-User</div>
        `;
        sidebar.appendChild(loginContainer);

        document.getElementById('ap-login-form').addEventListener('submit', handleLogin);
    } else {
        // TELA PRINCIPAL (PROJETOS)
        sidebar.innerHTML += `
            <div class="ap-header">
                <div>
                    <h2 style="margin-bottom: 2px;">Projetos em Potencial</h2>
                    <span style="font-size: 11px; color: var(--ap-text-secondary);">Logado como: <b>${STATE.user.name}</b></span>
                </div>
                <div style="display: flex; gap: 8px;">
                    <button id="ap-settings-btn" class="ap-icon-btn" title="Configurações">
                        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="3"></circle><path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1 0 2.83 2 2 0 0 1-2.83 0l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-2 2 2 2 0 0 1-2-2v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83 0 2 2 0 0 1 0-2.83l.06-.06a1.65 1.65 0 0 0 .33-1.82 1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1-2-2 2 2 0 0 1 2-2h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 0-2.83 2 2 0 0 1 2.83 0l.06.06a1.65 1.65 0 0 0 1.82.33H9a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 2-2 2 2 0 0 1 2 2v.09a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 2 2 2 2 0 0 1-2 2h-.09a1.65 1.65 0 0 0-1.51 1z"></path></svg>
                    </button>
                    <button id="ap-logout-btn" class="ap-logout-btn" title="Sair">
                        Sair
                    </button>
                </div>
            </div>
            <div id="ap-project-list" class="ap-content">
                <div class="ap-empty-state">
                    <svg width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="rgba(255,255,255,0.2)" stroke-width="1" stroke-linecap="round" stroke-linejoin="round" style="margin-bottom: 16px;"><rect x="2" y="3" width="20" height="14" rx="2" ry="2"></rect><line x1="8" y1="21" x2="16" y2="21"></line><line x1="12" y1="17" x2="12" y2="21"></line></svg>
                    <p>Use o atalho para analisar.</p>
                </div>
            </div>
            <div class="ap-footer">Auto-Proposal AI • v4.8</div>
        `;

        document.getElementById('ap-settings-btn').addEventListener('click', openSettings);
        document.getElementById('ap-logout-btn').addEventListener('click', handleLogout);
        
        // Re-renderiza a lista de projetos se houver
        if (STATE.scrapedProjects.length > 0) {
            renderProjects(STATE.scrapedProjects);
        }
    }
}

async function handleLogin(e) {
    e.preventDefault();
    const email = document.getElementById('ap-login-email').value;
    const password = document.getElementById('ap-login-password').value;
    const btn = document.getElementById('ap-login-btn');
    const errorEl = document.getElementById('ap-login-error');

    btn.disabled = true;
    btn.innerText = 'Autenticando...';
    errorEl.style.display = 'none';

    try {
        const response = await fetch(`${STATE.settings.apiUrl}/api/auth/login`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ email, password })
        });

        const data = await response.json();

        if (data.success) {
            STATE.user = data.user;
            chrome.storage.local.set({ 'ap_user': data.user });
            renderSidebarContent();
        } else {
            errorEl.style.display = 'block';
            errorEl.innerText = data.error || 'Erro ao fazer login.';
        }
    } catch (err) {
        errorEl.style.display = 'block';
        errorEl.innerText = 'Erro ao conectar com a API.';
    } finally {
        btn.disabled = false;
        btn.innerText = 'Entrar no Sistema';
    }
}

function handleLogout() {
    STATE.user = null;
    chrome.storage.local.remove('ap_user');
    renderSidebarContent();
}

function createSidebar() {
    if (document.getElementById('ap-sidebar')) return;

    const sidebar = document.createElement('div');
    sidebar.id = 'ap-sidebar';
    sidebar.innerHTML = `
        <div id="ap-sidebar-handle" title="Abrir Auto-Proposal">
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#fff" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><polyline points="15 18 9 12 15 6"></polyline></svg>
        </div>
    `;

    document.body.appendChild(sidebar);
    
    // Verifica se já existe usuário salvo
    chrome.storage.local.get(['ap_user'], (result) => {
        if (result.ap_user) {
            STATE.user = result.ap_user;
        }
        renderSidebarContent();
    });

    document.getElementById('ap-sidebar-handle').addEventListener('click', (e) => { e.stopPropagation(); openSidebar(); });

    document.addEventListener('click', (e) => {
        const sidebar = document.getElementById('ap-sidebar');
        const handle = document.getElementById('ap-sidebar-handle');
        const settingsModal = document.getElementById('ap-modal-overlay');
        if (STATE.isSidebarOpen && !sidebar.contains(e.target) && !handle.contains(e.target) && settingsModal && !settingsModal.contains(e.target)) {
            closeSidebar();
        }
    });
}

function createSettingsModal() {
    if (document.getElementById('ap-modal-overlay')) return;

    const overlay = document.createElement('div');
    overlay.id = 'ap-modal-overlay';
    overlay.innerHTML = `
        <div class="ap-modal" style="width: 540px;">
            <div class="ap-modal-header">
                <button id="ap-close-modal" class="ap-close-btn" title="Fechar"></button>
                <h3>Configurações</h3>
                <div style="width: 13px;"></div>
            </div>
            
            <div class="ap-modal-body">

                <!-- ═══ IA PREFERIDA ═══ -->
                <div class="ap-input-group">
                    <label>🚀 IA Preferida (Primária)</label>
                    <select id="ap-preferred-provider" class="ap-select">
                        <option value="openai">OpenAI (GPT)</option>
                        <option value="claude">Anthropic (Claude)</option>
                        <option value="gemini">Google (Gemini) - Grátis</option>
                        <option value="groq">Groq (Llama/Mixtral) - Grátis</option>
                    </select>
                    <small style="color: var(--ap-text-tertiary); font-size: 10px;">Se falhar, o sistema tenta os demais providers automaticamente.</small>
                </div>

                <div class="ap-section-divider"></div>

                <!-- ═══ SEÇÕES DINÂMICAS ═══ -->
                <div id="ap-section-openai" class="ap-provider-section">
                    <div class="ap-input-group">
                        <label>Modelo OpenAI (Gerenciado via Backend)</label>
                        <select id="ap-openai-model" class="ap-select">
                            <option value="gpt-4o-mini">GPT-4o Mini (Ultra Barato)</option>
                            <option value="gpt-4o">GPT-4o (Equilibrado)</option>
                            <option value="gpt-5.5">GPT-5.5 (Novo Flagship)</option>
                            <option value="gpt-5.5-pro">GPT-5.5 Pro (Potência Máxima)</option>
                        </select>
                    </div>
                </div>

                <div id="ap-section-claude" class="ap-provider-section ap-hidden">
                    <div class="ap-input-group">
                        <label>Modelo Claude (Gerenciado via Backend)</label>
                        <select id="ap-claude-model" class="ap-select">
                            <option value="claude-haiku-4-5">Claude Haiku 4.5 (Rápido)</option>
                            <option value="claude-sonnet-4-6">Claude Sonnet 4.6 (Recomendado)</option>
                            <option value="claude-opus-4-7">Claude Opus 4.7 (Poderoso)</option>
                        </select>
                    </div>
                </div>

                <div id="ap-section-gemini" class="ap-provider-section ap-hidden">
                    <div class="ap-input-group">
                        <label>🔑 Google Gemini API Keys (Grátis)</label>
                        <textarea id="ap-gemini-keys" class="ap-textarea" rows="2" placeholder="AIzaSy..."></textarea>
                    </div>
                </div>

                <div id="ap-section-groq" class="ap-provider-section ap-hidden">
                    <div class="ap-input-group">
                        <label>⚡ Groq API Keys (Grátis)</label>
                        <textarea id="ap-groq-keys" class="ap-textarea" rows="2" placeholder="gsk_..."></textarea>
                    </div>
                </div>

                <div class="ap-section-divider"></div>

                <!-- ═══ TABELA DE CUSTOS EXPANDIDA ═══ -->
                <div class="ap-input-group">
                    <label>💰 Comparativo de Custos (USD)</label>
                    <div style="background: rgba(0,0,0,0.3); border-radius: 10px; padding: 12px; border: 1px solid rgba(255,255,255,0.06); overflow-x: auto;">
                        <table style="width: 100%; border-collapse: collapse; font-size: 11px; color: rgba(255,255,255,0.8);">
                            <thead>
                                <tr style="border-bottom: 1px solid rgba(255,255,255,0.1);">
                                    <th style="text-align: left; padding: 6px 4px; color: rgba(255,255,255,0.5); font-weight: 500;">Modelo</th>
                                    <th style="text-align: right; padding: 6px 4px; color: rgba(255,255,255,0.5); font-weight: 500;">100 Envios</th>
                                    <th style="text-align: right; padding: 6px 4px; color: rgba(255,255,255,0.5); font-weight: 500;">300 Envios</th>
                                </tr>
                            </thead>
                            <tbody>
                                <tr><td style="padding: 5px 4px;">🟢 Gemini / Groq</td><td style="text-align: right; padding: 5px 4px; color: #30D158;">$0,00</td><td style="text-align: right; padding: 5px 4px; color: #30D158; font-weight: 600;">$0,00</td></tr>
                                
                                <tr style="border-top: 1px solid rgba(255,255,255,0.06);"><td style="padding: 5px 4px;">🔵 GPT-4o Mini</td><td style="text-align: right; padding: 5px 4px;">$0,10</td><td style="text-align: right; padding: 5px 4px; font-weight: 600; color: #5CB8FF;">$0,31</td></tr>
                                <tr><td style="padding: 5px 4px;">🔵 GPT-4o</td><td style="text-align: right; padding: 5px 4px;">$1,70</td><td style="text-align: right; padding: 5px 4px; font-weight: 600; color: #5CB8FF;">$5,10</td></tr>
                                <tr><td style="padding: 5px 4px;">🔵 GPT-5.5</td><td style="text-align: right; padding: 5px 4px;">$4,10</td><td style="text-align: right; padding: 5px 4px; font-weight: 600; color: #5CB8FF;">$12,30</td></tr>
                                <tr><td style="padding: 5px 4px;">🔵 GPT-5.5 Pro</td><td style="text-align: right; padding: 5px 4px;">$24,60</td><td style="text-align: right; padding: 5px 4px; font-weight: 600; color: #5CB8FF;">$73,80</td></tr>
                                
                                <tr style="border-top: 1px solid rgba(255,255,255,0.06);"><td style="padding: 5px 4px;">🟣 Haiku 4.5</td><td style="text-align: right; padding: 5px 4px;">$0,75</td><td style="text-align: right; padding: 5px 4px; font-weight: 600; color: #BF5AF2;">$2,25</td></tr>
                                <tr><td style="padding: 5px 4px;">🟣 Sonnet 4.6</td><td style="text-align: right; padding: 5px 4px;">$2,25</td><td style="text-align: right; padding: 5px 4px; font-weight: 600; color: #BF5AF2;">$6,75</td></tr>
                                <tr><td style="padding: 5px 4px;">🟣 Opus 4.7</td><td style="text-align: right; padding: 5px 4px;">$3,75</td><td style="text-align: right; padding: 5px 4px; font-weight: 600; color: #BF5AF2;">$11,25</td></tr>
                            </tbody>
                        </table>
                        <div style="margin-top: 8px; font-size: 9px; color: var(--ap-text-tertiary); line-height: 1.4;">
                            * Estimativa base: 4.000 tokens input + 700 tokens output por proposta.<br>
                            * Modelos Gemini/Groq dependem de limites de cota gratuita (RPM).
                        </div>
                    </div>
                </div>

                <div class="ap-section-divider"></div>

                <!-- ═══ PLATAFORMA & PROMPTS ═══ -->
                <div class="ap-input-group">
                    <label>🌐 Plataforma Ativa</label>
                    <select id="ap-platform-select" class="ap-select">
                        <option value="99freelas">99freelas</option>
                        <option value="freelancer">Freelancer.com</option>
                    </select>
                </div>

                <div class="ap-input-group">
                    <label>👤 Seu Perfil Profissional</label>
                    <textarea id="ap-user-profile" class="ap-textarea" rows="4" placeholder="Ex: Sou desenvolvedor React Sênior..."></textarea>
                </div>

                <div class="ap-input-group">
                    <label>✍️ Prompt de Proposta</label>
                    <textarea id="ap-proposal-prompt" class="ap-textarea" rows="4" placeholder="Ex: Proposta curta e direta..."></textarea>
                </div>

                <div class="ap-section-divider"></div>

                <div class="ap-input-group">
                    <label>⌨️ Atalhos de Teclado</label>
                    
                    <div class="ap-shortcut-row">
                        <span>Analisar Lista de Projetos</span>
                        <button id="ap-shortcut-analyze" class="ap-shortcut-btn">Shift + P</button>
                    </div>

                    <div class="ap-shortcut-row">
                        <span>Gerar Proposta (Bid)</span>
                        <button id="ap-shortcut-generate" class="ap-shortcut-btn">Shift + G</button>
                    </div>
                </div>

                <div class="ap-section-divider"></div>

                <!-- ═══ CONFIGURAÇÃO DO BACKEND ═══ -->
                <div class="ap-input-group">
                    <label>🔌 Conexão com sua API (Opcional)</label>
                    <input type="text" id="ap-api-url" class="ap-input" placeholder="https://seu-dominio.com">
                    <label class="ap-toggle" style="margin-top: 10px;">
                        <input type="checkbox" id="ap-use-backend">
                        <div class="ap-toggle-track"><div class="ap-toggle-thumb"></div></div>
                        <span class="ap-toggle-label">Usar Backend para Inteligência e BI</span>
                    </label>
                    <small style="color: var(--ap-text-tertiary); font-size: 10px; display: block; margin-top: 4px;">Ativando, a extensão enviará as propostas para sua API salvar no Postgres.</small>
                </div>

                <div class="ap-section-divider"></div>

                <label class="ap-toggle">
                    <input type="checkbox" id="ap-auto-mode">
                    <div class="ap-toggle-track"><div class="ap-toggle-thumb"></div></div>
                    <span class="ap-toggle-label">Modo Automático (Página de Proposta)</span>
                </label>
            </div>

            <div class="ap-modal-footer">
                <button id="ap-save-settings" class="ap-btn-primary">Salvar Alterações</button>
            </div>
        </div>
    `;

    document.body.appendChild(overlay);

    document.getElementById('ap-close-modal').addEventListener('click', closeSettings);
    document.getElementById('ap-save-settings').addEventListener('click', saveSettings);

    // Platform select change handler
    const platformSelect = document.getElementById('ap-platform-select');
    platformSelect.addEventListener('change', (e) => {
        const platform = e.target.value;
        // Salva os valores atuais antes de trocar
        const currentPlatform = STATE.settings.activePlatform;
        const currentProfile = document.getElementById('ap-user-profile').value.trim();
        const currentPrompt = document.getElementById('ap-proposal-prompt').value.trim();

        STATE.settings[`userProfile_${currentPlatform}`] = currentProfile;
        STATE.settings[`proposalPrompt_${currentPlatform}`] = currentPrompt;

        // Carrega os valores da nova plataforma
        STATE.settings.activePlatform = platform;
        document.getElementById('ap-user-profile').value = STATE.settings[`userProfile_${platform}`] || '';
        document.getElementById('ap-proposal-prompt').value = STATE.settings[`proposalPrompt_${platform}`] || '';
    });

    // Shortcut Logic
    const btnAnalyze = document.getElementById('ap-shortcut-analyze');
    btnAnalyze.addEventListener('click', () => recordShortcut('analyze', btnAnalyze));

    const btnGenerate = document.getElementById('ap-shortcut-generate');
    btnGenerate.addEventListener('click', () => recordShortcut('generate', btnGenerate));

    // Configurações de API Cluster

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
    const geminiKeys = STATE.settings.geminiKeys || [];
    const groqKeys = STATE.settings.groqKeys || [];
    const openaiKeys = STATE.settings.openaiKeys || [];
    const claudeKeys = STATE.settings.claudeKeys || [];

    document.getElementById('ap-gemini-keys').value = (STATE.settings.geminiKeys || []).join('\n');
    document.getElementById('ap-groq-keys').value = (STATE.settings.groqKeys || []).join('\n');

    // Modelos e provider preferido
    document.getElementById('ap-openai-model').value = STATE.settings.openaiModel || 'gpt-4o-mini';
    document.getElementById('ap-claude-model').value = STATE.settings.claudeModel || 'claude-haiku-4-5';
    document.getElementById('ap-preferred-provider').value = STATE.settings.preferredProvider || 'openai';

    // Função para alternar visibilidade das seções
    const updateVisibleSections = (provider) => {
        document.querySelectorAll('.ap-provider-section').forEach(s => s.classList.add('ap-hidden'));
        const activeSection = document.getElementById(`ap-section-${provider}`);
        if (activeSection) activeSection.classList.remove('ap-hidden');
    };

    updateVisibleSections(STATE.settings.preferredProvider || 'openai');

    document.getElementById('ap-preferred-provider').addEventListener('change', (e) => {
        updateVisibleSections(e.target.value);
    });

    const platform = STATE.settings.activePlatform || '99freelas';
    document.getElementById('ap-platform-select').value = platform;
    document.getElementById('ap-user-profile').value = STATE.settings[`userProfile_${platform}`] || STATE.settings.userProfile || '';
    document.getElementById('ap-proposal-prompt').value = STATE.settings[`proposalPrompt_${platform}`] || STATE.settings.proposalPrompt || '';

    document.getElementById('ap-auto-mode').checked = STATE.settings.autoProposalMode;
    document.getElementById('ap-api-url').value = STATE.settings.apiUrl || 'http://localhost:3000';
    document.getElementById('ap-use-backend').checked = STATE.settings.useBackend || false;

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
    const geminiKeysRaw = document.getElementById('ap-gemini-keys').value;
    const groqKeysRaw = document.getElementById('ap-groq-keys').value;
    
    // Converte texto em array, removendo espaços e linhas vazias
    const geminiKeys = geminiKeysRaw.split('\n').map(k => k.trim()).filter(k => k.length > 0);
    const groqKeys = groqKeysRaw.split('\n').map(k => k.trim()).filter(k => k.length > 0);

    const openaiModel = document.getElementById('ap-openai-model').value;
    const claudeModel = document.getElementById('ap-claude-model').value;
    const preferredProvider = document.getElementById('ap-preferred-provider').value;

    const activePlatform = document.getElementById('ap-platform-select').value;
    const userProfile = document.getElementById('ap-user-profile').value.trim();
    const proposalPrompt = document.getElementById('ap-proposal-prompt').value.trim();
    const autoProposalMode = document.getElementById('ap-auto-mode').checked;
    const apiUrl = document.getElementById('ap-api-url').value.trim();
    const useBackend = document.getElementById('ap-use-backend').checked;

    const shortcuts = STATE.settings.shortcuts;

    // Salva os prompts na plataforma ativa
    STATE.settings[`userProfile_${activePlatform}`] = userProfile;
    STATE.settings[`proposalPrompt_${activePlatform}`] = proposalPrompt;

    // Atualiza o estado global
    STATE.settings = {
        ...STATE.settings,
        geminiKeys,
        groqKeys,
        openaiModel,
        claudeModel,
        preferredProvider,
        activePlatform,
        userProfile,
        proposalPrompt,
        autoProposalMode,
        apiUrl,
        useBackend,
        shortcuts
    };

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
    // Verificar se tem alguma API Key configurada (Cluster ou Solo)
    const hasGemini = (STATE.settings.geminiKeys && STATE.settings.geminiKeys.length > 0) || (STATE.settings.apiKey && STATE.settings.apiKey.trim().length > 0);
    const hasGroq = (STATE.settings.groqKeys && STATE.settings.groqKeys.length > 0) || (STATE.settings.groqApiKey && STATE.settings.groqApiKey.trim().length > 0);
    const hasOpenAI = STATE.settings.openaiKeys && STATE.settings.openaiKeys.length > 0;
    const hasClaude = STATE.settings.claudeKeys && STATE.settings.claudeKeys.length > 0;

    if (!hasGemini && !hasGroq && !hasOpenAI && !hasClaude) {
        showToast("⚠️ Configure ao menos uma API Key.");
        openSettings();
        return;
    }
    showToast("Analisando projetos...", "loading");

    // Aguarda o scraping (necessário para Freelancer.com que é async)
    const projects = await scrapeProjectsFromPage();
    if (projects.length === 0) { showToast("❌ Nenhum projeto na tela."); return; }

    STATE.scrapedProjects = projects;
    const projectsPayload = projects.map(p => ({ id: p.id, title: p.title, description: p.description }));
    const finalInstruction = `${SYSTEM_INSTRUCTION_TEMPLATE}\n${STATE.settings.userProfile}`;

    chrome.runtime.sendMessage({
        action: "aiRequest",
        taskType: "FILTER_PROJECTS",
        userId: STATE.user?.id,
        userName: STATE.user?.name,
        preferredProvider: STATE.settings.preferredProvider,
        apiUrl: STATE.settings.apiUrl,
        useBackend: STATE.settings.useBackend,
        geminiKeys: STATE.settings.geminiKeys || (STATE.settings.apiKey ? [STATE.settings.apiKey] : []),
        groqKeys: STATE.settings.groqKeys || (STATE.settings.groqApiKey ? [STATE.settings.groqApiKey] : []),
        openaiKeys: STATE.settings.openaiKeys,
        claudeKeys: STATE.settings.claudeKeys,
        openaiModel: STATE.settings.openaiModel,
        claudeModel: STATE.settings.claudeModel,
        groqModel: STATE.settings.groqModel,
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

    // 3. Valor e Prazo Médios (Busca Robusta)
    let avgValue = 'Não informado';
    let avgTime = 'Não informado';

    // Estratégia 1: Selector clássico
    const infoEl = document.querySelector('.generic.information');
    if (infoEl) {
        const bTags = infoEl.querySelectorAll('b');
        if (bTags.length >= 1) avgValue = bTags[0].innerText.trim();
        if (bTags.length >= 2) avgTime = bTags[1].innerText.trim();
    }

    // Estratégia 2: Fallback para novos layouts/classes
    if (avgValue === 'Não informado') {
        const labels = document.querySelectorAll('.label-projeto, .info-label, strong');
        labels.forEach(lbl => {
            const txt = lbl.innerText.toLowerCase();
            if (txt.includes('valor') || txt.includes('orçamento')) {
                const val = lbl.nextElementSibling || lbl.parentElement.querySelector('b, span:not(.info-label)');
                if (val) avgValue = val.innerText.trim();
            }
            if (txt.includes('prazo')) {
                const val = lbl.nextElementSibling || lbl.parentElement.querySelector('b, span:not(.info-label)');
                if (val) avgTime = val.innerText.trim();
            }
        });
    }

    // Estratégia 3: Buscar em box-detalhes
    if (avgValue === 'Não informado') {
        const boxes = document.querySelectorAll('.box-projeto, .generic-box');
        boxes.forEach(box => {
            if (box.innerText.includes('Valor')) {
                const matches = box.innerText.match(/R\$\s?[\d.,]+\s?-\s?[\d.,]+/i);
                if (matches) avgValue = matches[0];
            }
        });
    }

    return { clientName, description, avgValue, avgTime };
}

// Scraper de contexto para Freelancer.com
function scrapeProposalContextFreelancer() {
    // 1. Título do Projeto (do card Project Details)
    let projectTitle = 'Projeto';
    const titleSelectors = [
        '.ProjectDetailsCard-title.mobile\\:hide',  // Título desktop
        '.ProjectDetailsCard-title',                 // Qualquer título
        'h1.PageProjectViewLogout-header-title',
        '.project-header h1'
    ];
    for (const selector of titleSelectors) {
        const titleEl = document.querySelector(selector);
        if (titleEl && titleEl.textContent.trim() !== 'Project Details') {
            projectTitle = titleEl.textContent.trim();
            break;
        }
    }

    // 2. Descrição do Projeto (do card Project Details)
    let description = '';
    const descSelectors = [
        'fl-interactive-text .ContentWrapper span',  // Estrutura exata do Freelancer
        '.ProjectDescription fl-interactive-text span',
        '.ProjectDescription span',
        'app-project-details-description span',
        '.project-details p'
    ];

    for (const selector of descSelectors) {
        const descEl = document.querySelector(selector);
        if (descEl) {
            description = descEl.textContent.trim();
            if (description && description.length > 50) break;
        }
    }

    // Fallback: buscar todo o conteúdo de ProjectDescription
    if (!description || description.length < 50) {
        const descContainer = document.querySelector('.ProjectDescription, app-project-details-description');
        if (descContainer) {
            description = descContainer.textContent.trim();
        }
    }

    // 3. Budget do projeto (do card Project Details)
    let avgValue = 'Não informado';
    const budgetSelectors = [
        '.ProjectViewDetails-budget p',              // Estrutura exata
        'app-project-details-budget p',
        '.BudgetPrice',
        '.project-budget'
    ];
    for (const selector of budgetSelectors) {
        const budgetEl = document.querySelector(selector);
        if (budgetEl) {
            avgValue = budgetEl.textContent.trim();
            if (avgValue) break;
        }
    }

    // 4. Prazo (bidding ends)
    let avgTime = 'A definir';
    const timeEl = document.querySelector('.ProjectViewDetails-budget fl-relative-time span');
    if (timeEl) {
        avgTime = 'Bidding ends in ' + timeEl.textContent.trim();
    }

    // 5. Skills do projeto (do card Project Details)
    let skills = '';
    const skillSelectors = [
        '.ProjectViewDetailsSkills fl-tag .Content',  // Estrutura exata
        '.ProjectViewDetailsSkills fl-tag',
        'app-project-details-skills fl-tag .Content',
        'app-project-details-skills fl-tag'
    ];

    for (const selector of skillSelectors) {
        const skillEls = document.querySelectorAll(selector);
        if (skillEls.length > 0) {
            skills = Array.from(skillEls).map(el => el.textContent.trim()).join(', ');
            break;
        }
    }

    // 6. Moeda do projeto (extraída do formulário de bid ou do budget)
    let currency = 'USD'; // Default
    const currencyEl = document.querySelector('#bidAmountInput')?.closest('.InputContainer')?.querySelector('.AfterLabel .LabelText');
    if (currencyEl) {
        currency = currencyEl.textContent.trim();
    } else {
        // Fallback: tentar extrair do budget (£250.00 – 750.00 GBP)
        const currencyMatch = avgValue.match(/([A-Z]{3})/);
        if (currencyMatch) {
            currency = currencyMatch[0];
        } else {
            // Tentar símbolo
            const symbolMatch = avgValue.match(/[$€£]/);
            if (symbolMatch) {
                const symbolMap = { '$': 'USD', '€': 'EUR', '£': 'GBP' };
                currency = symbolMap[symbolMatch[0]] || 'USD';
            }
        }
    }

    // 7. Project ID (opcional, para referência)
    let projectId = '';
    const idEl = document.querySelector('.ProjectDetailsFooter p');
    if (idEl && idEl.textContent.includes('Project ID:')) {
        projectId = idEl.textContent.replace('Project ID:', '').trim();
    }

    console.log('[Auto-Proposal] Contexto Freelancer:', {
        projectTitle,
        description: description.substring(0, 200) + '...',
        avgValue,
        skills,
        currency,
        projectId
    });

    return {
        clientName: projectTitle,
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

    // 2. Preencher Inputs de Valor (Prioridade para Oferta Final)
    const inputOfertaFinal = document.getElementById('oferta-final');
    const inputOferta = document.getElementById('oferta');

    if (inputOfertaFinal) {
        // Preenche o valor que o freelancer deseja receber (Exato conforme IA)
        inputOfertaFinal.value = formatCurrencyBR(data.price);
        inputOfertaFinal.dispatchEvent(new Event('input', { bubbles: true }));
        inputOfertaFinal.dispatchEvent(new Event('change', { bubbles: true }));
        
        // Dispara blur para garantir que o 99freelas processe o valor
        setTimeout(() => inputOfertaFinal.dispatchEvent(new Event('blur', { bubbles: true })), 100);
        
        console.log('[Auto-Proposal] Preenchendo Oferta Final:', data.price);
    } else if (inputOferta) {
        // Fallback caso o seletor mude ou não exista oferta-final
        inputOferta.value = formatCurrencyBR(data.price);
        inputOferta.dispatchEvent(new Event('input', { bubbles: true }));
        inputOferta.dispatchEvent(new Event('change', { bubbles: true }));
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

    // Verificar se tem alguma API Key configurada ou se usa Backend
    const hasGemini = (STATE.settings.geminiKeys && STATE.settings.geminiKeys.length > 0) || (STATE.settings.apiKey && STATE.settings.apiKey.trim().length > 0);
    const hasGroq = (STATE.settings.groqKeys && STATE.settings.groqKeys.length > 0) || (STATE.settings.groqApiKey && STATE.settings.groqApiKey.trim().length > 0);
    const hasOpenAI = STATE.settings.openaiKeys && STATE.settings.openaiKeys.length > 0;
    const hasClaude = STATE.settings.claudeKeys && STATE.settings.claudeKeys.length > 0;
    const isBackendEnabled = STATE.settings.useBackend && STATE.settings.apiUrl;

    if (!hasGemini && !hasGroq && !hasOpenAI && !hasClaude && !isBackendEnabled) {
        showToast("⚠️ Configure ao menos uma API Key ou ative o Backend.");
        openSettings();
        return;
    }

    showToast("Gerando proposta...", "loading");

    // Coleta dados
    const context = scrapeProposalContext();
    
    // Envia a descrição COMPLETA do projeto conforme solicitado (sem cortes de tokens)
    const truncatedDescription = context.description;

    // Monta Prompt (inclui moeda se disponível)
    const currencyInfo = context.currency ? `\n    Moeda: ${context.currency}` : '';
    const userPrompt = `
    DADOS DO PROJETO:
    Cliente/Projeto: ${context.clientName}
    Descrição: ${truncatedDescription}
    Orçamento/Budget: ${context.avgValue}${currencyInfo}
    Prazo Médio: ${context.avgTime}

    MEU PROMPT DE PROPOSTA:
    ${STATE.settings.proposalPrompt}

    IMPORTANTE: 
    - O campo "message" deve ser uma proposta COMPLETA, PROFISSIONAL e EXTENSA (2000-2500 caracteres).
    - Use quebras de linha double-n (\\\\n\\\\n) para separar parágrafos e listas.
    - O campo "price" deve ser o valor TOTAL (Bruto) sugerido para o cliente pagar.
    - O preço deve ser sugerido na moeda ${context.currency || 'do projeto'}. 
    - Retorne apenas o valor numérico inteiro no campo "price".
    
    Gere o JSON estrito com a mensagem longa e formatada, preço total sugerido e prazo em dias.
    `;

    const systemInstruction = `${PROPOSAL_SYSTEM_INSTRUCTION}\nMEU PERFIL: ${STATE.settings.userProfile}`;

    // Chama API (Suporta fallback global Gemini -> OpenAI -> Claude -> Groq)
    chrome.runtime.sendMessage({
        action: "aiRequest",
        taskType: "GENERATE_PROPOSAL",
        userId: STATE.user?.id,
        userName: STATE.user?.name,
        preferredProvider: STATE.settings.preferredProvider,
        apiUrl: STATE.settings.apiUrl,
        useBackend: STATE.settings.useBackend,
        platform: STATE.settings.activePlatform,
        proposalData: {
            title: context.clientName,
            description: truncatedDescription,
            value: context.avgValue,
            currency: context.currency
        },
        geminiKeys: STATE.settings.geminiKeys || (STATE.settings.apiKey ? [STATE.settings.apiKey] : []),
        groqKeys: STATE.settings.groqKeys || (STATE.settings.groqApiKey ? [STATE.settings.groqApiKey] : []),
        openaiKeys: STATE.settings.openaiKeys,
        claudeKeys: STATE.settings.claudeKeys,
        openaiModel: STATE.settings.openaiModel,
        claudeModel: STATE.settings.claudeModel,
        groqModel: STATE.settings.groqModel,
        systemInstruction: systemInstruction,
        userPrompt: userPrompt
    }, (response) => {
        if (!response || !response.success) {
            console.error("[Auto-Proposal] Error:", response?.error);
            showToast("❌ Erro ao gerar proposta.");
            return;
        }

        if (response.source) {
            console.log(`%c[Auto-Proposal] Proposta gerada com sucesso via ${response.source}`, "color: #4CAF50; font-weight: bold;");
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

    chrome.storage.local.get([
        'apiKey',
        'groqApiKey',
        'groqModel',
        'openaiKeys',
        'claudeKeys',
        'openaiModel',
        'claudeModel',
        'preferredProvider',
        'activePlatform',
        'userProfile',
        'proposalPrompt',
        'userProfile_99freelas',
        'proposalPrompt_99freelas',
        'userProfile_freelancer',
        'proposalPrompt_freelancer',
        'shortcuts',
        'autoProposalMode',
        'apiUrl',
        'useBackend',
        'geminiKeys',
        'groqKeys'
    ], (result) => {
        // API Keys & Clusters
        if (result.apiKey) STATE.settings.apiKey = result.apiKey;
        if (result.groqApiKey) STATE.settings.groqApiKey = result.groqApiKey;
        if (result.groqModel) STATE.settings.groqModel = result.groqModel;
        
        if (result.geminiKeys) STATE.settings.geminiKeys = result.geminiKeys;
        if (result.groqKeys) STATE.settings.groqKeys = result.groqKeys;
        if (result.openaiKeys) STATE.settings.openaiKeys = result.openaiKeys;
        if (result.claudeKeys) STATE.settings.claudeKeys = result.claudeKeys;

        // Modelos e Preferências
        if (result.openaiModel) STATE.settings.openaiModel = result.openaiModel;
        if (result.claudeModel) STATE.settings.claudeModel = result.claudeModel;
        if (result.preferredProvider) STATE.settings.preferredProvider = result.preferredProvider;
        if (result.apiUrl) STATE.settings.apiUrl = result.apiUrl;
        if (result.useBackend !== undefined) STATE.settings.useBackend = result.useBackend;

        // Plataforma ativa
        if (result.activePlatform) STATE.settings.activePlatform = result.activePlatform;

        // Prompts (legado + por plataforma)
        if (result.userProfile) STATE.settings.userProfile = result.userProfile;
        if (result.proposalPrompt) STATE.settings.proposalPrompt = result.proposalPrompt;
        if (result.userProfile_99freelas) STATE.settings.userProfile_99freelas = result.userProfile_99freelas;
        if (result.proposalPrompt_99freelas) STATE.settings.proposalPrompt_99freelas = result.proposalPrompt_99freelas;
        if (result.userProfile_freelancer) STATE.settings.userProfile_freelancer = result.userProfile_freelancer;
        if (result.proposalPrompt_freelancer) STATE.settings.proposalPrompt_freelancer = result.proposalPrompt_freelancer;

        // Modo automático
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

        console.log('[Auto-Proposal] Settings carregadas:', STATE.settings);
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

        // Detecta página de bid para ambos os sites
        const isBidPage99freelas = currentUrl.includes("/project/bid/");
        const isBidPageFreelancer = CURRENT_SITE === 'freelancer' && currentUrl.includes("/projects/");
        const isBidPage = isBidPage99freelas || isBidPageFreelancer;

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
            let formIsReady = false;

            if (CURRENT_SITE === 'freelancer') {
                // Para Freelancer.com, espera o componente app-bid-form carregar completamente
                // O elemento 'descriptionTextArea' dentro de app-bid-form indica que o form está pronto
                const bidForm = document.querySelector('app-bid-form');
                const descriptionTextArea = document.getElementById('descriptionTextArea');
                formIsReady = bidForm && descriptionTextArea;

                if (bidForm && !descriptionTextArea) {
                    console.log("[Auto-Proposal] Freelancer: app-bid-form encontrado, aguardando descriptionTextArea...");
                }
            } else {
                // Para 99freelas, verifica o campo proposta
                const proposalForm = document.getElementById('proposta');
                formIsReady = !!proposalForm;
            }

            if (formIsReady) {
                STATE.lastAutoRunUrl = currentUrl;
                console.log("[Auto-Proposal] Página de Proposta detectada e carregada. Iniciando modo automático...");
                console.log("[Auto-Proposal] NOTA: A proposta será preenchida mas NÃO será enviada automaticamente.");
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