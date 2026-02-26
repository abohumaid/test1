// ملف تكوين API للذكاء الاصطناعي
// تحديث لدعم OpenRouter فقط بشكل افتراضي

const OPENROUTER_API_KEY = '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';
// const OPENROUTER_MODEL = 'openai/gpt-3.5-turbo';
// const OPENROUTER_MODEL = 'openai/gpt-4-1106-preview';
// const OPENROUTER_MODEL = 'openai/gpt-oss-20b:free';
// const OPENROUTER_MODEL = 'meta-llama/llama-3.3-70b-instruct:free';
// const OPENROUTER_MODEL = 'google/gemini-2.0-flash-lite-preview-02-05:free';
// const OPENROUTER_MODEL = 'meta-llama/llama-3.1-8b-instruct:free';
const OPENROUTER_MODEL = 'openrouter/free'; // يختار أفضل نموذج مجاني متاح تلقائياً لضمان عدم توقف الخدمة
// const OPENROUTER_MODEL = 'meta-llama/Llama-3.1-8B-Instruct';
// const OPENROUTER_MODEL = 'Free188/llama-merge-ch_alpaca_lora-quantized-7b';
const OPENROUTER_API_URL = 'https://openrouter.ai/api/v1/chat/completions';
const SITE_URL = window.location.href;
const SITE_NAME = 'Plant Disease Chatbot';

// دالة لإنشاء طلب إلى OpenRouter
async function makeOpenRouterRequest(query, context, imageBase64 = null, retryModel = null) {
  let content;

  if (imageBase64) {
    content = [
      { type: "text", text: `السياق: ${context}\nالسؤال: ${query}` },
      {
        type: "image_url",
        image_url: {
          url: imageBase64
        }
      }
    ];
  } else {
    content = `السياق: ${context}\nالسؤال: ${query}`;
  }

  let targetModel;
  if (imageBase64) {
    targetModel = retryModel || "google/gemma-3-27b-it:free";
  } else {
    targetModel = OPENROUTER_MODEL;
  }

  // بعض النماذج (مثل gemma-3) لا تدعم تعليمات النظام
  const modelsWithoutSystemRole = [
    "google/gemma-3-27b-it:free",
    "google/gemma-3-12b-it:free",
    "google/gemma-3-4b-it:free"
  ];

  const systemInstruction = "أنت مساعد ذكي متخصص في تشخيص أمراض النباتات. إذا تم إرسال صورة، قم بتحليلها بدقة واذكر اسم المرض والعلاج المناسب باللغة العربية. إذا لم تكن هناك صورة، أجب على الأسئلة بناءً على السياق المتاح.";
  let messages = [];

  if (modelsWithoutSystemRole.includes(targetModel)) {
    // دمج تعليمات النظام مع رسالة المستخدم
    if (Array.isArray(content)) {
      // إذا كان المحتوى صورة + نص
      content[0].text = `[تعليمات هامة: ${systemInstruction}]\n\n` + content[0].text;
      messages = [{ role: "user", content: content }];
    } else {
      // إذا كان المحتوى نص فقط
      messages = [{ role: "user", content: `[تعليمات هامة: ${systemInstruction}]\n\n` + content }];
    }
  } else {
    // إرسال تعليمات النظام بشكل طبيعي
    messages = [
      { role: "system", content: systemInstruction },
      { role: "user", content: content }
    ];
  }

  const body = {
    model: targetModel,
    messages: messages,
    max_tokens: 1000,
    temperature: 0.7
  };

  const response = await fetch(OPENROUTER_API_URL, {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${OPENROUTER_API_KEY}`,
      'Content-Type': 'application/json',
      'HTTP-Referer': SITE_URL,
      'X-Title': SITE_NAME
    },
    body: JSON.stringify(body)
  });

  if (!response.ok) {
    const errorText = await response.text();
    console.error(`OpenRouter Detail Error:`, errorText);

    // إذا كان الخطأ بسبب ضغط على الشبكة (429) أو بسبب نموذج غير صالح/مدعوم (400)،
    // نقوم بإرجاع كائن خاص للتعامل معه وتجربة نماذج أخرى.
    if (response.status === 429 || response.status === 400 || response.status === 404) {
      return { shouldRetry: true, status: response.status, error: errorText };
    }

    throw new Error(`OpenRouter HTTP error ${response.status}: ${errorText}`);
  }
  return await response.json();
}

// قائمة نماذج الرؤية المجانية كبدائل عند الضغط
const VISION_FALLBACK_MODELS = [
  "google/gemma-3-27b-it:free",
  "google/gemma-3-12b-it:free",
  "google/gemma-3-4b-it:free",
  "moonshotai/kimi-vl-a3b-thinking:free",
  "qwen/qwen2.5-vl-32b-instruct:free",
  "meta-llama/llama-3.2-11b-vision-instruct:free"
];

// دالة API رئيسية: ترسل إلى OpenRouter وتعيد الرسالة
async function getOpenRouterResponse(query, context, imageBase64 = null) {
  try {
    let result = await makeOpenRouterRequest(query, context, imageBase64);

    // نظام المحاولة مع نماذج أخرى إذا كان هناك ضغط أو خطأ في النموذج الأساسي
    if (result && result.shouldRetry && imageBase64) {
      console.warn(`النموذج مشغول أو غير مدعوم (الخطأ ${result.status})، البدء في تجربة نماذج احتياطية...`);

      for (let i = 0; i < VISION_FALLBACK_MODELS.length; i++) {
        const fallbackModel = VISION_FALLBACK_MODELS[i];

        // منع اختيار نفس النموذج المعطوب مرة أخرى كاحتياطي أولي
        if (fallbackModel === "google/gemma-3-27b-it:free" && i === 0) continue;

        console.log(`تجربة النموذج الاحتياطي: ${fallbackModel}`);

        result = await makeOpenRouterRequest(query, context, imageBase64, fallbackModel);

        if (!result.shouldRetry) {
          console.log(`تم الاتصال بنجاح باستخدام: ${fallbackModel}`);
          break; // نجحنا، نخرج من الحلقة
        }
      }

      // إذا فشلنا في جميع النماذج
      if (result && result.shouldRetry) {
        return null; // سيؤدي ذلك للذهاب للرد الاحتياطي العادي
      }
    }

    if (
      result &&
      result.choices &&
      result.choices[0] &&
      result.choices[0].message &&
      result.choices[0].message.content
    )
      return result.choices[0].message.content;

    return 'لم أتمكن من إنتاج إجابة مناسبة.';
  } catch (error) {
    console.error('OpenRouter API error:', error);
    return null;
  }
}

// اجعل دالة best تستخدم فقط OpenRouter الآن
async function getBestAIResponse(query, context, imageBase64 = null) {
  const response = await getOpenRouterResponse(query, context, imageBase64);
  if (response && response.trim().length > 0) {
    return response;
  }
  return null; // نعيد null للسماح للملف الملحق بالتعامل مع الاحتياطي
}

// دالة الاستجابة الاحتياطية الخاصة بـ API
function generateApiFallbackResponse(query) {
  return `عذراً، لم أتمكن من الحصول على إجابة من الذكاء الاصطناعي حالياً. يرجى التأكد من اتصال الإنترنت أو المحاولة لاحقاً.`;
}

// دالة فحص صحة API Key
function validateApiKey() {
  const issues = [];

  if (!OPENROUTER_API_KEY) {
    issues.push('❌ مفتاح API مفقود');
  } else if (OPENROUTER_API_KEY.length < 10) {
    issues.push('❌ مفتاح API قصير جداً');
  } else if (!OPENROUTER_API_KEY.startsWith('sk-or-v1-')) {
    issues.push('⚠️ مفتاح API قد لا يكون صحيحاً (يجب أن يبدأ بـ sk-or-v1-)');
  } else {
    issues.push('✅ مفتاح API يبدو صحيحاً');
  }

  return issues;
}

// دالة فحص النموذج
function validateModel() {
  const issues = [];

  if (!OPENROUTER_MODEL) {
    issues.push('❌ النموذج غير محدد');
  } else if (OPENROUTER_MODEL.includes('free')) {
    issues.push('⚠️ النموذج المجاني قد يكون محدود الاستخدام');
  } else {
    issues.push('✅ النموذج محدد');
  }

  return issues;
}

// دالة فحص الاتصال
async function testConnection() {
  const issues = [];

  try {
    const testResponse = await fetch(OPENROUTER_API_URL, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${OPENROUTER_API_KEY}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        model: OPENROUTER_MODEL,
        messages: [{ role: "user", content: "test" }],
        max_tokens: 10
      })
    });

    if (testResponse.ok) {
      issues.push('✅ الاتصال بـ OpenRouter يعمل بشكل صحيح');
    } else {
      const errorText = await testResponse.text();
      issues.push(`❌ خطأ في الاتصال: ${testResponse.status} - ${errorText}`);
    }
  } catch (error) {
    issues.push(`❌ خطأ في الشبكة: ${error.message}`);
  }

  return issues;
}

// دالة فحص شامل لجميع المشاكل
async function diagnoseAllIssues() {
  console.log('🔍 بدء فحص المشاكل...');

  const allIssues = [];

  // فحص API Key
  console.log('فحص مفتاح API...');
  allIssues.push(...validateApiKey());

  // فحص النموذج
  console.log('فحص النموذج...');
  allIssues.push(...validateModel());

  // فحص الاتصال
  console.log('فحص الاتصال...');
  const connectionIssues = await testConnection();
  allIssues.push(...connectionIssues);

  return allIssues;
}

// دالة إنشاء زر الفحص
function createDiagnosticButton() {
  const button = document.createElement('button');
  button.textContent = '🔍 فحص المشاكل';
  button.style.cssText = `
    background: #007bff;
    color: white;
    border: none;
    padding: 10px 20px;
    border-radius: 5px;
    cursor: pointer;
    font-size: 14px;
    margin: 10px;
  `;

  button.onclick = async function () {
    button.textContent = '⏳ جاري الفحص...';
    button.disabled = true;

    try {
      const issues = await diagnoseAllIssues();

      // إنشاء نافذة عرض النتائج
      const resultDiv = document.createElement('div');
      resultDiv.style.cssText = `
        position: fixed;
        top: 50%;
        left: 50%;
        transform: translate(-50%, -50%);
        background: white;
        border: 2px solid #007bff;
        border-radius: 10px;
        padding: 20px;
        max-width: 500px;
        max-height: 400px;
        overflow-y: auto;
        z-index: 1000;
        box-shadow: 0 4px 6px rgba(0,0,0,0.1);
      `;

      resultDiv.innerHTML = `
        <h3 style="margin-top: 0; color: #007bff;">نتائج فحص المشاكل</h3>
        <div style="margin: 10px 0;">
          ${issues.map(issue => `<div style="margin: 5px 0; font-family: monospace;">${issue}</div>`).join('')}
        </div>
        <button onclick="this.parentElement.remove()" style="
          background: #dc3545;
          color: white;
          border: none;
          padding: 8px 16px;
          border-radius: 4px;
          cursor: pointer;
          margin-top: 10px;
        ">إغلاق</button>
      `;

      document.body.appendChild(resultDiv);

    } catch (error) {
      console.error('خطأ في الفحص:', error);
      alert('حدث خطأ أثناء الفحص: ' + error.message);
    } finally {
      button.textContent = '🔍 فحص المشاكل';
      button.disabled = false;
    }
  };

  return button;
}

// دالة إضافة الزر إلى عنصر محدد
function addDiagnosticButtonToElement(elementId) {
  if (typeof document !== 'undefined') {
    const element = document.getElementById(elementId);
    if (element) {
      const button = createDiagnosticButton();
      element.appendChild(button);
      console.log('تم إضافة زر فحص المشاكل إلى العنصر:', elementId);
    } else {
      console.error('العنصر غير موجود:', elementId);
    }
  }
}
