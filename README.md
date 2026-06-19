<div align="center">
  <img src="docs/preview.png" alt="SyntaxAI Interface" width="800"/>
  
  <h1>SyntaxAI</h1>
  <p>An interactive, AI-powered coding tutor and IDE built with a modern, sleek aesthetic.</p>

  <div>
    <img src="https://img.shields.io/badge/Node.js-339933?style=for-the-badge&logo=nodedotjs&logoColor=white" alt="Node.js" />
    <img src="https://img.shields.io/badge/Express.js-000000?style=for-the-badge&logo=express&logoColor=white" alt="Express.js" />
    <img src="https://img.shields.io/badge/Monaco_Editor-2C2C32?style=for-the-badge&logo=visualstudiocode&logoColor=white" alt="Monaco Editor" />
    <img src="https://img.shields.io/badge/Gemini_AI-4285F4?style=for-the-badge&logo=google&logoColor=white" alt="Gemini" />
  </div>
</div>

---

## 🌟 Features

- **Modern & Premium UI**: A sleek dark mode inspired by top-tier developer tools like Vercel and Linear.
- **Intelligent AI Tutor**: Powered by Google's Gemini (and supports OpenAI / Anthropic). The AI adapts its hints based on your selected difficulty level (Beginner, Intermediate, Advanced).
- **Per-Language Progress Tracking**: Switch between languages without losing your code. SyntaxAI remembers your task, code, and feedback for each language separately.
- **VS Code-like Editing Experience**: Integrated Monaco Editor featuring:
  - Dynamic Emmet support (`.classname`, `#idname`, `!`)
  - Auto-closing tags and brackets
  - Boilerplate snippets for Java, C++, C#, Python, Rust, and Go.
- **API Key Rotation**: Supports multiple API keys. If a key hits rate limits (Quota Exceeded / 429), the server automatically and transparently fails over to the next available key.
- **Smart Quota Conservation**: Prevents unnecessary API calls if the code hasn't changed.

## 🚀 Getting Started

### 1. Prerequisites
- [Node.js](https://nodejs.org/) (v16 or higher)
- NPM or Yarn

### 2. Installation

Clone the repository and install the dependencies:

```bash
git clone https://github.com/yourusername/SyntaxAI.git
cd SyntaxAI
npm install
```

### 3. Environment Setup

Rename `.env.example` to `.env` (or create a new `.env` file) and add your API keys. You can add multiple keys for automatic rotation:

```env
GEMINI_API_KEY_1=your_first_gemini_key
GEMINI_API_KEY_2=your_second_gemini_key
# Optional:
# OPENAI_API_KEY=
# ANTHROPIC_API_KEY=
```

### 4. Run the App

Start the development server:

```bash
npm run dev
```

Open your browser and navigate to `http://localhost:3000`.

## 🧠 Supported Languages
JavaScript, Node.js, React, TypeScript, Python, HTML, CSS, Java, C++, C#, Go, and Rust.

## 🤝 Contributing
Contributions, issues, and feature requests are welcome! Feel free to check the [issues page](https://github.com/yourusername/SyntaxAI/issues).

## 📄 License
This project is [MIT](LICENSE) licensed.
