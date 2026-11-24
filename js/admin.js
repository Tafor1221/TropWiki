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
        id: 'connect', sectionId: 'connection', title: 'Как подключить TropVPN',
        summary: 'Получение ссылки подписки, добавление в HAPP и первое подключение.',
        tags: ['HAPP', 'подключение', 'настройка'], featured: true,
        content: 'Перед началом\n\nДля подключения понадобится активная подписка TropVPN и приложение HAPP на твоём устройстве.\n\n## 01. Получи доступ\n\nОткрой Telegram-бота @TropVPNbot и оформи подписку. После оформления бот предоставит ссылку для подключения.\n\n## 02. Добавь подписку\n\nОткрой HAPP и выбери добавление конфигурации по ссылке. Вставь ссылку, полученную в боте, и подтверди импорт.\n\n## 03. Подключись\n\nПосле добавления конфигурация появится в приложении. Выбери её и нажми кнопку подключения. При первом запуске устройство может запросить разрешение на создание VPN-подключения.\n\n## Если не получается\n\n- Проверь, что подписка активна.\n- Убедись, что ссылка скопирована полностью.\n- Проверь подключение к интернету.\n- Попробуй обновить подписку в HAPP.\n\n> Если проблема не решилась, напиши в поддержку TropVPN через Telegram-бота.',
        status: 'published', updatedAt: '24 ноября 2026', createdAt: '24 ноября 2026'
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
            ? article.sectionId : (subsection?.sectionId || sections[0]?.id);
        return {
            ...article,
            id: article.id || 'migrated-' + index,
            sectionId: sections.some(item => item.id === sectionId) ? sectionId : sections[0]?.id,
            tags: Array.isArray(article.tags) ? article.tags : [],
            status: article.status || 'published'
        };
    }) : [];

    if (!Array.isArray(raw?.articles)) {
        try {
            const legacy = JSON.parse(localStorage.getItem(LEGACY_KEY) || 'null');
            if (Array.isArray(legacy)) legacy.forEach((article, index) => articles.push({
                ...article,
                id: article.id || 'legacy-' + index,
                sectionId: sections.find(section => section.title === article.category)?.id || sections[0]?.id,
                tags: [],
                status: article.status || 'published'
            }));
        } catch (error) { console.warn('Не удалось импортировать старые статьи:', error); }
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
    } catch (error) { console.error('Не удалось загрузить wiki:', error); }
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
const root = document.documentElement;
const themeToggle = document.getElementById('themeToggle');
const themeIcon = document.getElementById('themeIcon');
const navigation = document.getElementById('navigation');
const navSlider = document.getElementById('navSlider');
const navLinks = Array.from(document.querySelectorAll('[data-admin-tab]'));
const dialog = document.getElementById('topicDialog');
const pages = {
    overview: document.getElementById('overviewPage'),
    topics: document.getElementById('topicsPage'),
    articles: document.getElementById('articlesPage'),
    editor: document.getElementById('editorPage')
};

function saveData() {
    try { localStorage.setItem(STORAGE_KEY, JSON.stringify(data)); }
    catch (error) { console.error('Ошибка сохранения wiki:', error); showToast('Не удалось сохранить данные'); }
}

function escapeHTML(value) {
    return String(value ?? '').replace(/[&<>"']/g, char => ({
        '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#039;'
    })[char]);
}

function makeId(prefix) {
    return prefix + '-' + (crypto.randomUUID ? crypto.randomUUID() : Date.now() + '-' + Math.random().toString(16).slice(2));
}
function formatDate() {
    return new Intl.DateTimeFormat('ru-RU', { day: 'numeric', month: 'long', year: 'numeric' }).format(new Date());
}
function showToast(message) {
    const toast = document.getElementById('toast');
    toast.textContent = message;
    toast.classList.add('visible');
    clearTimeout(showToast.timer);
    showToast.timer = setTimeout(() => toast.classList.remove('visible'), 2200);
}
function plural(number, one, few, many) {
    const n = Math.abs(number) % 100, last = n % 10;
    if (n > 10 && n < 20) return many;
    if (last > 1 && last < 5) return few;
    return last === 1 ? one : many;
}
function getTopic(id) { return data.sections.find(item => item.id === id); }
function getArticles(topicId) { return data.articles.filter(item => item.sectionId === topicId); }
function articlePath(article) { return getTopic(article.sectionId)?.title || 'Без темы'; }

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

/* NAVIGATION */
function moveSlider(link) {
    if (!link) return;
    const a = link.getBoundingClientRect(), b = navigation.getBoundingClientRect();
    navSlider.style.width = a.width + 'px';
    navSlider.style.transform = 'translateX(' + (a.left - b.left - 5) + 'px)';
}
function switchTab(name) {
    Object.entries(pages).forEach(([key, page]) => page.classList.toggle('active', key === name));
    const active = name === 'editor' ? 'articles' : name;
    navLinks.forEach(link => link.classList.toggle('active', link.dataset.adminTab === active));
    moveSlider(navLinks.find(link => link.dataset.adminTab === active));
    window.scrollTo({ top: 0, behavior: 'smooth' });
}
navLinks.forEach(link => link.addEventListener('click', () => switchTab(link.dataset.adminTab)));
document.querySelectorAll('[data-open-tab]').forEach(button => button.addEventListener('click', () => switchTab(button.dataset.openTab)));
requestAnimationFrame(() => moveSlider(navLinks[0]));
window.addEventListener('resize', () => moveSlider(navLinks.find(link => link.classList.contains('active'))));

/* OVERVIEW */
function renderDashboard() {
    document.getElementById('statTopics').textContent = data.sections.length;
    document.getElementById('statArticles').textContent = data.articles.length;
    document.getElementById('statPublished').textContent = data.articles.filter(item => item.status === 'published').length;
    document.getElementById('statDrafts').textContent = data.articles.filter(item => item.status === 'draft').length;
    const recent = [...data.articles].sort((a, b) => String(b.updatedAt || '').localeCompare(String(a.updatedAt || ''))).slice(0, 5);
    document.getElementById('recentArticles').innerHTML = recent.length
        ? recent.map(article => '<div class="recent-row"><div><strong>' + escapeHTML(article.title) + '</strong><small>' + escapeHTML(articlePath(article)) + '</small></div><span class="status-badge ' + (article.status === 'draft' ? 'draft' : '') + '">' + (article.status === 'draft' ? 'Черновик' : 'Опубликована') + '</span></div>').join('')
        : '<div class="list-empty">Статей пока нет.</div>';
}

/* TOPICS */
function renderTopics() {
    const container = document.getElementById('topicList');
    container.innerHTML = data.sections.length ? data.sections.map((topic, index) => {
        const count = getArticles(topic.id).length;
        return '<section class="topic-admin-card"><div class="topic-admin-number">' + String(index + 1).padStart(2, '0') + '</div>' +
            '<div class="topic-admin-copy"><h3>' + escapeHTML(topic.title) + '</h3><p>' + escapeHTML(topic.description || 'Без описания') + '</p><small>' + count + ' ' + plural(count, 'статья', 'статьи', 'статей') + '</small></div>' +
            '<div class="topic-admin-actions"><button class="icon-button" data-edit-topic="' + escapeHTML(topic.id) + '" title="Изменить">↗</button><button class="icon-button danger" data-delete-topic="' + escapeHTML(topic.id) + '" title="Удалить">×</button></div></section>';
    }).join('') : '<div class="empty-state">Тем пока нет. Создай первую тему.</div>';

    container.querySelectorAll('[data-edit-topic]').forEach(button => button.addEventListener('click', () => openTopic(getTopic(button.dataset.editTopic))));
    container.querySelectorAll('[data-delete-topic]').forEach(button => button.addEventListener('click', () => deleteTopic(button.dataset.deleteTopic)));
}

const topicForm = document.getElementById('topicForm');
const topicId = document.getElementById('topicId');
const topicName = document.getElementById('topicName');
const topicDescription = document.getElementById('topicDescription');

function openTopic(topic = null) {
    topicForm.reset();
    topicId.value = topic?.id || '';
    topicName.value = topic?.title || '';
    topicDescription.value = topic?.description || '';
    document.getElementById('topicDialogTitle').textContent = topic ? 'Изменить тему' : 'Новая тема';
    dialog.showModal();
    topicName.focus();
}
function closeTopic() { dialog.close(); }

document.getElementById('addTopic').addEventListener('click', () => openTopic());
document.getElementById('closeTopic').addEventListener('click', closeTopic);
document.getElementById('cancelTopic').addEventListener('click', closeTopic);

topicForm.addEventListener('submit', event => {
    event.preventDefault();
    const title = topicName.value.trim();
    const description = topicDescription.value.trim();
    if (!title) return;
    const existing = getTopic(topicId.value);
    if (existing) { existing.title = title; existing.description = description; }
    else data.sections.push({ id: makeId('topic'), title, description });
    saveData();
    closeTopic();
    refreshAll();
    showToast(existing ? 'Тема обновлена' : 'Тема создана');
});

function deleteTopic(id) {
    const topic = getTopic(id);
    if (!topic) return;
    const count = getArticles(id).length;
    if (count) {
        showToast('Сначала перенеси или удали статьи этой темы');
        return;
    }
    if (!confirm('Удалить тему «' + topic.title + '»?')) return;
    data.sections = data.sections.filter(item => item.id !== id);
    saveData();
    refreshAll();
    showToast('Тема удалена');
}

/* ARTICLE LIST */
function renderArticles(query = '') {
    const q = query.toLowerCase();
    const filtered = data.articles.filter(article =>
        [article.title, article.summary, article.content, articlePath(article), ...(article.tags || [])].join(' ').toLowerCase().includes(q)
    );
    document.getElementById('articleCount').textContent = filtered.length + ' ' + plural(filtered.length, 'статья', 'статьи', 'статей');
    const container = document.getElementById('articleList');
    container.innerHTML = filtered.length ? filtered.map(article =>
        '<div class="article-admin-row"><div class="article-admin-info"><strong>' + escapeHTML(article.title) + '</strong><small>' + escapeHTML(articlePath(article)) + ' · ' + escapeHTML(article.updatedAt || 'Без даты') + '</small></div>' +
        '<span class="status-badge ' + (article.status === 'draft' ? 'draft' : '') + '">' + (article.status === 'draft' ? 'Черновик' : 'Опубликована') + '</span>' +
        '<div class="article-admin-actions"><button class="icon-button" data-edit-article="' + escapeHTML(article.id) + '" title="Редактировать">↗</button><button class="icon-button danger" data-delete-article="' + escapeHTML(article.id) + '" title="Удалить">×</button></div></div>'
    ).join('') : '<div class="list-empty">По запросу ничего не найдено.</div>';

    container.querySelectorAll('[data-edit-article]').forEach(button => button.addEventListener('click', () => openEditor(data.articles.find(item => item.id === button.dataset.editArticle))));
    container.querySelectorAll('[data-delete-article]').forEach(button => button.addEventListener('click', () => deleteArticle(button.dataset.deleteArticle)));
}
function deleteArticle(id) {
    const article = data.articles.find(item => item.id === id);
    if (!article || !confirm('Удалить статью «' + article.title + '»?')) return;
    data.articles = data.articles.filter(item => item.id !== id);
    saveData();
    refreshAll();
    showToast('Статья удалена');
}

/* ARTICLE EDITOR */
const form = document.getElementById('articleForm');
const articleId = document.getElementById('articleId');
const articleTitle = document.getElementById('articleTitle');
const articleSummary = document.getElementById('articleSummary');
const articleTopic = document.getElementById('articleTopic');
const articleTags = document.getElementById('articleTags');
const articleContent = document.getElementById('articleContent');
const articleStatus = document.getElementById('articleStatus');

function populateTopicSelect(selectedId = '') {
    articleTopic.innerHTML = data.sections.map(topic => '<option value="' + escapeHTML(topic.id) + '">' + escapeHTML(topic.title) + '</option>').join('');
    if (selectedId) articleTopic.value = selectedId;
    updatePreview();
}
function openEditor(article = null) {
    form.reset();
    articleId.value = article?.id || '';
    articleTitle.value = article?.title || '';
    articleSummary.value = article?.summary || '';
    articleTags.value = (article?.tags || []).join(', ');
    articleContent.value = article?.content || '';
    articleStatus.value = article?.status || 'draft';
    populateTopicSelect(article?.sectionId || data.sections[0]?.id || '');
    document.getElementById('editorHeading').innerHTML = (article ? 'Редактировать статью' : 'Новая статья') + '<span class="accent-dot">.</span>';
    switchTab('editor');
    updatePreview();
}
function closeEditor() { switchTab('articles'); }

document.getElementById('addArticle').addEventListener('click', () => {
    if (!data.sections.length) {
        showToast('Сначала создай хотя бы одну тему');
        switchTab('topics');
        return;
    }
    openEditor();
});
document.getElementById('backToArticles').addEventListener('click', closeEditor);
document.getElementById('cancelEditor').addEventListener('click', closeEditor);

function updatePreview() {
    document.getElementById('previewPath').textContent = getTopic(articleTopic.value)?.title || 'Тема статьи';
    document.getElementById('previewTitle').textContent = articleTitle.value || 'Название статьи';
    document.getElementById('previewSummary').textContent = articleSummary.value || 'Краткое описание появится здесь.';
    document.getElementById('previewContent').textContent = articleContent.value.slice(0, 1000) || 'Содержание статьи появится здесь.';
}
[articleTitle, articleSummary, articleTags, articleContent].forEach(input => input.addEventListener('input', updatePreview));
articleTopic.addEventListener('change', updatePreview);

form.addEventListener('submit', event => {
    event.preventDefault();
    const title = articleTitle.value.trim();
    const summary = articleSummary.value.trim();
    const content = articleContent.value.trim();
    const sectionId = articleTopic.value;
    if (!title || !summary || !content || !sectionId) {
        showToast('Заполни поля и выбери тему');
        return;
    }
    const id = articleId.value || makeId('article');
    const existing = data.articles.find(item => item.id === id);
    const article = {
        id, title, summary, content, sectionId,
        tags: articleTags.value.split(',').map(tag => tag.trim()).filter(Boolean),
        status: articleStatus.value,
        createdAt: existing?.createdAt || formatDate(),
        updatedAt: formatDate()
    };
    if (existing) data.articles = data.articles.map(item => item.id === id ? article : item);
    else data.articles.unshift(article);
    saveData();
    refreshAll();
    switchTab('articles');
    showToast(existing ? 'Статья обновлена' : 'Статья создана');
});

/* SEARCH / REFRESH */
document.getElementById('articleSearch').addEventListener('input', event => renderArticles(event.target.value.trim()));
function refreshAll() {
    renderDashboard();
    renderTopics();
    renderArticles(document.getElementById('articleSearch').value || '');
}
refreshAll();
