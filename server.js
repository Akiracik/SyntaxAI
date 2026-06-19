require('dotenv').config();
const express = require('express');
const path = require('path');

const app = express();
const PORT = 3000;

app.use(express.json({ limit: '10mb' }));
app.use(express.static(path.join(__dirname, 'public')));

// ─── API Kod Değerlendirme Proxy ──────────────────────────────
app.post('/api/evaluate', async (req, res) => {
  const { provider, model, lang, diff, currentTask, userCode, isFirstTask } = req.body;

  // Çoklu API Key Desteği (Rotasyon için)
  const getKeys = (prefix) => {
    const keys = [];
    if (process.env[`${prefix}_API_KEY`]) keys.push(process.env[`${prefix}_API_KEY`]);
    let i = 1;
    while (process.env[`${prefix}_API_KEY_${i}`]) {
      keys.push(process.env[`${prefix}_API_KEY_${i}`]);
      i++;
    }
    return keys;
  };

  let apiKeys = [];
  if (provider === 'Gemini') apiKeys = getKeys('GEMINI');
  if (provider === 'OpenAI') apiKeys = getKeys('OPENAI');
  if (provider === 'Anthropic') apiKeys = getKeys('ANTHROPIC');

  if (!provider || apiKeys.length === 0 || !model) {
    return res.json({ success: false, error: `Eksik parametreler veya sunucuda ${provider} için API anahtarı ayarlanmamış (.env dosyasını kontrol edin).` });
  }

  // Zorluk seviyesine göre ipucu detayını ayarlama
  let hintInstructions = '';
  if (diff === 'Başlangıç') {
    hintInstructions = 'Kullanıcı başlangıç seviyesinde. Hata yaptığında çok detaylı ve açıklayıcı bir ipucu ver, mantığı adım adım açıkla.';
  } else if (diff === 'Orta') {
    hintInstructions = 'Kullanıcı orta seviyede. Sadece nerede hata yaptığını söyle ve düzeltmesi için ufak bir ipucu ver.';
  } else if (diff === 'İleri') {
    hintInstructions = 'Kullanıcı ileri seviyede. Sadece hatanın ne olduğunu çok kısa (tek cümleyle) belirt, çözümü kendisi bulsun.';
  }

  // Optimize edilmiş sistem talimatı (Token tasarrufu için JSON benzeri format)
  const systemInstruction = `Sen profesyonel bir yazılım eğitmenisin. Kullanıcı ${lang} dilini ${diff} seviyesinde öğreniyor.
Amacın kullanıcının kodunu değerlendirmek ve ona görevler vermek.

SADECE ŞU FORMATTA YANIT VER:
[DURUM] DOGRU veya YANLIS
[MESAJ] Kullanıcıya geri bildirim veya ipucu.
[GOREV] Eğer DURUM DOGRU ise, bir sonraki zorlaştırılmış görevi buraya yaz. DURUM YANLIS ise bu alanı boş bırak veya aynı görevi tekrarla.

Kurallar:
1. Doğrudan cevabı (tam kodu) verme, ipucu ver.
2. ${hintInstructions}
3. Çıktı kesinlikle belirtilen [DURUM], [MESAJ], [GOREV] taglerini içermelidir.`;

  // Eğer ilk görev isteniyorsa (kullanıcı start tuşuna bastıysa)
  const prompt = isFirstTask 
    ? `Lütfen bana seviyeme uygun İLK GÖREVİMİ ver. [DURUM] DOGRU olarak işaretle ve görevi [GOREV] kısmına yaz.`
    : `Mevcut Görevim: "${currentTask}"\n\nYazdığım Kod:\n\`\`\`${lang.toLowerCase()}\n${userCode}\n\`\`\`\n\nLütfen kodumu değerlendir.`;

  try {
    let aiResponse = '';
    let lastError = null;
    let fallbackModels = [model];
    
    // Fallback Modellerini Belirleme (Kota hatalarına karşı yedek modeller)
    if (provider === 'Gemini') {
      if (model !== 'gemini-2.5-flash') fallbackModels.push('gemini-2.5-flash');
      if (model !== 'gemini-2.0-flash') fallbackModels.push('gemini-2.0-flash');
    } else if (provider === 'OpenAI') {
      if (model !== 'gpt-4o-mini') fallbackModels.push('gpt-4o-mini');
    }

    // Model & API Key Rotasyonu
    for (let m = 0; m < fallbackModels.length; m++) {
      const currentModel = fallbackModels[m];
      
      for (let i = 0; i < apiKeys.length; i++) {
        const currentKey = apiKeys[i];
        try {
          if (provider === 'Gemini') {
            const response = await fetch(
              `https://generativelanguage.googleapis.com/v1beta/models/${currentModel}:generateContent?key=${currentKey}`,
              {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                  contents: [{ role: 'user', parts: [{ text: prompt }] }],
                  systemInstruction: { parts: [{ text: systemInstruction }] },
                  generationConfig: { maxOutputTokens: 2048, temperature: 0.3 }
                })
              }
            );

            const data = await response.json();
            if (data.error) {
              if (data.error.message.includes('Quota') || data.error.message.includes('demand') || response.status === 429) {
                throw new Error(`Kota Doldu: ${data.error.message}`);
              } else {
                 throw new Error(data.error.message);
              }
            }
            if (!data.candidates?.[0]?.content?.parts?.[0]?.text) throw new Error('Geçersiz yanıt.');
            aiResponse = data.candidates[0].content.parts[0].text;
            break;

          } else if (provider === 'OpenAI') {
            const response = await fetch('https://api.openai.com/v1/chat/completions', {
              method: 'POST',
              headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${currentKey}` },
              body: JSON.stringify({
                model: currentModel,
                messages: [{ role: 'system', content: systemInstruction }, { role: 'user', content: prompt }],
                max_tokens: 2048,
                temperature: 0.3
              })
            });
            const data = await response.json();
            if (data.error) {
               if (response.status === 429 || data.error.type === 'insufficient_quota') throw new Error('Kota Doldu');
               throw new Error(data.error.message);
            }
            aiResponse = data.choices[0].message.content;
            break;

          } else if (provider === 'Anthropic') {
            const response = await fetch('https://api.anthropic.com/v1/messages', {
              method: 'POST',
              headers: { 'Content-Type': 'application/json', 'x-api-key': currentKey, 'anthropic-version': '2023-06-01' },
              body: JSON.stringify({
                model: currentModel,
                system: systemInstruction,
                max_tokens: 2048,
                temperature: 0.3,
                messages: [{ role: 'user', content: prompt }]
              })
            });
            const data = await response.json();
            if (data.error) {
               if (response.status === 429) throw new Error('Kota Doldu');
               throw new Error(data.error.message);
            }
            aiResponse = data.content[0].text;
            break;
          }
        } catch (err) {
          lastError = err;
          console.log(`[UYARI] Model: ${currentModel}, Key: ${i+1} başarısız oldu: ${err.message}`);
        }
      }
      
      if (aiResponse) break; // Başarılı olduysa model rotasyonundan da çık
    }

    if (!aiResponse) {
      throw new Error(`Seçilen ve yedek (fallback) tüm modellerdeki API anahtarları denendi ancak işlem başarısız oldu. Son Hata: ${lastError.message}`);
    }

    // Basit Parsing
    const result = {
      status: 'YANLIS',
      message: '',
      nextTask: ''
    };

    const lines = aiResponse.split('\n');
    let currentBlock = '';

    lines.forEach(line => {
      if (line.startsWith('[DURUM]')) {
        result.status = line.replace('[DURUM]', '').trim().toUpperCase();
        currentBlock = '';
      } else if (line.startsWith('[MESAJ]')) {
        currentBlock = 'message';
        result.message = line.replace('[MESAJ]', '').trim() + '\n';
      } else if (line.startsWith('[GOREV]')) {
        currentBlock = 'task';
        result.nextTask = line.replace('[GOREV]', '').trim() + '\n';
      } else if (currentBlock === 'message') {
        result.message += line + '\n';
      } else if (currentBlock === 'task') {
        result.nextTask += line + '\n';
      }
    });

    result.message = result.message.trim();
    result.nextTask = result.nextTask.trim();

    res.json({ success: true, evaluation: result });

  } catch (error) {
    console.error(`[API Error] ${provider}:`, error.message);
    res.json({ success: false, error: error.message });
  }
});

// ─── Gemini Model Listesi ────────────────────────────────────
app.get('/api/gemini-models', async (req, res) => {
  const apiKey = process.env.GEMINI_API_KEY || process.env.GEMINI_API_KEY_1;
  if (!apiKey) return res.json({ success: false, error: 'Sunucuda GEMINI_API_KEY bulunamadı (.env).' });
  try {
    const response = await fetch(`https://generativelanguage.googleapis.com/v1beta/models?key=${apiKey}`);
    const data = await response.json();
    if (data.error) throw new Error(data.error.message);
    const models = (data.models || [])
      .filter(m => m.supportedGenerationMethods?.includes('generateContent'))
      .map(m => ({ id: m.name.replace('models/', ''), name: m.displayName || m.name.replace('models/', '') }));
    res.json({ success: true, models });
  } catch (error) {
    res.json({ success: false, error: error.message });
  }
});

app.listen(PORT, () => {
  console.log(`\n  🚀 IDE Server running at http://localhost:${PORT}\n`);
});
