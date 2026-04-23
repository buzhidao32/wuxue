const baseScriptUrl = document.currentScript?.src || new URL('js/base.js', window.location.href).href;
let forceRefreshModalInstance = null;
let forceRefreshRunning = false;

function toggleOptionMenu(event) {
    const menu = document.getElementById('optionMenu');
    if (!menu) {
        return;
    }

    if (menu.style.display === 'block') {
        menu.style.display = 'none';
        return;
    }

    const buttonRect = event.currentTarget.getBoundingClientRect();
    menu.style.visibility = 'hidden';
    menu.style.display = 'block';
    menu.style.left = `${Math.max(8, buttonRect.right + window.scrollX - menu.offsetWidth)}px`;
    menu.style.top = `${buttonRect.bottom + window.scrollY}px`;
    menu.style.visibility = '';
}

function removeForceRefreshCacheBust() {
    const url = new URL(window.location.href);
    if (!url.searchParams.has('_wuxue_refresh')) {
        return;
    }

    url.searchParams.delete('_wuxue_refresh');
    window.history.replaceState(null, document.title, `${url.pathname}${url.search}${url.hash}`);
}

function reloadWithCacheBust() {
    const url = new URL(window.location.href);
    url.searchParams.set('_wuxue_refresh', Date.now().toString());
    window.location.replace(url.toString());
}

function setForceRefreshStatus(message, type = 'muted') {
    const status = document.getElementById('forceRefreshStatus');
    if (!status) {
        return;
    }

    status.className = `small mt-3 text-${type}`;
    status.textContent = message;
}

function setForceRefreshPending(isPending) {
    const confirmBtn = document.getElementById('forceRefreshConfirmBtn');
    const cancelBtn = document.getElementById('forceRefreshCancelBtn');
    if (confirmBtn) {
        confirmBtn.disabled = isPending;
        confirmBtn.textContent = isPending ? '正在重新拉取...' : '清缓存并刷新';
    }
    if (cancelBtn) {
        cancelBtn.disabled = isPending;
    }
}

function ensureForceRefreshModal() {
    let modal = document.getElementById('forceRefreshModal');
    if (modal) {
        return modal;
    }

    document.body.insertAdjacentHTML('beforeend', `
        <div class="modal fade force-refresh-modal" id="forceRefreshModal" tabindex="-1" aria-labelledby="forceRefreshModalLabel" aria-hidden="true">
            <div class="modal-dialog modal-dialog-centered">
                <div class="modal-content">
                    <div class="modal-header">
                        <h5 class="modal-title" id="forceRefreshModalLabel">清缓存并刷新</h5>
                        <button type="button" class="btn-close" data-bs-dismiss="modal" aria-label="关闭"></button>
                    </div>
                    <div class="modal-body">
                        <p class="mb-2">将重新下载全部数据，成功后刷新当前页面</p>
                        <p class="mb-0 text-muted small">请耐心等待数据导入</p>
                        <div class="small mt-3 text-muted" id="forceRefreshStatus" aria-live="polite"></div>
                    </div>
                    <div class="modal-footer">
                        <button type="button" class="btn btn-secondary" id="forceRefreshCancelBtn" data-bs-dismiss="modal">取消</button>
                        <button type="button" class="btn btn-primary" id="forceRefreshConfirmBtn">清缓存并刷新</button>
                    </div>
                </div>
            </div>
        </div>
    `);

    modal = document.getElementById('forceRefreshModal');
    modal.addEventListener('hidden.bs.modal', () => {
        if (forceRefreshRunning) {
            return;
        }

        modal.classList.remove('top-modal');
        setForceRefreshStatus('');
        setForceRefreshPending(false);
    });

    const confirmBtn = document.getElementById('forceRefreshConfirmBtn');
    confirmBtn.addEventListener('click', handleForceRefreshConfirm);
    return modal;
}

function showForceRefreshModal() {
    const modal = ensureForceRefreshModal();
    if (!window.bootstrap?.Modal) {
        if (window.confirm('将重新下载全部数据，成功后刷新当前页面。继续吗？')) {
            handleForceRefreshConfirm();
        }
        return;
    }

    modal.classList.add('top-modal');
    setForceRefreshStatus('');
    setForceRefreshPending(false);
    forceRefreshModalInstance = forceRefreshModalInstance || new bootstrap.Modal(modal);
    forceRefreshModalInstance.show();
}

async function handleForceRefreshConfirm() {
    if (forceRefreshRunning) {
        return;
    }

    forceRefreshRunning = true;
    setForceRefreshPending(true);
    setForceRefreshStatus('正在下载最新数据，请稍候...', 'muted');

    try {
        const serviceUrl = new URL('services/forceRefreshService.js', baseScriptUrl).href;
        const { forceRefreshAllData } = await import(serviceUrl);
        const result = await forceRefreshAllData();
        setForceRefreshStatus(`已重新拉取 ${result.resourceIds.length} 份数据，正在刷新...`, 'success');
        window.setTimeout(reloadWithCacheBust, 500);
    } catch (error) {
        console.error('Force refresh failed:', error);
        forceRefreshRunning = false;
        setForceRefreshPending(false);
        setForceRefreshStatus(`重新拉取失败：${error.message || error}`, 'danger');
    }
}

function ensureForceRefreshMenuItem() {
    const menu = document.getElementById('optionMenu');
    if (!menu || document.getElementById('forceRefreshMenuBtn')) {
        return;
    }

    const divider = document.createElement('div');
    divider.className = 'option-menu-divider';

    const button = document.createElement('button');
    button.type = 'button';
    button.id = 'forceRefreshMenuBtn';
    button.className = 'option-menu-action';
    button.textContent = '清缓存并刷新';
    button.addEventListener('click', () => {
        menu.style.display = 'none';
        showForceRefreshModal();
    });

    menu.appendChild(divider);
    menu.appendChild(button);
}

document.addEventListener('DOMContentLoaded', () => {
    removeForceRefreshCacheBust();
    ensureForceRefreshMenuItem();

    const optionBtn = document.getElementById('optionBtn');
    if (!optionBtn) {
        return;
    }

    optionBtn.addEventListener('click', (event) => {
        toggleOptionMenu(event);
    });
});
