# SpeakFlow - English Dialog Practice

[![HTML5](https://img.shields.io/badge/HTML5-E34F26?style=for-the-badge&logo=html5&logoColor=white)](https://developer.mozilla.org/en-US/docs/Web/HTML)
[![CSS3](https://img.shields.io/badge/CSS3-1572B6?style=for-the-badge&logo=css3&logoColor=white)](https://developer.mozilla.org/en-US/docs/Web/CSS)
[![JavaScript](https://img.shields.io/badge/JavaScript-F7DF1E?style=for-the-badge&logo=javascript&logoColor=black)](https://developer.mozilla.org/en-US/docs/Web/JavaScript)
[![Groq](https://img.shields.io/badge/Groq-F55036?style=for-the-badge&logo=groq&logoColor=white)](https://groq.com/)
[![Google Gemini](https://img.shields.io/badge/Google%20Gemini-8E75B2?style=for-the-badge&logo=googlegemini&logoColor=white)](https://ai.google.dev/)

Um aplicativo simples e eficaz para praticar conversação em inglês, onde o sistema gera diálogos e você pratica falando em voz alta.

---

## Funcionalidades

* **Diálogos gerados por IA:** Usa Groq (Llama 3.3) ou Google Gemini para criar conversas naturais e contextualizadas.
* **Interface minimalista:** Foco total no aprendizado, sem distrações.
* **Controle por ESPAÇO:** Pressione a barra de espaço para avançar no diálogo.
* **Text-to-Speech:** Ouça a pronúncia correta das frases em inglês.
* **Tradução inline:** Veja a tradução em português diretamente em cada frase.
* **Múltiplos tópicos:** Escolha entre viagem, trabalho, restaurante, etc.
* **Níveis de dificuldade:** Iniciante, intermediário ou avançado.
* **APIs gratuitas:** Suporte a Groq e Google Gemini (ambas gratuitas).

---

## Como Usar

### 1. Obter API Key (Gratuita)

* **Opção A - Groq (Recomendado):**
  * Acesse `console.groq.com/keys`
  * Crie uma conta (pode usar Google/GitHub)
  * Clique em "Create API Key"
  * Copie a chave (começa com `gsk_`)

* **Opção B - Google Gemini:**
  * Acesse `aistudio.google.com/app/apikey`
  * Faça login com sua conta Google
  * Clique em "Create API Key"
  * Copie a chave (começa com `AIza`)

### 2. Executar o App

* **Opção A - Abrir diretamente:** Dê duplo clique no arquivo `index.html`.
* **Opção B - Com servidor local (recomendado):**
  ```bash
  # Com Python
  python -m http.server 8080

  # Com Node.js
  npx serve .
