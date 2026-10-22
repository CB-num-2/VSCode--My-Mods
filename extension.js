// ============================================================================
// SELF-CONTAINED WEB RUNNER EXTENSION (extension.js)
// This code is completely web-safe and bypasses Node.js desktop limits.
// ============================================================================

const vscode = require('vscode');

function activate(context) {
    // Create the bottom status bar item
    const runButton = vscode.window.createStatusBarItem(vscode.StatusBarAlignment.Right, 100);
    runButton.command = 'extension.runWebIndexFile';
    runButton.text = '$(play) Run Index';
    runButton.tooltip = 'Click to find and execute index file in a side-by-side web panel';
    runButton.color = '#ffffff';
    runButton.show();

    context.subscriptions.push(runButton);

    // Register the execution command
    let disposable = vscode.commands.registerCommand('extension.runWebIndexFile', async () => {
        try {
            // Get the current open workspace folder
            const folders = vscode.workspace.workspaceFolders;
            if (!folders || folders.length === 0) {
                vscode.window.showErrorMessage('Please open a folder inside your workspace first!');
                return;
            }

            const rootUri = folders[0].uri;
            const targetFiles = [
                { name: 'index.html', type: 'html' },
                { name: 'index.js', type: 'js' },
                { name: 'index.py', type: 'py' }
            ];

            let foundFile = null;
            let fileContent = '';

            // Check for the index files sequentially using web-safe FileSystem APIs
            for (const target of targetFiles) {
                const fileUri = vscode.Uri.joinPath(rootUri, target.name);
                try {
                    await vscode.workspace.fs.stat(fileUri);
                    const rawData = await vscode.workspace.fs.readFile(fileUri);
                    fileContent = new TextDecoder('utf-8').decode(rawData);
                    foundFile = target;
                    break; 
                } catch (e) {
                    // File didn't exist, check the next one
                }
            }

            if (!foundFile) {
                vscode.window.showErrorMessage('No index.html, index.js, or index.py found in this folder.');
                return;
            }

            // Spawn an isolated side-by-side execution panel
            const panel = vscode.window.createWebviewPanel(
                'webRunner',
                `Execution: ${foundFile.name}`,
                vscode.ViewColumn.Two,
                { enableScripts: true }
            );

            // Handle rendering based on language type
            if (foundFile.type === 'html') {
                panel.webview.html = fileContent;
            } 
            else if (foundFile.type === 'js') {
                panel.webview.html = `
                    <html>
                    <body style="font-family: monospace; padding: 15px; background: #1e1e1e; color: #d4d4d4;">
                        <h3 style="color: #4fc1ff; margin-top: 0;">Console Output:</h3>
                        <pre id="console-log" style="white-space: pre-wrap; font-size: 13px; line-height: 1.5;"></pre>
                        <script>
                            const outputElement = document.getElementById('console-log');
                            console.log = (...args) => {
                                outputElement.textContent += args.join(' ') + '\\n';
                            };
                            console.error = (...args) => {
                                outputElement.textContent += '[ERROR] ' + args.join(' ') + '\\n';
                            };
                            try {
                                ${fileContent}
                            } catch (err) {
                                outputElement.innerHTML += '<span style="color: #f48771;">' + err.message + '</span>';
                            }
                        </script>
                    </body>
                    </html>
                `;
            } 
            else if (foundFile.type === 'py') {
                panel.webview.html = `
                    <html>
                    <body style="font-family: monospace; padding: 15px; background: #1e1e1e; color: #d4d4d4;">
                        <h3 style="color: #4fc1ff; margin-top: 0;">Python WebAssembly Runtime:</h3>
                        <pre id="python-output" style="white-space: pre-wrap; font-size: 13px; line-height: 1.5;">Initializing Pyodide WASM Core Environment...</pre>
                        <script src="https://cdnjs.cloudflare.com/ajax/libs/pyodide/0.26.1/pyodide.js"></script>
                        <script>
                            async function runPythonScript() {
                                const out = document.getElementById('python-output');
                                try {
                                    let pyodide = await loadPyodide();
                                    out.textContent = "Pyodide Loaded successfully.\\n\\n--- Output ---\\n";
                                    pyodide.setStdout({
                                        batched: (text) => { out.textContent += text + '\\n'; }
                                    });
                                    await pyodide.runPythonAsync(\`${fileContent.replace(/`/g, '\\`').replace(/\$/g, '\\$')}\`);
                                } catch (err) {
                                    out.innerHTML += '<span style="color: #f48771;">\\n[Python Error]: ' + err.message + '</span>';
                                }
                            }
                            runPythonScript();
                        </script>
                    </body>
                    </html>
                `;
            }

        } catch (globalError) {
            vscode.window.showErrorMessage('Runner Error: ' + globalError.message);
        }
    });

    context.subscriptions.push(disposable);
}

function deactivate() {}

module.exports = {
    activate,
    deactivate
}
