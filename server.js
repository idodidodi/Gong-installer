const express = require('express');
const http = require('http');
const WebSocket = require('ws');
const { spawn, exec } = require('child_process');
const fs = require('fs');
const os = require('os');
const path = require('path');

const app = express();
const server = http.createServer(app);
const wss = new WebSocket.Server({ server });

app.use(express.json());
app.use(express.static(path.join(__dirname, 'public')));

// Path to the scripts
const SCRIPTS_DIR = path.join(__dirname, 'scripts');
const CONFIG_DIR = path.join(os.homedir(), '.config', 'gong-installer');
const CONFIG_FILE = path.join(CONFIG_DIR, 'config.json');

function maskObject(obj) {
    if (!obj) return obj;
    const masked = JSON.parse(JSON.stringify(obj));
    const mask = (o) => {
        for (let key in o) {
            if (key.toLowerCase().includes('pass') || key.toLowerCase().includes('password')) {
                o[key] = '*****';
            } else if (typeof o[key] === 'object' && o[key] !== null) {
                mask(o[key]);
            }
        }
    };
    mask(masked);
    return masked;
}

function loadConfig() {
    const defaultConfig = { projectPath: path.join(os.homedir(), 'gong'), devPath: path.join(os.homedir(), 'projects') };
    try {
        if (fs.existsSync(CONFIG_FILE)) {
            return { ...defaultConfig, ...JSON.parse(fs.readFileSync(CONFIG_FILE, 'utf8')) };
        }
    } catch (e) {
        console.error('Error loading config:', e);
    }
    return defaultConfig;
}

function saveConfig(config) {
    try {
        if (!fs.existsSync(CONFIG_DIR)) {
            fs.mkdirSync(CONFIG_DIR, { recursive: true });
        }
        // Merge with existing config instead of full overwrite to preserve keys
        const existing = loadConfig();
        const merged = { ...existing, ...config };
        fs.writeFileSync(CONFIG_FILE, JSON.stringify(merged, null, 2));
    } catch (e) {
        console.error('Error saving config:', e);
    }
}

function runCommand(command, args, ws, passwordToMask = null) {
    const child = spawn(command, args, { shell: true, env: { ...process.env, TERM: 'xterm-256color' } });

    const maskData = (data) => {
        let str = data.toString();
        if (passwordToMask && passwordToMask.length > 0) {
            // Escape special regex characters in password
            const escapedPw = passwordToMask.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
            const regex = new RegExp(escapedPw, 'g');
            str = str.replace(regex, '*****');
        }
        return str;
    };

    child.stdout.on('data', (data) => {
        ws.send(JSON.stringify({ type: 'log', data: maskData(data) }));
    });

    child.stderr.on('data', (data) => {
        ws.send(JSON.stringify({ type: 'error', data: maskData(data) }));
    });

    child.on('close', (code) => {
        ws.send(JSON.stringify({ type: 'exit', code }));
    });

    return child;
}

wss.on('connection', (ws) => {
    console.log('Client connected');

    // Send initial config
    ws.send(JSON.stringify({ type: 'config', data: loadConfig() }));

    ws.on('message', (message) => {
        const payload = JSON.parse(message);

        // Mask password in server log
        console.log('Received:', maskObject(payload));

        const pass = (payload.params && payload.params.pass) || null;

        if (payload.action === 'update-config') {
            saveConfig(payload.params);
            ws.send(JSON.stringify({ type: 'config', data: loadConfig() }));
            console.log('Config updated:', maskObject(payload.params));
        } else if (payload.action === 'open-system-browser') {
            const startPath = (payload.params.path || os.homedir()).replace('~', os.homedir());
            const target = payload.params.target || 'global';
            const cmd = `zenity --file-selection --directory --title="Select Folder" --filename="${startPath}/"`;
            exec(cmd, (error, stdout, stderr) => {
                if (error) {
                    if (error.code !== 1) { // 1 is usually "Cancel"
                        ws.send(JSON.stringify({ type: 'error', data: `System browser error: ${stderr || error.message}` }));
                    }
                    return;
                }
                const selectedPath = stdout.trim();
                if (selectedPath) {
                    const existingConfig = loadConfig();
                    let newConfig = { ...existingConfig };

                    if (target === 'dev') {
                        newConfig.devPath = selectedPath;
                    } else {
                        newConfig.projectPath = selectedPath;
                    }

                    saveConfig(newConfig);
                    ws.send(JSON.stringify({ type: 'config', data: newConfig }));
                }
            });
        } else if (payload.action === 'list-dirs') {
            let targetPath = payload.params.path || os.homedir();
            // Simple tilde expansion
            if (targetPath.startsWith('~')) {
                targetPath = targetPath.replace('~', os.homedir());
            }
            try {
                const items = fs.readdirSync(targetPath, { withFileTypes: true })
                    .filter(dirent => dirent.isDirectory() && !dirent.name.startsWith('.'))
                    .map(dirent => dirent.name);
                ws.send(JSON.stringify({ type: 'dirs', path: targetPath, items }));
            } catch (e) {
                ws.send(JSON.stringify({ type: 'error', data: `Error listing directory: ${e.message}` }));
            }
        } else if (payload.action === 'extra-clean') {
            runCommand(`bash "${path.join(SCRIPTS_DIR, 'extra-clean.sh')}" "${payload.params.pass}" "${payload.params.projectPath}"`, [], ws, pass);
        } else if (payload.action === 'clean') {
            runCommand(`bash "${path.join(SCRIPTS_DIR, 'clean.sh')}" "${payload.params.pass}" "${payload.params.projectPath}"`, [], ws, pass);
        } else if (payload.action === 'copy-ftdi') {
            runCommand(`bash "${path.join(SCRIPTS_DIR, 'copy-ftdi.sh')}" "${payload.params.devPath}"`, [], ws, pass);
        } else if (payload.action === 'install') {
            const { params } = payload;
            const cmd = `bash "${path.join(SCRIPTS_DIR, 'init.sh')}" "${params.user}" "${params.pass}" "${params.is_dev}" "${params.branch}" "${params.repo}" "${params.projectPath}"`;
            runCommand(`pm2 kill && ${cmd}`, [], ws, pass);
        } else if (payload.action === 'validate-links') {
            const { branch, repo } = payload.params;
            const beRepo = "https://github.com/DhammaPamoda/Gong-be.git";
            const feRepo = "https://github.com/DhammaPamoda/Gong_fe.git";

            const validate = (url, b) => {
                return new Promise((resolve) => {
                    const cmd = b ? `git ls-remote --heads "${url}" "${b}"` : `git ls-remote --quiet "${url}" HEAD`;
                    exec(cmd, (error, stdout) => {
                        if (error) {
                            resolve({ success: false, msg: `Repository unreachable: ${url}` });
                        } else if (b && !stdout.includes(`refs/heads/${b}`)) {
                            resolve({ success: false, msg: `Branch '${b}' not found in ${url}` });
                        } else {
                            resolve({ success: true });
                        }
                    });
                });
            };

            const runValidation = async () => {
                const beResult = await validate(beRepo, branch);
                if (!beResult.success) return ws.send(JSON.stringify({ type: 'validation-fail', data: beResult.msg }));

                const feResult = await validate(feRepo, repo);
                if (!feResult.success) return ws.send(JSON.stringify({ type: 'validation-fail', data: feResult.msg }));

                ws.send(JSON.stringify({ type: 'validation-pass' }));
            };
            runValidation();
        } else if (payload.action === 'pm2-setup') {
            const { params } = payload;
            const ecosystemPath = path.join(params.projectPath, 'gong_dev_ops', 'dev_ops', 'ecosystem.config.js');
            const cmd = `bash "${path.join(SCRIPTS_DIR, 'pm2-setup.sh')}" "${params.pass}" "${ecosystemPath}"`;
            runCommand(cmd, [], ws, pass);
        } else if (payload.action === 'pm2-list') {
            runCommand('pm2 list', [], ws, pass);
        } else if (payload.action === 'pm2-stop') {
            runCommand(`pm2 stop ${payload.params.id}`, [], ws, pass);
        } else if (payload.action === 'pm2-stop-all') {
            runCommand('pm2 stop all', [], ws, pass);
        } else if (payload.action === 'pm2-delete') {
            runCommand(`pm2 delete ${payload.params.id}`, [], ws, pass);
        } else if (payload.action === 'pm2-delete-all') {
            runCommand('pm2 delete all', [], ws, pass);
        } else if (payload.action === 'pm2-logs') {
            const id = payload.params.id || '';
            runCommand(`pm2 logs ${id} --lines 100 --nostream`, [], ws, pass);
        }
    });
});

const PORT = process.env.PORT || 3005;
server.listen(PORT, () => {
    console.log(`Server running on http://localhost:${PORT}`);
});
