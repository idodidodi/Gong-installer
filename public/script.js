const terminal = document.getElementById('terminal');
const statusBadge = document.getElementById('status');
const modal = document.getElementById('install-modal');
const globalPathInput = document.getElementById('global-path');

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

    // Fallback if data was just whitespace/empty but we still want a line
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
        globalPathInput.value = payload.data.projectPath;
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

    // Always include global credentials and path
    const user = document.getElementById('global-user').value;
    const pass = document.getElementById('global-pass').value;
    const projectPath = globalPathInput.value;

    const finalParams = { user, pass, projectPath, ...params };

    log(`Starting action: ${action}...`, 'info');
    ws.send(JSON.stringify({ action, params: finalParams }));
}

function updateGlobalConfig() {
    const projectPath = globalPathInput.value;
    ws.send(JSON.stringify({ action: 'update-config', params: { projectPath } }));
}

globalPathInput.onchange = updateGlobalConfig;

// Directory Browser Logic (Native System)
function openBrowser() {
    const currentPath = globalPathInput.value || '';
    ws.send(JSON.stringify({ action: 'open-system-browser', params: { path: currentPath } }));
}

document.getElementById('btn-browse').onclick = openBrowser;

document.getElementById('btn-extra-clean').onclick = () => sendAction('extra-clean');
document.getElementById('btn-clean').onclick = () => sendAction('clean');
document.getElementById('btn-pm2').onclick = () => sendAction('pm2-setup');

document.getElementById('btn-pm2-list').onclick = () => sendAction('pm2-list');
document.getElementById('btn-pm2-stop-all').onclick = () => sendAction('pm2-stop-all');
document.getElementById('btn-pm2-delete-all').onclick = () => sendAction('pm2-delete-all');

document.getElementById('btn-pm2-stop').onclick = () => {
    const id = document.getElementById('pm2-id').value;
    if (id) sendAction('pm2-stop', { id });
    else log('Please enter an App Name or ID', 'error');
};

document.getElementById('btn-pm2-delete').onclick = () => {
    const id = document.getElementById('pm2-id').value;
    if (id) sendAction('pm2-delete', { id });
    else log('Please enter an App Name or ID', 'error');
};

document.getElementById('btn-install').onclick = () => {
    modal.style.display = 'flex';
};

document.getElementById('cancel-install').onclick = () => {
    modal.style.display = 'none';
};

document.getElementById('confirm-install').onclick = () => {
    pendingParams = {
        is_dev: document.getElementById('param-isdev').value,
        branch: document.getElementById('param-branch').value,
        repo: document.getElementById('param-repo').value
    };
    modal.style.display = 'none';

    // Stage 1: Validate links
    statusBadge.textContent = 'Validating...';
    statusBadge.className = 'status-badge status-running';
    terminal.innerHTML = '';
    log('Validating repository and branch links...', 'info');

    ws.send(JSON.stringify({
        action: 'validate-links',
        params: { branch: pendingParams.branch, repo: pendingParams.repo }
    }));
};
