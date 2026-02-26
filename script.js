// متغيرات عامة
let uploadedText = '';
let textChunks = [];
let currentFile = null;
let currentImageBase64 = null; // تخزين الصورة المختارة بصيغة Base64

// ====== التسجيل الصوتي وتحويل الكلام إلى نص ======
let recognition = null;
let isRecording = false;
let micTranscript = '';

// ====== عداد الثواني أثناء التسجيل الصوتي ======
let micTimerInterval = null;
let micTimerValue = 0;
function startMicTimer() {
    const timer = document.getElementById('micTimer');
    micTimerValue = 0;
    timer.textContent = '0';
    timer.style.display = 'inline';
    micTimerInterval = setInterval(() => {
        micTimerValue++;
        timer.textContent = micTimerValue.toString();
    }, 1000);
}
function stopMicTimer() {
    const timer = document.getElementById('micTimer');
    if (micTimerInterval) clearInterval(micTimerInterval);
    timer.style.display = 'none';
    timer.textContent = '0';
    micTimerInterval = null;
    micTimerValue = 0;
}

// تهيئة التطبيق
document.addEventListener('DOMContentLoaded', function () {
    initializeApp();
    setupVoiceRecognition(); // ← إضافة تهيئة التسجيل الصوتي
});

function initializeApp() {
    setupFileUpload();
    setupChatInterface();
}

// إعداد رفع الملفات
function setupFileUpload() {
    const uploadArea = document.getElementById('uploadArea');
    const fileInput = document.getElementById('fileInput');

    // إعداد drag and drop
    uploadArea.addEventListener('dragover', handleDragOver);
    uploadArea.addEventListener('dragleave', handleDragLeave);
    uploadArea.addEventListener('drop', handleDrop);

    // إزالة الحدث من المنطقة الرئيسية لتجنب التكرار
    // uploadArea.addEventListener('click', () => fileInput.click());

    // إعداد اختيار الملف
    fileInput.addEventListener('change', handleFileSelect);
}

function handleDragOver(e) {
    e.preventDefault();
    document.getElementById('uploadArea').classList.add('dragover');
}

function handleDragLeave(e) {
    e.preventDefault();
    document.getElementById('uploadArea').classList.remove('dragover');
}

function handleDrop(e) {
    e.preventDefault();
    document.getElementById('uploadArea').classList.remove('dragover');

    const files = e.dataTransfer.files;
    if (files.length > 0) {
        handleFile(files[0]);
    }
}

function handleFileSelect(e) {
    const file = e.target.files[0];
    if (file) {
        handleFile(file);
    }
}

function handleFile(file) {
    // منع معالجة الملف إذا كان نفس الملف
    if (currentFile && currentFile.name === file.name && currentFile.size === file.size) {
        return;
    }

    const fileName = file.name.toLowerCase();
    const supportedFormats = ['.txt', '.docx'];
    const isSupported = supportedFormats.some(format => fileName.endsWith(format));

    if (!isSupported) {
        showError('يرجى اختيار ملف نصي (.txt) أو ملف Word (.docx) فقط');
        return;
    }

    if (file.size > 10 * 1024 * 1024) { // 10MB limit for Word files
        showError('حجم الملف كبير جداً. الحد الأقصى 10 ميجابايت');
        return;
    }

    currentFile = file;
    showFileInfo(file);
}

function showFileInfo(file) {
    const fileName = document.getElementById('fileName');
    const fileSize = document.getElementById('fileSize');
    const fileInfo = document.getElementById('fileInfo');

    // منع إعادة عرض نفس الملف
    if (fileName.textContent === file.name) {
        return;
    }

    // تحديد نوع الملف
    const fileType = file.name.toLowerCase().endsWith('.docx') ? 'Word' : 'نصي';
    const fileIcon = file.name.toLowerCase().endsWith('.docx') ? 'fas fa-file-word' : 'fas fa-file-alt';

    // تحديث الأيقونة
    const fileIconElement = fileInfo.querySelector('i');
    if (fileIconElement) {
        fileIconElement.className = fileIcon;
    }

    fileName.textContent = `${file.name} (${fileType})`;
    fileSize.textContent = formatFileSize(file.size);
    fileInfo.style.display = 'flex';

    // إضافة مستمع لزر المعالجة
    document.getElementById('processBtn').onclick = () => processFile(file);
}

function formatFileSize(bytes) {
    if (bytes === 0) return '0 Bytes';
    const k = 1024;
    const sizes = ['Bytes', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
}

// معالجة الملف
async function processFile(file) {
    showLoading(true);

    try {
        const text = await readFileAsText(file);
        uploadedText = text;

        // تقسيم النص إلى أجزاء
        textChunks = splitTextIntoChunks(text);

        // حفظ البيانات محلياً
        saveDataLocally();

        showSuccess('تم رفع الملف ومعالجته بنجاح!');

        // إظهار واجهة الشات
        setTimeout(() => {
            showChatInterface();
            showLoading(false);
        }, 1000);

    } catch (error) {
        console.error('خطأ في معالجة الملف:', error);
        showError('حدث خطأ في معالجة الملف. يرجى المحاولة مرة أخرى.');
        showLoading(false);
    }
}

function readFileAsText(file) {
    return new Promise((resolve, reject) => {
        const fileName = file.name.toLowerCase();

        if (fileName.endsWith('.txt')) {
            // قراءة ملف نصي عادي
            const reader = new FileReader();
            reader.onload = (e) => resolve(e.target.result);
            reader.onerror = (e) => reject(e);
            reader.readAsText(file, 'UTF-8');
        } else if (fileName.endsWith('.docx')) {
            // قراءة ملف Word باستخدام mammoth.js
            if (typeof mammoth === 'undefined') {
                reject(new Error('مكتبة قراءة ملفات Word غير متاحة'));
                return;
            }

            mammoth.extractRawText({ arrayBuffer: file })
                .then(result => {
                    if (result.messages.length > 0) {
                        console.warn('تحذيرات من ملف Word:', result.messages);
                    }
                    resolve(result.value);
                })
                .catch(error => {
                    reject(new Error('خطأ في قراءة ملف Word: ' + error.message));
                });
        } else {
            reject(new Error('نوع الملف غير مدعوم'));
        }
    });
}

function splitTextIntoChunks(text) {
    // تقسيم النص إلى أجزاء مناسبة للبحث
    const sentences = text.split(/[.!?؟]+/).filter(s => s.trim().length > 0);
    const chunks = [];
    let currentChunk = '';

    for (let sentence of sentences) {
        sentence = sentence.trim();
        if (currentChunk.length + sentence.length > 500) { // حد أقصى 500 حرف لكل جزء
            if (currentChunk) {
                chunks.push(currentChunk.trim());
            }
            currentChunk = sentence;
        } else {
            currentChunk += (currentChunk ? '. ' : '') + sentence;
        }
    }

    if (currentChunk) {
        chunks.push(currentChunk.trim());
    }

    return chunks;
}

// حفظ البيانات محلياً
function saveDataLocally() {
    const data = {
        text: uploadedText,
        chunks: textChunks,
        timestamp: new Date().toISOString()
    };

    localStorage.setItem('chatbot_data', JSON.stringify(data));
}

// تحميل البيانات المحفوظة
function loadDataLocally() {
    const data = localStorage.getItem('chatbot_data');
    if (data) {
        const parsed = JSON.parse(data);
        uploadedText = parsed.text;
        textChunks = parsed.chunks;
        return true;
    }
    return false;
}

// إعداد واجهة الشات
function setupChatInterface() {
    const messageInput = document.getElementById('messageInput');
    const sendBtn = document.getElementById('sendBtn');

    messageInput.addEventListener('keypress', (e) => {
        if (e.key === 'Enter' && !e.shiftKey) {
            e.preventDefault();
            sendMessage();
        }
    });

    sendBtn.addEventListener('click', sendMessage);
}

function showChatInterface() {
    document.getElementById('uploadSection').style.display = 'none';
    document.getElementById('chatSection').style.display = 'block';
}

// إرسال الرسالة
async function sendMessage() {
    const messageInput = document.getElementById('messageInput');
    const message = messageInput.value.trim();

    if (!message && !currentImageBase64) return;

    // إضافة رسالة المستخدم
    if (currentImageBase64) {
        addMessage(message, 'user', false, currentImageBase64);
    } else {
        addMessage(message, 'user');
    }

    // حفظ نسخة من الصورة الحالية وإفراغ المعاينة
    const imageToSend = currentImageBase64;
    messageInput.value = '';
    clearImagePreview();

    // تعطيل الإدخال أثناء المعالجة
    setChatInputEnabled(false);

    try {
        // البحث في النصوص المحفوظة
        const relevantChunks = searchInText(message);

        // إرسال الطلب إلى API
        const response = await getAIResponse(message, relevantChunks, imageToSend);

        // إضافة رد البوت
        // --- عرض تدريجي لرد البوت:
        const messageBody = addMessage('', 'bot', true);
        if (messageBody) {
            // التحقق من وجود جداول في الرد
            const processedContent = processTextWithTables(response);

            if (processedContent.hasTables) {
                // عرض الجداول مباشرة بدون تأثير الكتابة التدريجية
                let finalContent = processedContent.content;

                // استبدال placeholders بالجداول
                processedContent.tables.forEach((tableHTML, index) => {
                    const placeholder = `[TABLE_HTML_${index}]`;
                    finalContent = finalContent.replace(placeholder, tableHTML);
                });

                messageBody.innerHTML = finalContent;
            } else {
                // إذا كان هناك تنسيق **bold** أو __bold__، نعرضه مباشرة كـ HTML بدون الرموز
                const hasEmphasis = /\*\*[\s\S]+?\*\*/.test(response) || /__([\s\S]+?)__/.test(response);
                if (hasEmphasis) {
                    messageBody.innerHTML = applyEmphasis(response);
                } else {
                    // عرض النص العادي مع تأثير الكتابة التدريجية
                    if (isShortText(response)) {
                        messageBody.classList.add('single-line');
                    }
                    await new Promise(resolve => {
                        typeWriterEffect(messageBody, response, 16, resolve); // سرعة 16ms للحرف تجعلها مقاربة لـ ChatGPT
                    });
                }
            }
        } else {
            // احتياطي في حال فشل التدريج
            addMessage(response, 'bot');
        }

    } catch (error) {
        console.error('خطأ في إرسال الرسالة:', error);
        addMessage('عذراً، حدث خطأ في المعالجة. يرجى المحاولة مرة أخرى.', 'bot');
    } finally {
        setChatInputEnabled(true);
    }
}

function addMessage(content, sender, isGradual = false, imageBase64 = null) {
    const chatMessages = document.getElementById('chatMessages');
    const messageDiv = document.createElement('div');
    messageDiv.className = `message ${sender}-message`;

    const icon = sender === 'user' ? 'fas fa-user' : 'fas fa-robot';

    let imageHtml = '';
    if (imageBase64) {
        imageHtml = `<img src="${imageBase64}" style="max-width: 200px; border-radius: 8px; margin-bottom: 8px; display: block;">`;
    }

    if (sender === 'bot' && isGradual) {
        messageDiv.innerHTML = `
            <div class="message-content">
                <i class="${icon}"></i>
                <div class="message-body">${imageHtml}</div>
            </div>
        `;
        chatMessages.appendChild(messageDiv);
        chatMessages.scrollTop = chatMessages.scrollHeight;
        // أرجع عنصر message-body للكتابة فيه تدريجيًا
        return messageDiv.querySelector('.message-body');
    } else {
        // معالجة الجداول في المحتوى
        const processedContent = processTextWithTables(content);

        if (processedContent.hasTables) {
            // إنشاء محتوى مع جداول
            let finalContent = processedContent.content;

            // استبدال placeholders بالجداول
            processedContent.tables.forEach((tableHTML, index) => {
                const placeholder = `[TABLE_HTML_${index}]`;
                finalContent = finalContent.replace(placeholder, tableHTML);
            });

            messageDiv.innerHTML = `
                <div class="message-content">
                    <i class="${icon}"></i>
                    <div class="message-body">${imageHtml}${finalContent}</div>
                </div>
            `;
        } else {
            // تطبيق التنسيق الغامق على النص
            const finalHtml = applyEmphasis(content);
            messageDiv.innerHTML = `
                <div class="message-content">
                    <i class="${icon}"></i>
                    <div class="message-body">${imageHtml}${finalHtml}</div>
                </div>
            `;
        }

        chatMessages.appendChild(messageDiv);
        chatMessages.scrollTop = chatMessages.scrollHeight;

        const messageBody = messageDiv.querySelector('.message-body');
        if (isShortText(content)) {
            messageBody.classList.add('single-line');
        }
        return null;
    }
}

function setChatInputEnabled(enabled) {
    const messageInput = document.getElementById('messageInput');
    const sendBtn = document.getElementById('sendBtn');

    messageInput.disabled = !enabled;
    sendBtn.disabled = !enabled;

    if (enabled) {
        messageInput.focus();
    }
}

// البحث في النصوص
function searchInText(query) {
    if (!textChunks.length) return [];

    const queryWords = query.toLowerCase().split(/\s+/);
    const scoredChunks = textChunks.map((chunk, index) => {
        const chunkLower = chunk.toLowerCase();
        let score = 0;

        // حساب النقاط بناءً على عدد الكلمات المطابقة
        queryWords.forEach(word => {
            if (chunkLower.includes(word)) {
                score += 1;
            }
        });

        return { chunk, score, index };
    });

    // ترتيب النتائج حسب النقاط
    scoredChunks.sort((a, b) => b.score - a.score);

    // إرجاع أفضل 3 نتائج
    return scoredChunks.slice(0, 3).map(item => item.chunk);
}

// الحصول على رد من API الذكاء الاصطناعي
async function getAIResponse(query, contextChunks, imageBase64 = null) {
    // إنشاء السياق من النصوص ذات الصلة
    const context = contextChunks.join('\n\n');

    // إذا كانت هناك صورة، نعدل السؤال لإرشاد الذكاء الاصطناعي
    let finalQuery = query;
    if (imageBase64) {
        finalQuery = `يرجى تحليل هذه الصورة لنبات مصاب بدقة. اذكر اسم المرض والعلاج والوقاية منه. السؤال: ${query || "ما هو هذا المرض وعلاجه؟"}`;
    }

    try {
        const response = await getBestAIResponse(finalQuery, context, imageBase64);

        if (response) {
            return response;
        }

        // إذا فشل الـ AI ولكن هناك صورة، نطلب منه المحاولة مرة أخرى أو نبلغ عن خطأ
        if (imageBase64) {
            return "عذراً، واجهت مشكلة في تحليل الصورة. يرجى التأكد من جودة الصورة والمحاولة مرة أخرى.";
        }

        // إذا لم يكن هناك صورة، نستخدم الرد الاحتياطي من الملف
        return generateFallbackResponse(query, contextChunks);
    } catch (error) {
        console.error('API Error:', error);
        if (imageBase64) {
            return "جميع مزودات تحليل الصور مجانية مشغولة حالياً بسبب الضغط العالي. يرجى الانتظار دقيقة والمحاولة مرة أخرى.";
        }
        return generateFallbackResponse(query, contextChunks);
    }
}

// رد بديل في حالة فشل API
function generateFallbackResponse(query, contextChunks) {
    if (contextChunks.length > 0) {
        return `بناءً على المعلومات المتاحة، يمكنني أن أقول أن: ${contextChunks[0].substring(0, 200)}...`;
    } else {
        return 'عذراً، لم أجد معلومات ذات صلة بسؤالك في الملف المرفوع.';
    }
}

// =========== [1] دالة الكتابة التدريجية ==========
function typeWriterEffect(targetElement, text, speed = 20, cb) {
    // معالجة الجداول في النص
    const processedContent = processTextWithTables(text);

    if (processedContent.hasTables) {
        // عرض الجداول مباشرة بدون تأثير الكتابة التدريجية
        let finalContent = processedContent.content;

        // استبدال placeholders بالجداول
        processedContent.tables.forEach((tableHTML, index) => {
            const placeholder = `[TABLE_HTML_${index}]`;
            finalContent = finalContent.replace(placeholder, tableHTML);
        });

        targetElement.innerHTML = finalContent;

        if (typeof cb === 'function') {
            cb();
        }
        return;
    }

    // الكتابة التدريجية للنص العادي
    let i = 0;
    function type() {
        if (i < text.length) {
            targetElement.textContent += text.charAt(i);
            i++;
            setTimeout(type, speed);
        } else if (typeof cb === 'function') {
            cb();
        }
    }
    type();
}

// =========== [2] دوال الجداول ==========
// دالة للكشف عن الجداول في النص
function detectTables(text) {
    // أنماط مختلفة للجداول
    const tablePatterns = [
        // جدول بفواصل | أو - أو :
        /(\|.*\|[\s\S]*?)(?=\n\n|\n[^|]|$)/g,
        // جدول بفواصل - و +
        /(\+.*\+[\s\S]*?)(?=\n\n|\n[^+]|$)/g,
        // جدول بفواصل :
        /(:.*:[\s\S]*?)(?=\n\n|\n[^:]|$)/g
    ];

    const tables = [];
    let processedText = text;

    tablePatterns.forEach(pattern => {
        const matches = text.match(pattern);
        if (matches) {
            matches.forEach(match => {
                const tableData = parseTable(match.trim());
                if (tableData && tableData.rows.length > 0) {
                    tables.push(tableData);
                    // استبدال الجدول في النص بـ placeholder
                    processedText = processedText.replace(match, `[TABLE_${tables.length - 1}]`);
                }
            });
        }
    });

    return { tables, processedText };
}

// دالة لتحليل الجدول
function parseTable(tableText) {
    const lines = tableText.split('\n').filter(line => line.trim());
    if (lines.length < 2) return null;

    const rows = [];
    let headers = [];

    lines.forEach((line, index) => {
        const trimmedLine = line.trim();

        // تخطي خطوط الفواصل (مثل |---|---|)
        if (trimmedLine.match(/^[\|\+\-\s:]+$/)) return;

        // تقسيم السطر إلى خلايا
        const cells = trimmedLine.split(/[\|\+\-:]/)
            .map(cell => cell.trim())
            .filter(cell => cell.length > 0);

        if (cells.length > 0) {
            if (index === 0) {
                headers = cells;
            } else {
                rows.push(cells);
            }
        }
    });

    return { headers, rows };
}

// دالة لإنشاء HTML للجدول
function createTableHTML(tableData) {
    if (!tableData || !tableData.headers || tableData.headers.length === 0) {
        return '';
    }

    let html = '<table class="chat-table">';

    // رأس الجدول
    html += '<thead><tr>';
    tableData.headers.forEach(header => {
        html += `<th>${header}</th>`;
    });
    html += '</tr></thead>';

    // جسم الجدول
    html += '<tbody>';
    tableData.rows.forEach(row => {
        html += '<tr>';
        // التأكد من أن عدد الخلايا يطابق عدد العناوين
        for (let i = 0; i < tableData.headers.length; i++) {
            const cellContent = row[i] || '';
            html += `<td>${cellContent}</td>`;
        }
        html += '</tr>';
    });
    html += '</tbody>';

    html += '</table>';
    return html;
}

// دالة لمعالجة النص مع الجداول
function processTextWithTables(text) {
    const { tables, processedText } = detectTables(text);

    if (tables.length === 0) {
        return { hasTables: false, content: text };
    }

    let finalText = processedText;
    let tableHTMLs = [];

    // استبدال placeholders بالجداول
    tables.forEach((table, index) => {
        const placeholder = `[TABLE_${index}]`;
        const tableHTML = createTableHTML(table);
        tableHTMLs.push(tableHTML);
        finalText = finalText.replace(placeholder, `[TABLE_HTML_${index}]`);
    });

    return {
        hasTables: true,
        content: finalText,
        tables: tableHTMLs
    };
}

// =========== [3] تنسيق التأكيد (Bold) ==========
// تحويل **النص المهم** أو __النص المهم__ إلى <strong>النص المهم>
function applyEmphasis(text) {
    if (!text) return '';
    let result = text;
    // استبدال **...**
    result = result.replace(/\*\*([\s\S]+?)\*\*/g, '<strong>$1</strong>');
    // استبدال __...__
    result = result.replace(/__([\s\S]+?)__/g, '<strong>$1</strong>');
    return result;
}

// وظائف مساعدة
function showLoading(show) {
    document.getElementById('loading').style.display = show ? 'flex' : 'none';
}

function showError(message) {
    const errorDiv = document.createElement('div');
    errorDiv.className = 'error-message';
    errorDiv.textContent = message;

    document.querySelector('.upload-section').insertBefore(errorDiv, document.querySelector('.upload-area'));

    setTimeout(() => {
        errorDiv.remove();
    }, 5000);
}

function showSuccess(message) {
    const successDiv = document.createElement('div');
    successDiv.className = 'success-message';
    successDiv.textContent = message;

    document.querySelector('.upload-section').insertBefore(successDiv, document.querySelector('.upload-area'));

    setTimeout(() => {
        successDiv.remove();
    }, 3000);
}

// مسح المحادثة فقط
function clearChat() {
    if (confirm('هل أنت متأكد من مسح المحادثة؟')) {
        // مسح رسائل الشات
        document.getElementById('chatMessages').innerHTML = `
            <div class="message bot-message">
                <div class="message-content">
                    <i class="fas fa-robot"></i>
                    <p>تم مسح المحادثة. يمكنك الآن طرح أسئلة جديدة حول محتوى الملف.</p>
                </div>
            </div>
        `;

        // إظهار رسالة تأكيد
        showSuccess('تم مسح المحادثة بنجاح!');
    }
}

// إعادة تعيين التطبيق
function resetApp() {
    uploadedText = '';
    textChunks = [];
    currentFile = null;

    document.getElementById('uploadSection').style.display = 'block';
    document.getElementById('chatSection').style.display = 'none';
    document.getElementById('fileInfo').style.display = 'none';
    document.getElementById('fileInput').value = '';

    // مسح رسائل الشات
    document.getElementById('chatMessages').innerHTML = `
        <div class="message bot-message">
            <div class="message-content">
                <i class="fas fa-robot"></i>
                <p>welcome to the Chatbot !!</p>
            </div>
        </div>
    `;

    // مسح البيانات المحفوظة
    localStorage.removeItem('chatbot_data');
}

// تحميل البيانات المحفوظة عند بدء التطبيق
window.addEventListener('load', () => {
    if (loadDataLocally()) {
        showChatInterface();
        // addMessage('تم تحميل البيانات المحفوظة. يمكنك متابعة المحادثة.', 'bot');
        // addMessage('Ahmed Mohamed', 'bot');
    }
});

async function chooseJsonFromProject() {
    showLoading(true);
    try {
        // البيانات المضمنة مباشرة في الكود لتجنب مشاكل CORS
        const data = [
            ["ان اسمي احمد محمد وعمري 22 سنه حاليا اطالب في قسم it  في جامعة 6 اكتوبر ولدي او عندي 3 اخوات الاول ادم والثاني الين اكتر اكله بحبها عي السمك "],
        ];

        // استخراج جميع القيم
        const values = Array.isArray(data) ? data.flat().filter(Boolean) : [];
        uploadedText = values.join('\n\n');
        textChunks = values;
        saveDataLocally();
        showSuccess('تم فتح قاعدة البيانات الجاهزة!');
        setTimeout(() => {
            showChatInterface();
            document.getElementById('chatMessages').innerHTML = `
                <div class="message bot-message">
                    <div class="message-content">
                        <i class="fas fa-robot"></i>
                        <p>Welcome to the Chatbot !</p>
                    </div>
                </div>
            `;
            showLoading(false);
        }, 700);
    } catch (error) {
        showLoading(false);
        showError('فشل تحميل قاعدة البيانات: ' + error.message);
    }
}

function setupVoiceRecognition() {
    const micBtn = document.getElementById('micBtn');
    const micIcon = micBtn.querySelector('i');
    if (!micBtn) return;
    // Web Speech API compatibility
    const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
    if (!SpeechRecognition) {
        micBtn.disabled = true;
        micBtn.title = 'ميزة التسجيل الصوتي غير مدعومة في هذا المتصفح';
        return;
    }
    recognition = new SpeechRecognition();
    recognition.lang = 'ar-EG'; // يدعم العربية
    recognition.interimResults = true;
    recognition.continuous = true;
    micBtn.addEventListener('click', () => {
        if (!isRecording) {
            micTranscript = '';
            try {
                recognition.start();
                isRecording = true;
                micBtn.classList.add('recording');
                micIcon.classList.remove('fa-microphone');
                micIcon.classList.add('fa-stop-circle');
                micBtn.title = 'اضغط لإيقاف التسجيل';
                startMicTimer();
            } catch (e) { }
        } else {
            recognition.stop();
            // المايك سيتوقف حتمًا باستدعاء .onend لاحقاً
            // لكن لإرسال النص أو الخطأ مباشرة نستخدم micTranscript بعد التوقف الفعلي
        }
    });
    recognition.onstart = function () {
        isRecording = true;
        // العداد بدأ فعلياً من زر المايك
    };
    recognition.onresult = function (event) {
        let interim = '';
        for (let i = event.resultIndex; i < event.results.length; ++i) {
            let transcript = event.results[i][0].transcript;
            if (event.results[i].isFinal) {
                micTranscript += transcript + ' ';
            } else {
                interim += transcript;
            }
        }
        // ممكن أن نعرض النص المؤقت للمستخدم في صندوق الإدخال هنا إذا أحببنا:
        const messageInput = document.getElementById('messageInput');
        messageInput.value = micTranscript + interim;
    };
    recognition.onerror = function (event) {
        isRecording = false;
        micBtn.classList.remove('recording');
        micIcon.classList.remove('fa-stop-circle');
        micIcon.classList.add('fa-microphone');
        micBtn.title = 'تسجيل صوتي';
        stopMicTimer();
        showError('حدثت مشكلة أثناء تسجيل الصوت: ' + event.error);
    };
    recognition.onend = function () {
        isRecording = false;
        micBtn.classList.remove('recording');
        micIcon.classList.remove('fa-stop-circle');
        micIcon.classList.add('fa-microphone');
        micBtn.title = 'تسجيل صوتي';
        stopMicTimer();
        // عند الإيقاف اليدوي فقط - أرسل النص المجمع إذا كان موجود، وإلا أظهر رسالة خطأ
        const messageInput = document.getElementById('messageInput');
        if (micTranscript.trim()) {
            messageInput.value = micTranscript.trim();
            sendMessage();
        } else {
            showError('لم يتم التقاط أي صوت واضح. حاول مرة أخرى.');
            messageInput.value = '';
        }
        micTranscript = '';
    };
}

function isShortText(text) {
    if (!text) return false;
    if (text.includes('\n')) return false;
    return text.trim().length <= 40; // حد تقريبي لرسالة قصيرة
}

// دالة تشغيل فحص المشاكل
async function runDiagnosticCheck() {
    try {
        // إظهار رسالة تحميل
        showLoading(true);

        // تشغيل فحص المشاكل
        const issues = await diagnoseAllIssues();

        // إخفاء رسالة التحميل
        showLoading(false);

        // إنشاء نافذة عرض النتائج
        const resultDiv = document.createElement('div');
        resultDiv.style.cssText = `
            position: fixed;
            top: 50%;
            left: 50%;
            transform: translate(-50%, -50%);
            background: white;
            border: 2px solid #dc3545;
            border-radius: 10px;
            padding: 20px;
            max-width: 600px;
            max-height: 500px;
            overflow-y: auto;
            z-index: 1000;
            box-shadow: 0 4px 6px rgba(0,0,0,0.1);
            font-family: Arial, sans-serif;
        `;

        resultDiv.innerHTML = `
            <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 15px;">
                <h3 style="margin: 0; color: #dc3545; display: flex; align-items: center;">
                    <i class="fas fa-stethoscope" style="margin-left: 8px;"></i>
                    نتائج فحص المشاكل
                </h3>
                <button onclick="this.parentElement.parentElement.remove()" style="
                    background: #6c757d;
                    color: white;
                    border: none;
                    padding: 5px 10px;
                    border-radius: 4px;
                    cursor: pointer;
                    font-size: 12px;
                ">✕</button>
            </div>
            <div style="margin: 10px 0; max-height: 350px; overflow-y: auto;">
                ${issues.map(issue => `
                    <div style="
                        margin: 8px 0; 
                        padding: 8px 12px;
                        border-radius: 5px;
                        font-family: 'Courier New', monospace;
                        font-size: 14px;
                        background: ${issue.includes('✅') ? '#d4edda' : issue.includes('⚠️') ? '#fff3cd' : '#f8d7da'};
                        border-left: 4px solid ${issue.includes('✅') ? '#28a745' : issue.includes('⚠️') ? '#ffc107' : '#dc3545'};
                    ">${issue}</div>
                `).join('')}
            </div>
            <div style="text-align: center; margin-top: 15px;">
                <button onclick="this.parentElement.parentElement.remove()" style="
                    background: #dc3545;
                    color: white;
                    border: none;
                    padding: 10px 20px;
                    border-radius: 5px;
                    cursor: pointer;
                    font-size: 14px;
                ">إغلاق</button>
            </div>
        `;

        document.body.appendChild(resultDiv);

    } catch (error) {
        showLoading(false);
        console.error('خطأ في فحص المشاكل:', error);
        showError('حدث خطأ أثناء فحص المشاكل: ' + error.message);
    }
}

// ====== التعامل مع الصور ======
function handleImageSelect(event) {
    const file = event.target.files[0];
    if (file && file.type.startsWith('image/')) {
        const reader = new FileReader();
        reader.onload = function (e) {
            currentImageBase64 = e.target.result;
            const preview = document.getElementById('imagePreview');
            const container = document.getElementById('imagePreviewContainer');
            preview.src = currentImageBase64;
            container.style.display = 'block';

            // تنبيه المستخدم بأنه تم تحميل الصورة
            const messageInput = document.getElementById('messageInput');
            if (!messageInput.value) {
                messageInput.placeholder = "اسأل عن مرض هذا النبات...";
            }
        };
        reader.readAsDataURL(file);
    }
}

function clearImagePreview() {
    currentImageBase64 = null;
    document.getElementById('imagePreviewContainer').style.display = 'none';
    document.getElementById('imagePreview').src = '';
    document.getElementById('imageInput').value = '';
    document.getElementById('messageInput').placeholder = "... اكتب سؤالك هنا أو ارفع صورة لنبات";
}

