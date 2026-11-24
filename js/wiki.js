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
const navigation = document.getElementById('navigation');
const navSlider = document.getElementById('navSlider');
const navLinks = Array.from(document.querySelectorAll('.nav-link'));
const headerCenter = document.getElementById('headerCenter');
const searchToggle = document.getElementById('headerSearchToggle');
const searchInput = document.getElementById('headerSearchInput');
const searchResults = document.getElementById('headerSearchResults');
let searchTimer;

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

function moveNavSlider(link) {
    if (!link) return;
    const a = link.getBoundingClientRect();
    const b = navigation.getBoundingClientRect();
    navSlider.style.width = a.width + 'px';
    navSlider.style.transform = 'translateX(' + (a.left - b.left) + 'px)';
}

function setHeaderView(view) {
    const key = view === 'updates' ? 'updates' : 'wiki';
    navLinks.forEach(link => link.classList.toggle('active', link.dataset.view === key));
    moveNavSlider(navLinks.find(link => link.dataset.view === key));
}

function switchView(view) {
    closeHeaderSearch();
    if (view === 'updates') renderUpdates();
    else renderDirectory();
}

function openHeaderSearch() {
    headerCenter.classList.add('search-open');
    searchToggle.setAttribute('aria-expanded', 'true');
    window.setTimeout(() => searchInput.focus(), 170);
}

function closeHeaderSearch() {
    headerCenter.classList.remove('search-open');
    searchToggle.setAttribute('aria-expanded', 'false');
    searchInput.blur();
    searchInput.value = '';
    searchResults.innerHTML = '';
}

searchToggle.addEventListener('click', openHeaderSearch);
document.getElementById('headerSearchClose').addEventListener('click', closeHeaderSearch);
searchInput.addEventListener('input', () => {
    clearTimeout(searchTimer);
    searchTimer = setTimeout(() => renderSearchResults(searchInput.value), 100);
});
searchInput.addEventListener('keydown', event => {
    if (event.key === 'Escape') closeHeaderSearch();
});

document.addEventListener('click', event => {
    if (headerCenter.classList.contains('search-open') && !headerCenter.contains(event.target)) {
        closeHeaderSearch();
    }
});

navLinks.forEach(link => link.addEventListener('click', event => {
    event.preventDefault();
    switchView(link.dataset.view);
    history.replaceState(null, '', link.dataset.view === 'updates' ? '#updates' : '#wiki');
}));
requestAnimationFrame(() => setHeaderView(location.hash === '#updates' ? 'updates' : 'wiki'));
window.addEventListener('resize', () => moveNavSlider(navLinks.find(link => link.classList.contains('active'))));

/* THEME */
let theme = localStorage.getItem('trop-theme') || 'light';
function setTheme(value) {
    theme = value;
    root.dataset.theme = value;
    localStorage.setItem('trop-theme', value);
    document.querySelector('meta[name="theme-color"]').content = value === 'dark' ? '#12151b' : '#f4f5f7';
    themeIcon.innerHTML = value === 'dark'
        ? '<circle cx="12" cy="12" r="4" stroke="currentColor" stroke-width="1.7"/><path d="M12 2V4M12 20V22M4.93 4.93L6.34 6.34M17.66 17.66L19.07 19.07M2 12H4M20 12H22M4.93 19.07L6.34 17.66M17.66 6.34L19.07 4.93" stroke="currentColor" stroke-width="1.7" stroke-linecap="round"/>'
        : '<path d="M20.5 15.5A8.5 8.5 0 0 1 8.5 3.5 8.5 8.5 0 1 0 20.5 15.5Z" stroke="currentColor" stroke-width="1.7" stroke-linejoin="round"/>';
}
setTheme(theme);
themeToggle.addEventListener('click', () => setTheme(theme === 'light' ? 'dark' : 'light'));

/* HELPERS */
function plural(number, one, few, many) {
    const n = Math.abs(number) % 100, last = n % 10;
    if (n > 10 && n < 20) return many;
    if (last > 1 && last < 5) return few;
    return last === 1 ? one : many;
}

function renderBreadcrumbs(items = []) {
    return '<div class="breadcrumbs"><button class="breadcrumb-button" data-home>База знаний</button>' +
        items.map((item, index) => '<span class="breadcrumb-separator">/</span>' +
            (index === items.length - 1 ? '<span class="breadcrumb-current">' + escapeHTML(item) + '</span>' :
                '<button class="breadcrumb-button" data-home>' + escapeHTML(item) + '</button>')).join('') + '</div>';
}

function articleButton(article) {
    return '<button class="article-link" data-article="' + escapeHTML(article.id) + '">' +
        '<span class="article-link-copy"><strong>' + escapeHTML(article.title) + '</strong><small>' + escapeHTML(article.summary || getPath(article)) + '</small></span>' +
        '<span class="article-arrow">↗</span></button>';
}

/* DIRECTORY */
function renderDirectory() {
    setHeaderView('wiki');
    const topics = data.sections.map((section, index) => {
        const count = getArticles(section.id).length;
        return '<button class="topic-card" data-topic="' + escapeHTML(section.id) + '">' +
            '<span class="topic-card-top"><span class="topic-number">' + String(index + 1).padStart(2, '0') + '</span><span class="topic-arrow">↗</span></span>' +
            '<strong>' + escapeHTML(section.title) + '</strong>' +
            '<span>' + escapeHTML(section.description || 'Инструкции и ответы на вопросы.') + '</span>' +
            '<small>' + count + ' ' + plural(count, 'статья', 'статьи', 'статей') + '</small></button>';
    }).join('');

    mainContent.innerHTML =
        '<section class="directory-intro"><div class="eyebrow">TROVPN / HELP CENTER</div>' +
        '<h1>Чем можем <span>помочь?</span></h1><p>Выбери тему — мы подскажем, что делать дальше.</p></section>' +
        '<section class="home-section topics-section"><div class="section-heading"><h2>Все темы</h2><span>' + data.sections.length + ' КАТЕГОРИИ</span></div>' +
        (topics ? '<div class="topic-grid">' + topics + '</div>' : '<div class="empty-state">Темы пока не добавлены.</div>') + '</section>';

    mainContent.querySelectorAll('[data-topic]').forEach(button => button.addEventListener('click', () => renderTopic(button.dataset.topic)));
}

function renderSearchResults(query) {
    const box = searchResults;
    if (!box) return;
    const q = query.trim().toLowerCase();
    if (!q) { box.innerHTML = ''; return; }

    const matches = data.articles.filter(article => article.status === 'published' &&
        [article.title, article.summary, article.content, getPath(article), ...(article.tags || [])].join(' ').toLowerCase().includes(q));
    box.innerHTML = matches.length
        ? '<div class="search-results-label">НАЙДЕНО: ' + matches.length + '</div>' + matches.map(article =>
            '<button class="search-result" data-article="' + escapeHTML(article.id) + '"><strong>' + escapeHTML(article.title) + '</strong><small>' + escapeHTML(getPath(article)) + '</small></button>'
          ).join('')
        : '<div class="search-empty">Ничего не найдено. Попробуй изменить запрос.</div>';
    bindArticleButtons(box);
}

function renderTopic(id) {
    const section = getSection(id);
    if (!section) return;
    setHeaderView('wiki');
    const articles = getArticles(id);
    mainContent.innerHTML = renderBreadcrumbs([section.title]) +
        '<div class="content-heading"><div><div class="eyebrow">ТЕМА / TROVPN</div><h1>' + escapeHTML(section.title) + '</h1><p>' + escapeHTML(section.description || 'Статьи и инструкции по этой теме.') + '</p></div><button class="back-button" data-home>← Все темы</button></div>' +
        '<div class="article-link-list">' + (articles.length ? articles.map(article => articleButton(article)).join('') : '<div class="empty-state">В этой теме пока нет опубликованных статей.</div>') + '</div>';
    mainContent.querySelectorAll('[data-home]').forEach(button => button.addEventListener('click', renderDirectory));
    bindArticleButtons();
}

function bindArticleButtons(container = mainContent) {
    container.querySelectorAll('[data-article]').forEach(button => button.addEventListener('click', () => {
        closeHeaderSearch();
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
        if (value.startsWith('### ') || value.startsWith('## ')) {
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

function renderArticle(id) {
    const article = data.articles.find(item => item.id === id && item.status === 'published');
    if (!article) return;
    const rendered = renderMarkdown(article.content);
    const toc = rendered.headings.length
        ? '<aside class="article-toc"><div class="toc-heading">В ЭТОЙ СТАТЬЕ</div><nav>' +
            rendered.headings.map((item, index) => '<a class="toc-link' + (!index ? ' active' : '') + '" href="#' + item.id + '">' + escapeHTML(item.title) + '</a>').join('') +
          '</nav></aside>' : '';

    setHeaderView('wiki');
    mainContent.innerHTML = renderBreadcrumbs([getPath(article), article.title]) +
        '<div class="reading-layout"><article class="reading-article"><button class="back-link" data-topic-back="' + escapeHTML(article.sectionId) + '">← К теме</button>' +
        '<div class="article-meta"><span>' + escapeHTML(getPath(article)) + '</span><span>·</span><span>Обновлено ' + escapeHTML(article.updatedAt || 'недавно') + '</span></div>' +
        '<h1>' + escapeHTML(article.title) + '</h1><p class="article-lead">' + escapeHTML(article.summary || '') + '</p>' +
        '<div class="article-rule"></div><div class="article-body">' + rendered.html + '</div>' +
        '<div class="article-bottom"><span>Статья была полезной?</span><div class="feedback-buttons"><button class="feedback-button" data-feedback="yes">Да</button><button class="feedback-button" data-feedback="no">Нет</button></div></div></article>' + toc + '</div>';

    mainContent.querySelectorAll('[data-home]').forEach(button => button.addEventListener('click', renderDirectory));
    mainContent.querySelector('[data-topic-back]')?.addEventListener('click', event => renderTopic(event.currentTarget.dataset.topicBack));
    mainContent.querySelectorAll('.toc-link').forEach(link => link.addEventListener('click', event => {
        event.preventDefault();
        document.getElementById(decodeURIComponent(link.getAttribute('href').slice(1)))?.scrollIntoView({ behavior: 'smooth', block: 'start' });
        mainContent.querySelectorAll('.toc-link').forEach(item => item.classList.toggle('active', item === link));
    }));
    mainContent.querySelectorAll('[data-feedback]').forEach(button => button.addEventListener('click', () => showToast('Спасибо за отзыв!')));
}

/* UPDATES */
function renderUpdates() {
    setHeaderView('updates');
    mainContent.innerHTML = '<section class="updates-page"><div class="eyebrow">TROVPN / CHANGELOG</div><h1>Обновления<span class="accent-dot">.</span></h1><p>Новости и изменения сервиса.</p><div class="empty-state">Обновлений пока нет. Здесь будут появляться новости о новых возможностях и важных изменениях TropVPN.</div></section>';
}

/* SHORTCUT */
document.addEventListener('keydown', event => {
    if ((event.ctrlKey || event.metaKey) && event.key.toLowerCase() === 'k') {
        event.preventDefault();
        openHeaderSearch();
    }
});

if (location.hash === '#updates') renderUpdates();
else renderDirectory();
