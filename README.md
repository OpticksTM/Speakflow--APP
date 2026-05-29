# SpeakFlow - English Dialog Practice

Um aplicativo simples e eficaz para praticar conversacao em ingles, onde o sistema gera dialogos e voce pratica falando em voz alta.

## Funcionalidades

- **Dialogos gerados por IA** - Usa Groq (Llama 3.3) ou Google Gemini para criar conversas naturais e contextualizadas
- **Interface minimalista** - Foco total no aprendizado, sem distracoes
- **Controle por ESPACO** - Pressione a barra de espaco para avancar no dialogo
- **Text-to-Speech** - Ouca a pronuncia correta das frases em ingles
- **Traducao inline** - Veja a traducao em portugues diretamente em cada frase
- **Multiplos topicos** - Escolha entre viagem, trabalho, restaurante, etc.
- **Niveis de dificuldade** - Iniciante, intermediario ou avancado
- **APIs gratuitas** - Suporte a Groq e Google Gemini (ambas gratuitas)

## Como Usar

### 1. Obter API Key (Gratuita)

**Opcao A - Groq (Recomendado):**
1. Acesse [console.groq.com/keys](https://console.groq.com/keys)
2. Crie uma conta (pode usar Google/GitHub)
3. Clique em "Create API Key"
4. Copie a chave (comeca com `gsk_`)

**Opcao B - Google Gemini:**
1. Acesse [aistudio.google.com/app/apikey](https://aistudio.google.com/app/apikey)
2. Faca login com sua conta Google
3. Clique em "Create API Key"
4. Copie a chave (comeca com `AIza`)

### 2. Executar o App

**Opcao A - Abrir diretamente:**
- De duplo clique no arquivo `index.html`

**Opcao B - Com servidor local (recomendado):**
```bash
# Com Python
python -m http.server 8080

# Com Node.js
npx serve .

# Com VS Code
# Use a extensao "Live Server"
```

### 3. Configurar e Praticar

1. Selecione o provedor de IA (Groq ou Gemini)
2. Cole sua API Key
3. Escolha o topico de conversacao
4. Selecione seu nivel
5. Clique em "Comecar Pratica"
6. Leia cada frase em voz alta antes de pressionar ESPACO

## Dicas de Estudo

1. **Fale em voz alta** - Nao apenas leia mentalmente
2. **Repita varias vezes** - Use o botao de audio para ouvir e repetir
3. **Pratique diariamente** - 15 minutos por dia e melhor que 2 horas uma vez por semana
4. **Grave-se** - Compare sua pronuncia com o audio

## Tecnologias

- HTML5, CSS3, JavaScript (Vanilla)
- Groq API (Llama 3.3 70B) - Gratuita
- Google Gemini API - Gratuita
- Web Speech API (Text-to-Speech nativo do navegador)

## Estrutura

```
SpeakFlow/
  index.html      # Pagina principal
  style.css       # Estilos visuais
  app.js          # Logica do aplicativo
  README.md       # Este arquivo
```

## Seguranca

- Sua API Key e armazenada apenas localmente no navegador (localStorage)
- Nenhum dado e enviado para servidores externos alem do provedor de IA escolhido
- Voce pode limpar seus dados a qualquer momento limpando o localStorage

## Custos

O app usa APIs gratuitas:
- **Groq**: Gratuito (14.400 requisicoes/dia)
- **Google Gemini**: Gratuito (60 requisicoes/minuto)

---

Bons estudos!
