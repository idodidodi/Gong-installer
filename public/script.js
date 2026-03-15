const terminal = document.getElementById('terminal');
const statusBadge = document.getElementById('status');
const modal = document.getElementById('install-modal');
const globalPathInput = document.getElementById('global-path');
const devPathInput = document.getElementById('dev-path');

let pendingParams = null;

const ws = new WebSocket(`ws://${window.location.host}`);

function log(data, type = 'log') {
    const line = document.createElement('div');
    line.className = `log-line${type === 'error' ? ' log-error' : type === 'info' ? ' log-info' : ''}`;
    // Split by lines to ensure each line gets its own div for better scrolling/readability
    const lines = data.split('\n');
    lines.forEach(text => {
        if (text.trim() || text === '') {
            const div = document.createElement('div');
            div.textContent = text;
            line.appendChild(div);
        }
    });

    if (!line.hasChildNodes()) {
        line.textContent = data;
    }

    terminal.appendChild(line);
    terminal.scrollTop = terminal.scrollHeight;
}

ws.onmessage = (event) => {
    const payload = JSON.parse(event.data);
    if (payload.type === 'log') log(payload.data);
    if (payload.type === 'error') log(payload.data, 'error');
    if (payload.type === 'config') {
        globalPathInput.value = payload.data.projectPath || '~/gong';
        devPathInput.value = payload.data.devPath || '~/projects';
        updateDevPathsUI(devPathInput.value);
    }
    if (payload.type === 'dirs') {
        renderDirs(payload.path, payload.items);
    }
    if (payload.type === 'validation-pass') {
        log('Validation successful! Proceeding with installation...', 'info');
        if (pendingParams) {
            sendAction('install', pendingParams);
            pendingParams = null;
        }
    }
    if (payload.type === 'validation-fail') {
        log(`Validation failed: ${payload.data}`, 'error');
        statusBadge.textContent = 'Error';
        statusBadge.className = 'status-badge status-error';
        pendingParams = null;
    }
    if (payload.type === 'exit') {
        log(`--- Process exited with code ${payload.code} ---`, 'info');
        statusBadge.textContent = 'Ready';
        statusBadge.className = 'status-badge';
    }
};

function sendAction(action, params = {}) {
    statusBadge.textContent = 'Running...';
    statusBadge.className = 'status-badge status-running';
    terminal.innerHTML = '';

    const user = document.getElementById('global-user').value;
    const pass = document.getElementById('global-pass').value;
    const projectPath = globalPathInput.value;
    const devPath = devPathInput.value;

    const finalParams = { user, pass, projectPath, devPath, ...params };

    log(`Starting action: ${action}...`, 'info');
    ws.send(JSON.stringify({ action, params: finalParams }));
}

function updateGlobalConfig() {
    const projectPath = globalPathInput.value;
    const devPath = devPathInput.value;
    ws.send(JSON.stringify({ action: 'update-config', params: { projectPath, devPath } }));
    updateDevPathsUI(devPath);
}

function updateDevPathsUI(path) {
    const ftdiDestPathSpan = document.getElementById('ftdi-dest-path');
    if (ftdiDestPathSpan) {
        ftdiDestPathSpan.innerHTML = `${path}/gong_server/node_modules/ftdi-d2xx<br/>${path}/Gong-be/node_modules/ftdi-d2xx`;
    }
}

globalPathInput.onchange = updateGlobalConfig;
devPathInput.onchange = updateGlobalConfig;

function openBrowser(target = 'global') {
    const currentPath = target === 'global' ? globalPathInput.value : devPathInput.value;
    ws.send(JSON.stringify({ action: 'open-system-browser', params: { path: currentPath || '', target } }));
}

document.getElementById('btn-browse').onclick = () => openBrowser('global');
document.getElementById('btn-browse-dev').onclick = () => openBrowser('dev');

document.getElementById('btn-extra-clean').onclick = () => sendAction('extra-clean');
document.getElementById('btn-clean').onclick = () => sendAction('clean');
document.getElementById('btn-pm2').onclick = () => sendAction('pm2-setup');

document.getElementById('btn-copy-ftdi').onclick = () => sendAction('copy-ftdi', { devPath: devPathInput.value });

document.getElementById('btn-pm2-list').onclick = () => sendAction('pm2-list');
document.getElementById('btn-pm2-stop-all').onclick = () => sendAction('pm2-stop-all');
document.getElementById('btn-pm2-delete-all').onclick = () => sendAction('pm2-delete-all');

document.getElementById('btn-pm2-logs').onclick = () => {
    sendAction('pm2-logs', { id: 'all' });
};

const customSetupCheckbox = document.getElementById('custom-setup');

function runInstallationWithParams(params) {
    pendingParams = params;
    statusBadge.textContent = 'Validating...';
    statusBadge.className = 'status-badge status-running';
    terminal.innerHTML = '';
    log('Validating repository and branch links...', 'info');

    ws.send(JSON.stringify({
        action: 'validate-links',
        params: { branch: pendingParams.branch, repo: pendingParams.repo }
    }));
}

document.getElementById('btn-install').onclick = () => {
    if (customSetupCheckbox.checked) {
        modal.style.display = 'flex';
    } else {
        runInstallationWithParams({
            is_dev: 'false',
            branch: '',
            repo: ''
        });
    }
};

document.getElementById('cancel-install').onclick = () => {
    modal.style.display = 'none';
};

document.getElementById('confirm-install').onclick = () => {
    const params = {
        is_dev: document.getElementById('param-isdev').value,
        branch: document.getElementById('param-branch').value,
        repo: document.getElementById('param-repo').value
    };
    modal.style.display = 'none';
    runInstallationWithParams(params);
};

// Tab Switching Logic
function switchTab(tabId) {
    document.querySelectorAll('.tab-content').forEach(tab => tab.style.display = 'none');
    document.querySelectorAll('.tab-btn').forEach(btn => {
        btn.classList.remove('active');
        btn.style.background = 'none';
        btn.style.color = 'var(--text-primary)';
    });

    document.getElementById(`tab-${tabId}`).style.display = 'block';
    const activeBtn = Array.from(document.querySelectorAll('.tab-btn')).find(b => b.textContent.toLowerCase().includes(tabId) || b.textContent.toLowerCase().includes(tabId === 'dev' ? 'dev tools' : tabId));
    if (activeBtn) {
        activeBtn.classList.add('active');
        activeBtn.style.background = 'var(--accent-color)';
        activeBtn.style.color = 'white';
    }
}
