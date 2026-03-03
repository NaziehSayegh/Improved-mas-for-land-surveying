export const customConfirm = (message) => {
    return new Promise((resolve) => {
        const overlay = document.createElement('div');
        overlay.style.cssText = `
      position: fixed; top: 0; left: 0; right: 0; bottom: 0;
      background: rgba(0, 0, 0, 0.75); z-index: 10000;
      display: flex; align-items: center; justify-content: center;
    `;
        const dialog = document.createElement('div');
        dialog.style.cssText = `
      background: #161b22; border: 1px solid #30363d; border-radius: 12px;
      padding: 24px; max-width: min(400px, 90vw); width: 100%;
      box-shadow: 0 8px 32px rgba(0, 0, 0, 0.5); margin: 16px; text-align: center;
    `;
        dialog.innerHTML = `
      <h2 style="color: #c9d1d9; font-size: 18px; font-weight: bold; margin-bottom: 16px;">Confirmation</h2>
      <p style="color: #8b949e; margin-bottom: 24px; line-height: 1.5; white-space: pre-wrap;">${message.replace(/\n/g, '<br/>')}</p>
      <div style="display: flex; gap: 12px; justify-content: center;">
        <button id="custom-confirm-cancel" style="background: #21262d; border: 1px solid #30363d; color: #c9d1d9; padding: 8px 24px; border-radius: 6px; cursor: pointer; font-weight: 500;">Cancel</button>
        <button id="custom-confirm-ok" style="background: #238636; border: 1px solid #238636; color: white; padding: 8px 24px; border-radius: 6px; cursor: pointer; font-weight: 500;">OK</button>
      </div>
    `;
        overlay.appendChild(dialog);
        document.body.appendChild(overlay);

        const cleanup = () => document.body.removeChild(overlay);

        document.getElementById('custom-confirm-ok').onclick = () => { cleanup(); resolve(true); };
        document.getElementById('custom-confirm-cancel').onclick = () => { cleanup(); resolve(false); };
    });
};

export const customPrompt = (message, defaultValue = '') => {
    return new Promise((resolve) => {
        const overlay = document.createElement('div');
        overlay.style.cssText = `
      position: fixed; top: 0; left: 0; right: 0; bottom: 0;
      background: rgba(0, 0, 0, 0.75); z-index: 10000;
      display: flex; align-items: center; justify-content: center;
    `;
        const dialog = document.createElement('div');
        dialog.style.cssText = `
      background: #161b22; border: 1px solid #30363d; border-radius: 12px;
      padding: 24px; max-width: min(400px, 90vw); width: 100%;
      box-shadow: 0 8px 32px rgba(0, 0, 0, 0.5); margin: 16px;
    `;
        dialog.innerHTML = `
      <h2 style="color: #c9d1d9; font-size: 18px; font-weight: bold; margin-bottom: 16px;">${message}</h2>
      <input type="text" id="custom-prompt-input" value="${defaultValue}" style="width: 100%; background: #0d1117; border: 1px solid #30363d; color: #c9d1d9; padding: 10px; border-radius: 6px; margin-bottom: 24px; outline: none;" />
      <div style="display: flex; gap: 12px; justify-content: flex-end;">
        <button id="custom-prompt-cancel" style="background: #21262d; border: 1px solid #30363d; color: #c9d1d9; padding: 8px 16px; border-radius: 6px; cursor: pointer; font-weight: 500;">Cancel</button>
        <button id="custom-prompt-ok" style="background: #238636; border: 1px solid #238636; color: white; padding: 8px 16px; border-radius: 6px; cursor: pointer; font-weight: 500;">OK</button>
      </div>
    `;
        overlay.appendChild(dialog);
        document.body.appendChild(overlay);

        const input = document.getElementById('custom-prompt-input');
        input.focus();
        input.select();

        const cleanup = () => document.body.removeChild(overlay);

        document.getElementById('custom-prompt-ok').onclick = () => { cleanup(); resolve(input.value); };
        document.getElementById('custom-prompt-cancel').onclick = () => { cleanup(); resolve(null); };

        input.addEventListener('keydown', (e) => {
            if (e.key === 'Enter') { cleanup(); resolve(input.value); }
            if (e.key === 'Escape') { cleanup(); resolve(null); }
        });
    });
};
