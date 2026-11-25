const STORAGE_KEY = 'trop-wiki-data';
const LEGACY_KEY = 'trop-articles';

const DEFAULT_DATA = {
    version: 2,
    sections: [
        { id: 'connection', title: 'Подключение', description: 'Получение доступа и подключение к TropVPN.' },
        { id: 'subscription', title: 'Подписка и оплата', description: 'Покупка, продление и управление подпиской.' },
        { id: 'apps', title: 'Приложения', description: 'Клиенты и настройка на разных устройствах.' },
        { id: 'troubleshooting', title: 'Решение проблем', description: 'Что проверить, если что-то работает не так.' }
    ],
    articles: [{
        id: 'connect',
        sectionId: 'connection',
        title: 'Как подключить TropVPN',
        summary: 'Получение ссылки подписки, добавление в HAPP и первое подключение.',
        tags: ['HAPP', 'подключение', 'настройка'],
        content: 'Перед началом\n\nДля подключения понадобится активная подписка TropVPN и приложение HAPP на твоём устройстве.\n\n## 01. Получи доступ\n\nОткрой Telegram-бота @TropVPNbot и оформи подписку. После оформления бот предоставит ссылку для подключения.\n\n## 02. Добавь подписку\n\nОткрой HAPP и выбери добавление конфигурации по ссылке. Вставь ссылку, полученную в боте, и подтверди импорт.\n\n## 03. Подключись\n\nПосле добавления конфигурация появится в приложении. Выбери её и нажми кнопку подключения. При первом запуске устройство может запросить разрешение на создание VPN-подключения.\n\n## Если не получается\n\n- Проверь, что подписка активна.\n- Убедись, что ссылка скопирована полностью.\n- Проверь подключение к интернету.\n- Попробуй обновить подписку в HAPP.\n\n> Если проблема не решилась, напиши в поддержку TropVPN через Telegram-бота.',
        status: 'published',
        updatedAt: '24 ноября 2026',
        createdAt: '24 ноября 2026'
    }]
};

function clone(value) { return JSON.parse(JSON.stringify(value)); }

function normalizeData(raw) {
    if (raw && raw.version === 2 && Array.isArray(raw.sections) && Array.isArray(raw.articles)) {
        return { version: 2, sections: raw.sections, articles: raw.articles };
    }

    const sections = Array.isArray(raw?.sections) && raw.sections.length
        ? raw.sections.map(section => ({ id: section.id, title: section.title || 'Без названия', description: section.description || '' }))
        : clone(DEFAULT_DATA.sections);

    const oldSubsections = Array.isArray(raw?.subsections) ? raw.subsections : [];
    const articles = Array.isArray(raw?.articles) ? raw.articles.map((article, index) => {
        const subsection = oldSubsections.find(item => item.id === article.subsectionId);
        const sectionId = sections.some(item => item.id === article.sectionId)
            ? article.sectionId
            : (subsection?.sectionId || sections[0]?.id);
        return {
            ...article,
            id: article.id || 'migrated-' + index,
            sectionId: sections.some(item => item.id === sectionId) ? sectionId : sections[0]?.id,
            tags: Array.isArray(article.tags) ? article.tags : [],
            status: article.status || 'published'
        };
    }) : [];

    if (!articles.length && raw?.articles === undefined) {
        const legacy = localStorage.getItem(LEGACY_KEY);
        if (legacy) {
            try {
                const oldArticles = JSON.parse(legacy);
                if (Array.isArray(oldArticles)) oldArticles.forEach((article, index) => articles.push({
                    ...article,
                    id: article.id || 'legacy-' + index,
                    sectionId: sections.find(section => section.title === article.category)?.id || sections[0]?.id,
                    tags: [],
                    status: article.status || 'published'
                }));
            } catch (error) { console.warn('Не удалось импортировать старые статьи:', error); }
        }
    }

    return { version: 2, sections, articles };
}

function loadData() {
    try {
        const saved = localStorage.getItem(STORAGE_KEY);
        if (saved) {
            const normalized = normalizeData(JSON.parse(saved));
            localStorage.setItem(STORAGE_KEY, JSON.stringify(normalized));
            return normalized;
        }
    } catch (error) {
        console.error('Не удалось загрузить базу знаний:', error);
    }
    const legacyOnly = localStorage.getItem(LEGACY_KEY);
    if (legacyOnly) {
        const migrated = normalizeData({ sections: clone(DEFAULT_DATA.sections) });
        localStorage.setItem(STORAGE_KEY, JSON.stringify(migrated));
        return migrated;
    }
    const data = clone(DEFAULT_DATA);
    localStorage.setItem(STORAGE_KEY, JSON.stringify(data));
    return data;
}

let data = loadData();
const mainContent = document.getElementById('mainContent');
const root = document.documentElement;
const themeToggle = document.getElementById('themeToggle');
const themeIcon = document.getElementById('themeIcon');

function saveData() { localStorage.setItem(STORAGE_KEY, JSON.stringify(data)); }

function escapeHTML(value) {
    return String(value ?? '').replace(/[&<>"']/g, char => ({
        '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#039;'
    })[char]);
}

function showToast(message) {
    const toast = document.getElementById('toast');
    toast.textContent = message;
    toast.classList.add('visible');
    clearTimeout(showToast.timer);
    showToast.timer = setTimeout(() => toast.classList.remove('visible'), 2200);
}

function getSection(id) { return data.sections.find(item => item.id === id); }
function getArticles(sectionId) {
    return data.articles.filter(item => item.sectionId === sectionId && item.status === 'published');
}
function getPath(article) { return getSection(article.sectionId)?.title || 'Без темы'; }

/* THEME */
let theme = localStorage.getItem('trop-theme') || 'dark';

function setTheme(value) {
    theme = value;
    root.dataset.theme = value;
    root.style.colorScheme = value;
    localStorage.setItem('trop-theme', value);
    document.querySelector('meta[name="theme-color"]').content = value === 'dark' ? '#0a0a0a' : '#f4f4f4';
    themeIcon.innerHTML = value === 'dark'
        ? '<circle cx="12" cy="12" r="4" stroke="currentColor" stroke-width="1.7"/><path d="M12 2V4M12 20V22M4.93 4.93L6.34 6.34M17.66 17.66L19.07 19.07M2 12H4M20 12H22M4.93 19.07L6.34 17.66M17.66 6.34L19.07 4.93" stroke="currentColor" stroke-width="1.7" stroke-linecap="round"/>'
        : '<path d="M20.5 15.5A8.5 8.5 0 0 1 8.5 3.5 8.5 8.5 0 1 0 20.5 15.5Z" stroke="currentColor" stroke-width="1.7" stroke-linejoin="round"/>';
}

setTheme(theme);

themeToggle.addEventListener('click', () => {
    const next = theme === 'dark' ? 'light' : 'dark';
    const rect = themeToggle.getBoundingClientRect();
    const x = rect.left + rect.width / 2;
    const y = rect.top + rect.height / 2;
    const radius = Math.hypot(Math.max(x, innerWidth - x), Math.max(y, innerHeight - y));

    root.style.setProperty('--theme-x', x + 'px');
    root.style.setProperty('--theme-y', y + 'px');
    root.style.setProperty('--theme-radius', radius + 'px');

    if (document.startViewTransition && !matchMedia('(prefers-reduced-motion: reduce)').matches) {
        document.startViewTransition(() => setTheme(next));
    } else {
        setTheme(next);
    }
});

/* HELPERS */
function renderBreadcrumbs(items = []) {
    return '<div class="breadcrumbs"><button class="breadcrumb-button" data-home>База знаний</button>' +
        items.map((item, index) => '<span class="breadcrumb-separator">/</span>' +
            (index === items.length - 1 ? '<span class="breadcrumb-current">' + escapeHTML(item) + '</span>' :
                '<button class="breadcrumb-button" data-home>' + escapeHTML(item) + '</button>')).join('') + '</div>';
}

function articleButton(article) {
    return '<button class="article-link" data-article="' + escapeHTML(article.id) + '">' +
        '<span class="article-link-copy"><strong>' + escapeHTML(article.title) + '</strong><small>' + escapeHTML(article.summary || getPath(article)) + '</small></span></button>';
}

/* DIRECTORY */
function renderDirectoryContent() {
    const topics = data.sections.map(section => {
        const image = section.image
            ? '<img class="topic-card-image" src="' + escapeHTML(section.image) + '" alt="" aria-hidden="true" style="' +
                '--image-x:' + (Number(section.imageX) || 0) + 'px;' +
                '--image-y:' + (Number(section.imageY) || 0) + 'px;' +
                '--image-size:' + (Number(section.imageSize) || 60) + '%;' +
                '--image-rotation:' + (Number(section.imageRotation) || 0) + 'deg;' +
                '--image-hover-x:' + (Number(section.imageHoverX ?? section.imageX) || 0) + 'px;' +
                '--image-hover-y:' + (Number(section.imageHoverY ?? section.imageY) || 0) + 'px;' +
                '--image-hover-rotation:' + (Number(section.imageHoverRotation ?? section.imageRotation) || 0) + 'deg;' +
                '--image-hover-scale:' + ((Number(section.imageHoverSize ?? section.imageSize) || Number(section.imageSize) || 60) / (Number(section.imageSize) || 60)).toFixed(3) + ';">'
            : '';
        return '<button class="topic-card' + (section.image ? ' has-image' : '') + '" data-topic="' + escapeHTML(section.id) + '">' +
            image +
            '<span class="topic-card-copy"><strong>' + escapeHTML(section.title) + '</strong>' +
            '<span>' + escapeHTML(section.description || 'Инструкции и ответы на вопросы.') + '</span></span></button>';
    }).join('');

    mainContent.innerHTML =
        '<section class="directory-intro"><h1>С чем помочь?</h1>' +
        '<p>Выбери тему - быстро найдём нужный ответ.</p></section>' +
        '<section class="home-section topics-section"><div class="section-heading"><h2>Выбери тему</h2></div>' +
        (topics ? '<div class="topic-grid">' + topics + '</div>' : '<div class="empty-state">Темы пока не добавлены.</div>') + '</section>';

    mainContent.querySelectorAll('[data-topic]').forEach(button => button.addEventListener('click', () => renderTopic(button.dataset.topic)));
}

function renderTopicContent(id) {
    const section = getSection(id);
    if (!section) return;
    const articles = getArticles(id);
    mainContent.innerHTML = renderBreadcrumbs([section.title]) +
        '<div class="content-heading"><div><h1>' + escapeHTML(section.title) + '</h1><p>' + escapeHTML(section.description || 'Статьи и инструкции по этой теме.') + '</p></div></div>' +
        '<div class="article-link-list">' + (articles.length ? articles.map(article => articleButton(article)).join('') : '<div class="empty-state">В этой теме пока нет опубликованных статей.</div>') + '</div>';
    mainContent.querySelectorAll('[data-home]').forEach(button => button.addEventListener('click', renderDirectory));
    bindArticleButtons();
}

function bindArticleButtons(container = mainContent) {
    container.querySelectorAll('[data-article]').forEach(button => button.addEventListener('click', () => {
        renderArticle(button.dataset.article);
    }));
}

/* ARTICLE VIEW */
function inlineFormat(value) {
    let result = escapeHTML(value);
    result = result.replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>');
    result = result.replace(/\x60([^\x60]+)\x60/g, '<code>$1</code>');
    result = result.replace(/\[([^\]]+)\]\((https?:\/\/[^\s)]+)\)/g, '<a href="$2" target="_blank" rel="noopener">$1 ↗</a>');
    return result;
}

function renderMarkdown(source) {
    const lines = String(source || '').split('\n'), html = [], headings = [];
    let listOpen = false, count = 0;
    const closeList = () => { if (listOpen) { html.push('</ul>'); listOpen = false; } };
    lines.forEach(line => {
        const value = line.trim();
        if (!value) { closeList(); return; }
        const note = value.match(/^<div class="article-note"><strong>(.*?)<\/strong><br>(.*?)<\/div>$/);
        if (note) {
            closeList();
            html.push('<aside class="article-note"><strong>' + escapeHTML(note[1]) + '</strong><p>' + inlineFormat(note[2]) + '</p></aside>');
        } else if (value.startsWith('### ') || value.startsWith('## ')) {
            closeList();
            const level = value.startsWith('### ') ? 3 : 2;
            const title = value.slice(level + 1), anchor = 'heading-' + (++count);
            headings.push({ id: anchor, title });
            html.push('<h' + level + ' id="' + anchor + '">' + inlineFormat(title) + '</h' + level + '>');
        } else if (value.startsWith('- ')) {
            if (!listOpen) { html.push('<ul>'); listOpen = true; }
            html.push('<li>' + inlineFormat(value.slice(2)) + '</li>');
        } else if (value.startsWith('> ')) {
            closeList();
            html.push('<blockquote class="article-quote">' + inlineFormat(value.slice(2)) + '</blockquote>');
        } else {
            closeList();
            html.push('<p>' + inlineFormat(value) + '</p>');
        }
    });
    closeList();
    return { html: html.join(''), headings };
}

function renderArticleContent(id) {
    const article = data.articles.find(item => item.id === id && item.status === 'published');
    if (!article) return;
    const rendered = renderMarkdown(article.content);

    mainContent.innerHTML = renderBreadcrumbs([getPath(article), article.title]) +
        '<div class="reading-layout"><article class="reading-article">' +
        '<h1>' + escapeHTML(article.title) + '</h1><p class="article-lead">' + escapeHTML(article.summary || '') + '</p>' +
        '<div class="article-rule"></div><div class="article-body">' + rendered.html + '</div></article></div>';

    mainContent.querySelectorAll('[data-home]').forEach(button => button.addEventListener('click', renderDirectory));
}

function transitionPage(update) {
    if (matchMedia('(prefers-reduced-motion: reduce)').matches) {
        mainContent.classList.remove('page-enter');
        update();
        return;
    }

    mainContent.classList.remove('page-enter');
    update();
    void mainContent.offsetWidth;
    mainContent.classList.add('page-enter');
}

function renderDirectory() {
    transitionPage(renderDirectoryContent);
}

function renderTopic(id) {
    transitionPage(() => renderTopicContent(id));
}

function renderArticle(id) {
    transitionPage(() => renderArticleContent(id));
}

async function initializeWiki() {
    try {
        const response = await fetch('api.php', { cache: 'no-store' });
        const result = await response.json();
        if (response.ok && result.ok && result.initialized && result.data) {
            data = normalizeData(result.data);
            localStorage.setItem(STORAGE_KEY, JSON.stringify(data));
        }
    } catch (error) {
        console.warn('Серверная база знаний недоступна, используется локальная копия:', error);
    }
    renderDirectoryContent();
}

initializeWiki();
