# -*- mode: python ; coding: utf-8 -*-


a = Analysis(
    ['E:/Devin/keylight/main.py'],
    pathex=[],
    binaries=[],
    datas=[('E:/Devin/keylight/index.html', '.'), ('E:/Devin/keylight/style.css', '.'), ('E:/Devin/keylight/app.js', '.'), ('E:/Devin/keylight/favicon.svg', '.'), ('E:/Devin/keylight/icon.ico', '.')],
    hiddenimports=['clr_loader', 'pythonnet', 'webview', 'http.server'],
    hookspath=[],
    hooksconfig={},
    runtime_hooks=[],
    excludes=[],
    noarchive=False,
    optimize=0,
)
pyz = PYZ(a.pure)

exe = EXE(
    pyz,
    a.scripts,
    a.binaries,
    a.datas,
    [],
    name='LuminaKeylight',
    debug=False,
    bootloader_ignore_signals=False,
    strip=False,
    upx=True,
    upx_exclude=[],
    runtime_tmpdir=None,
    console=False,
    disable_windowed_traceback=False,
    argv_emulation=False,
    target_arch=None,
    codesign_identity=None,
    entitlements_file=None,
    icon=['E:/Devin/keylight/icon.ico'],
)
