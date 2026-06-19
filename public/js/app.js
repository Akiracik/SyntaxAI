(() => {
  'use strict';

  // ─── State (Hafıza / Kota Dostu) ─────────────────────────
  const state = {
    provider: 'Gemini',
    model: 'gemini-2.5-flash',
    lang: 'JavaScript',
    diff: 'Başlangıç',
    history: {}
  };
  function ls() {
    if (!state.history[state.lang]) state.history[state.lang] = { currentTask: '', userCode: '', feedback: '', status: '', lastCheckedCode: '' };
    return state.history[state.lang];
  }

  let editor; // Monaco Editor instance

  const modelsMap = {
    Gemini: [
      { id: 'gemini-2.5-flash', name: 'Gemini 2.5 Flash' },
      { id: 'gemini-2.5-pro', name: 'Gemini 2.5 Pro' },
      { id: 'gemini-2.0-flash', name: 'Gemini 2.0 Flash' }
    ],
    OpenAI: [
      { id: 'gpt-5.5', name: 'GPT-5.5 (Flagship)' },
      { id: 'gpt-5.4-mini', name: 'GPT-5.4 Mini' }
    ],
    Anthropic: [
      { id: 'claude-sonnet-4-6-20260210', name: 'Claude Sonnet 4.6' }
    ]
  };

  // ─── DOM Elements ───────────────────────────────────────
  const $ = id => document.getElementById(id);
  const el = {
    overlay: $('modal-overlay'),
    settingsBtn: $('settings-btn'),
    closeBtn: $('modal-close'),
    saveBtn: $('save-settings-btn'),
    resetBtn: $('reset-btn'),
    
    provider: $('provider-select'),
    model: $('model-select'),
    lang: $('lang-select'),
    diff: $('diff-select'),
    fetchBtn: $('fetch-models-btn'),
    
    statusDiff: $('status-diff'),
    statusLang: $('status-lang'),
    fileName: $('file-name'),
    
    taskText: $('task-text'),
    feedbackBox: $('feedback-box'),
    feedbackTitle: $('feedback-title'),
    feedbackText: $('feedback-text'),
    checkBtn: $('check-code-btn'),
    
    loading: $('loading-overlay'),
    toasts: $('toasts')
  };

  // ─── Init ───────────────────────────────────────────────
  function init() {
    loadState();
    applyUI();
    fillModels();
    bindEvents();
    
    // Monaco Editor'ü Yükle
    require.config({ paths: { 'vs': 'https://cdnjs.cloudflare.com/ajax/libs/monaco-editor/0.45.0/min/vs' }});
    require(['vs/editor/editor.main'], function() {
      initMonaco();
    });
  }

  function initMonaco() {
    const langMap = {
      'JavaScript': 'javascript',
      'TypeScript': 'typescript',
      'Node.js': 'javascript',
      'React': 'javascript',
      'Python': 'python',
      'HTML': 'html',
      'CSS': 'css',
      'Java': 'java',
      'C++': 'cpp',
      'C#': 'csharp',
      'Go': 'go',
      'Rust': 'rust'
    };
    
    const editorLang = langMap[state.lang] || 'javascript';
    
    editor = monaco.editor.create($('monaco-container'), {
      value: ls().userCode || '// Kodunuzu buraya yazın...\n',
      language: editorLang,
      theme: 'vs-dark',
      automaticLayout: true,
      minimap: { enabled: false },
      fontSize: 14,
      fontFamily: "'JetBrains Mono', monospace",
      padding: { top: 16 },
      autoClosingBrackets: 'always',
      autoClosingQuotes: 'always',
      autoIndent: 'full',
      formatOnType: true,
      formatOnPaste: true,
      suggestOnTriggerCharacters: true,
      acceptSuggestionOnEnter: 'smart',
      snippetSuggestions: 'inline',
      readOnly: !ls().currentTask // Görev yoksa sadece okunabilir
    });
    
    // HTML için Emmet (!, .class, #id) ve etiketler
    monaco.languages.registerCompletionItemProvider('html', {
      triggerCharacters: ['<', '!', '.', '#'],
      provideCompletionItems: function(model, position) {
        const textUntilPosition = model.getValueInRange({startLineNumber: 1, startColumn: 1, endLineNumber: position.lineNumber, endColumn: position.column});
        
        const tags = ['div','h1','h2','h3','h4','h5','h6','p','span','a','ul','ol','li','button','input','form','nav','header','footer','section','article','main'];
        const suggestions = tags.map(tag => ({
          label: tag, kind: monaco.languages.CompletionItemKind.Snippet, insertText: `<${tag}>$1</${tag}>`, insertTextRules: monaco.languages.CompletionItemInsertTextRule.InsertAsSnippet, detail: `Auto-close <${tag}>`
        }));
        
        suggestions.push({ label: '!', kind: monaco.languages.CompletionItemKind.Snippet, insertText: '<!DOCTYPE html>\n<html lang="en">\n<head>\n\t<meta charset="UTF-8">\n\t<meta name="viewport" content="width=device-width, initial-scale=1.0">\n\t<title>Document</title>\n</head>\n<body>\n\t$1\n</body>\n</html>', insertTextRules: monaco.languages.CompletionItemInsertTextRule.InsertAsSnippet, detail: 'HTML5 Boilerplate' });
        suggestions.push({ label: 'html:5', kind: monaco.languages.CompletionItemKind.Snippet, insertText: '<!DOCTYPE html>\n<html lang="en">\n<head>\n\t<meta charset="UTF-8">\n\t<meta name="viewport" content="width=device-width, initial-scale=1.0">\n\t<title>Document</title>\n</head>\n<body>\n\t$1\n</body>\n</html>', insertTextRules: monaco.languages.CompletionItemInsertTextRule.InsertAsSnippet, detail: 'HTML5 Boilerplate' });

        // Dinamik Emmet (.sınıf veya #id)
        const lineText = model.getValueInRange({startLineNumber: position.lineNumber, startColumn: 1, endLineNumber: position.lineNumber, endColumn: position.column});
        const emmetMatch = lineText.match(/([.#])([\w-]+)$/);
        
        if (emmetMatch) {
          const prefix = emmetMatch[1];
          const name = emmetMatch[2];
          const attr = prefix === '.' ? 'class' : 'id';
          const range = {
            startLineNumber: position.lineNumber,
            endLineNumber: position.lineNumber,
            startColumn: position.column - emmetMatch[0].length,
            endColumn: position.column
          };
          
          suggestions.push({
            label: emmetMatch[0],
            kind: monaco.languages.CompletionItemKind.Snippet,
            insertText: `<div ${attr}="${name}">\n\t$1\n</div>`,
            insertTextRules: monaco.languages.CompletionItemInsertTextRule.InsertAsSnippet,
            detail: `Emmet div ${attr}`,
            range: range
          });
        }

        // incomplete: true sayesinde her harfte bu fonksiyon yeniden çalışır ve dinamik sınıf isimlerini yakalar
        return { suggestions: suggestions, incomplete: true };
      }
    });
    // Java Boilerplate
    monaco.languages.registerCompletionItemProvider('java', { provideCompletionItems: (m, p) => ({ suggestions: [{ label: 'main', kind: monaco.languages.CompletionItemKind.Snippet, insertText: 'public class Main {\n\tpublic static void main(String[] args) {\n\t\t$1\n\t}\n}', insertTextRules: monaco.languages.CompletionItemInsertTextRule.InsertAsSnippet, detail: 'Java Main Boilerplate' }] }) });
    // C++ Boilerplate
    monaco.languages.registerCompletionItemProvider('cpp', { provideCompletionItems: (m, p) => ({ suggestions: [{ label: 'main', kind: monaco.languages.CompletionItemKind.Snippet, insertText: '#include <iostream>\n\nint main() {\n\t$1\n\treturn 0;\n}', insertTextRules: monaco.languages.CompletionItemInsertTextRule.InsertAsSnippet, detail: 'C++ Main Boilerplate' }] }) });
    // C# Boilerplate
    monaco.languages.registerCompletionItemProvider('csharp', { provideCompletionItems: (m, p) => ({ suggestions: [{ label: 'main', kind: monaco.languages.CompletionItemKind.Snippet, insertText: 'using System;\n\nclass Program {\n\tstatic void Main() {\n\t\t$1\n\t}\n}', insertTextRules: monaco.languages.CompletionItemInsertTextRule.InsertAsSnippet, detail: 'C# Main Boilerplate' }] }) });

    
    editor.onDidChangeModelContent(() => {
      ls().userCode = editor.getValue();
      saveState();
    });
  }

  function updateEditorLanguage() {
    if (!editor) return;
    const langMap = {
      'JavaScript': 'javascript',
      'TypeScript': 'typescript',
      'Node.js': 'javascript',
      'React': 'javascript',
      'Python': 'python',
      'HTML': 'html',
      'CSS': 'css',
      'Java': 'java',
      'C++': 'cpp',
      'C#': 'csharp',
      'Go': 'go',
      'Rust': 'rust'
    };
    const fileMap = {
      'JavaScript': 'index.js', 'TypeScript': 'index.ts', 'Node.js': 'app.js', 'React': 'App.jsx', 'Python': 'main.py', 'HTML': 'index.html', 'CSS': 'style.css', 'Java': 'Main.java', 'C++': 'main.cpp', 'C#': 'Program.cs', 'Go': 'main.go', 'Rust': 'main.rs'
    };
    
    const model = editor.getModel();
    monaco.editor.setModelLanguage(model, langMap[state.lang] || 'javascript');
    el.fileName.textContent = fileMap[state.lang] || 'index.js';
  }

  // ─── Persistence ────────────────────────────────────────
  function loadState() {
    try {
      const d = JSON.parse(localStorage.getItem('devx_ide') || '{}');
      if (d.provider) state.provider = d.provider;
      if (d.model) state.model = d.model;
      if (d.lang) state.lang = d.lang;
      if (d.diff) state.diff = d.diff;
      
      if (d.history) state.history = d.history;
      if (d.currentTask && !state.history[state.lang]) {
        state.history[state.lang] = { currentTask: d.currentTask, userCode: d.userCode||'', feedback: d.feedback||'', status: d.status||'' };
      }
    } catch {}
  }

  function saveState() {
    localStorage.setItem('devx_ide', JSON.stringify(state));
  }

  function applyUI() {
    el.provider.value = state.provider;
    el.lang.value = state.lang;
    el.diff.value = state.diff;
    
    el.statusLang.textContent = state.lang;
    el.statusDiff.textContent = state.diff;
    
    if (ls().currentTask) {
      el.taskText.innerHTML = renderMd(ls().currentTask);
      el.checkBtn.textContent = 'Kodu Kontrol Et';
      el.checkBtn.classList.remove('correct');
    } else {
      el.taskText.textContent = 'Lütfen üst menüden dil ve zorluk seçip "Görevi Başlat" butonuna tıklayın.';
      el.checkBtn.textContent = 'Görevi Başlat';
    }
    
    if (ls().feedback) {
      el.feedbackBox.style.display = 'block';
      el.feedbackText.innerHTML = renderMd(ls().feedback);
      if (ls().status === 'DOGRU') {
        el.feedbackBox.className = 'feedback-box ok';
        el.checkBtn.textContent = 'Sonraki Göreve Geç';
        el.checkBtn.classList.add('correct');
      } else {
        el.feedbackBox.className = 'feedback-box';
      }
    } else {
      el.feedbackBox.style.display = 'none';
    }
  }

  // ─── Markdown ───────────────────────────────────────────
  function renderMd(text) {
    try {
      if (typeof marked !== 'undefined') {
        return marked.parse(text);
      }
    } catch {}
    return text.replace(/\n/g, '<br>');
  }

  // ─── API & Evaluation ───────────────────────────────────
  async function evaluateCode() {
    // Eğer doğru bildiyse ve "Sonraki Göreve Geç" butonuna basıldıysa
    const isFirstTask = !ls().currentTask || ls().status === 'DOGRU';
    
    if (!isFirstTask && (!editor.getValue().trim() || editor.getValue().includes('Kodunuzu buraya yazın'))) {
      return toast('Lütfen editöre kodunuzu yazın.', 'err');
    }

        const currentCode = editor ? editor.getValue() : ls().userCode;
    if (!isFirstTask && (!currentCode.trim() || currentCode === ls().lastCheckedCode || currentCode.includes('kodunuzu buraya yazın'))) {
      return toast('Lütfen kodunuzda değişiklik yapıp tekrar deneyin.', 'err');
    }

    el.loading.style.display = 'flex';

    try {
      const res = await fetch('/api/evaluate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          provider: state.provider,
          model: state.model,
          lang: state.lang,
          diff: state.diff,
          currentTask: ls().currentTask,
          userCode: currentCode,
          isFirstTask: isFirstTask
        })
      });

      const data = await res.json();
      if (!data.success) throw new Error(data.error);

      const evalData = data.evaluation;
      
      if (evalData.status === 'DOGRU') {
        if (!ls().currentTask) {
          toast('Yeni görev başarıyla alındı.', 'ok');
        } else {
          toast('Doğru cevap! 🎉', 'ok');
        }
        
        ls().status = 'DOGRU';
        ls().feedback = evalData.message || 'Tebrikler, kodu doğru yazdınız!';
        
        // Eğer AI yeni görev verdiyse kaydet, yoksa bir sonraki turda ilk görevmiş gibi davranır
        if (isFirstTask || evalData.status === 'DOGRU') {
          ls().currentTask = evalData.nextTask || 'Göreviniz belirlenemedi.';
          ls().status = 'BEKLIYOR';
          ls().feedback = ''; // Yeni görev geldiği için feedbacki temizle
          ls().lastCheckedCode = '';
          
          if (editor) {
            editor.updateOptions({ readOnly: false });
            // KOD SILINMESIN ISTEGI: editor.setValue KALDIRILDI.
          }
        }
      } else {
        toast('Hatalı kod, ipuçlarını oku.', 'err');
        ls().status = 'YANLIS';
        ls().feedback = evalData.message || 'Kodunuzda hatalar var. Lütfen tekrar deneyin.';
        ls().lastCheckedCode = currentCode;
      }

      saveState();
      applyUI();

    } catch (e) {
      toast('API Hatası: ' + e.message, 'err');
    } finally {
      el.loading.style.display = 'none';
    }
  }

  function resetTask() {
    if (!confirm('Mevcut görevi sıfırlamak ve yeni bir başlangıç görevi almak istiyor musunuz?')) return;
    ls().currentTask = '';
    ls().feedback = '';
    ls().status = '';
    ls().lastCheckedCode = '';
    ls().userCode = '// Önce ayarlardan dil seçip "Görevi Başlat" butonuna tıklayın.\n';
    if(editor) {
      editor.setValue(ls().userCode);
      editor.updateOptions({ readOnly: true });
    }
    saveState();
    applyUI();
  }

  // ─── Settings Modal ─────────────────────────────────────
  function fillModels() {
    const list = modelsMap[state.provider] || [];
    el.model.innerHTML = '';
    list.forEach(m => {
      const o = document.createElement('option');
      o.value = m.id; o.textContent = m.name;
      if (m.id === state.model) o.selected = true;
      el.model.appendChild(o);
    });
    if (!list.find(m => m.id === state.model) && list.length) {
      state.model = list[0].id;
      el.model.value = state.model;
    }
  }

  // ─── Toast ──────────────────────────────────────────────
  function toast(msg, type = 'inf') {
    const d = document.createElement('div');
    d.className = `toast ${type}`;
    d.textContent = msg;
    el.toasts.appendChild(d);
    setTimeout(() => d.remove(), 4000);
  }

  // ─── Events ─────────────────────────────────────────────
  function bindEvents() {
    el.settingsBtn.onclick = () => el.overlay.classList.add('open');
    el.closeBtn.onclick = () => el.overlay.classList.remove('open');
    el.resetBtn.onclick = resetTask;
    
    el.provider.onchange = () => {
      state.provider = el.provider.value;
      fillModels();
    };
    
    el.saveBtn.onclick = () => {
      const oldLang = state.lang;
      state.provider = el.provider.value;
      state.model = el.model.value;
      state.lang = el.lang.value;
      state.diff = el.diff.value;
      
      saveState();
      applyUI();
      
      if (oldLang !== state.lang) {
        updateEditorLanguage();
        if(editor) {
          editor.setValue(ls().userCode || `// ${state.lang} için görevi başlatın...\n`);
          editor.updateOptions({ readOnly: !ls().currentTask });
        }
        saveState();
        applyUI();
      }
      
      el.overlay.classList.remove('open');
      toast('Ayarlar kaydedildi.', 'ok');
    };

    el.checkBtn.onclick = evaluateCode;
  }

  document.addEventListener('DOMContentLoaded', init);
})();
