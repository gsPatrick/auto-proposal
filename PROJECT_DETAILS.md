# Auto-Proposal AI - Project Documentation

## Overview
**Auto-Proposal AI (Sidebar Edition)** is a Chrome extension designed to streamline the workflow of freelancers on platforms like **99freelas** and **Freelancer.com**. It uses Advanced AI (Google Gemini and Groq) to analyze project listings, filter them based on user-defined criteria, and generate high-quality, persuasive proposals.

The extension features a premium, macOS-inspired UI that integrates seamlessly into the browser as a non-intrusive sidebar.

---

## Technical Architecture

The extension follows the standard Chrome Extension Manifest V3 architecture:

### 1. `manifest.json`
- **Permissions**: `activeTab` for site interaction and `storage` for persistent settings.
- **Host Permissions**: Access to `generativelanguage.googleapis.com` for direct Gemini AI communication.
- **Content Scripts**: `content.js` is injected into `99freelas.com.br` and `freelancer.com`.
- **Background Script**: `background.js` acts as a service worker to handle AI API requests.

### 2. `background.js` (The AI Engine)
- Handles communication with **Google Gemini** and **Groq (OpenAI-compatible)**.
- **Task Types**:
    - `FILTER_PROJECTS`: Expects a JSON response containing project IDs and summaries.
    - `GENERATE_PROPOSAL`: Expects a text-based persuasive proposal message.
- Implements safety settings and custom prompt injection for different AI models.

### 3. `content.js` (The UI & Logic Engine)
- **UI System**: Injects a custom CSS-driven sidebar with glassmorphism effects, Apple-style animations, and high-quality typography.
- **Scraping Engine**: Platform-specific logic to extract project details (Title, Description, URLs).
- **Settings System**: A dedicated modal for managing API keys, user profiles, proposal prompts, and keyboard shortcuts.
- **Automation**: Automatic proposal generation mode when navigating to specific project bid pages.

---

## Key Features

### 🌟 Intelligent Project Filtering
- Scans all projects on the current page.
- Sends the project list to the AI along with the user's expertise profile.
- Displays matching projects in the sidebar with an AI-generated summary highlighting why they are a good fit.

### 📝 Automated Proposal Generation
- Scrapes the full project description.
- Uses a personalized "Proposal Prompt" to generate tailored messages.
- Suggests optimized pricing and duration based on project complexity.

### ⌨️ Dynamic Shortcuts
- Customizable keyboard shortcuts (e.g., `Shift + P` for analysis, `Shift + G` for proposals).
- Allows for extremely fast interaction without using the mouse.

### 🍏 Premium macOS Aesthetics
- Designed to look like a native macOS application.
- Uses system-level blurs (`backdrop-filter`), Apple Blue accents (`#0A84FF`), and SF Pro fonts.

---

## How It Works (Step-by-Step)

1. **Initialization**: On page load, `content.js` injects the sidebar handle and loads settings from `chrome.storage.local`.
2. **Analysis Trigger**: When the user clicks "Analyze" or uses the shortcut:
    - `content.js` scrapes project list data.
    - It sends a message to `background.js` with the scraped data and the user's profile.
    - `background.js` calls the AI API and returns a filtered list.
3. **Filtering**: The sidebar updates to show only relevant projects with AI summaries.
4. **Proposal Trigger**: When clicking a project or being on a proposal page:
    - The AI generates a customized bid including message, price, and duration.
    - In "Auto Mode", it can automatically pre-fill the proposal fields (if integrated with the specific page DOM).

---

## Setup & Configuration

1. **API Keys**: Requires either a Google Gemini key or a Groq API key.
2. **User Profile**: Describe your skills (e.g., "Fullstack Developer specialized in React/Node.js").
3. **Proposal Prompt**: Define the tone and structure you want the AI to follow (e.g., "Short, direct, and professional").

---

> [!TIP]
> Use the **Modo Automático** feature on proposal pages to have the AI ready to generate a bid the moment the page loads!
