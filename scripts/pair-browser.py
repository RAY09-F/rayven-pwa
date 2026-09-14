"""Provision browser transport without printing the secret. Run with --apply at release."""
import argparse
import json
import secrets
import shutil
import subprocess
from pathlib import Path

ROOT=Path(__file__).resolve().parents[1]
WRANGLER=Path(r'C:\Asgard\tools\node_modules\wrangler\bin\wrangler.js')
NODE=Path(r'C:\Asgard\tools\node-v24.13.0-win-x64\node.exe')
DEST=ROOT.parent/'ASGARD-Browser-Control'

def main():
    parser=argparse.ArgumentParser();parser.add_argument('--apply',action='store_true');args=parser.parse_args()
    if not args.apply:
        print('Plan: configure BROWSER_CONTROL_TOKEN, write ignored pairing file, update installed browser extension. Chrome extension reload remains required.');return
    if not (DEST/'manifest.json').is_file():raise RuntimeError('Installed extension folder not found')
    pairing=ROOT/'browser-pairing.js'
    prefix='globalThis.ASGARD_BROWSER_TOKEN = '
    token=json.loads(pairing.read_text().removeprefix(prefix).strip().removesuffix(';')) if pairing.exists() else secrets.token_hex(32)
    if not isinstance(token,str) or len(token)!=64:raise RuntimeError('Invalid pairing file')
    result=subprocess.run([str(NODE),str(WRANGLER),'secret','put','BROWSER_CONTROL_TOKEN'],input=token+'\n',text=True,encoding='utf-8',errors='replace',cwd=ROOT,stdout=subprocess.PIPE,stderr=subprocess.PIPE)
    if result.returncode:raise RuntimeError('Cloudflare secret update failed; no extension files changed. Check Wrangler login.')
    pairing.write_text(prefix+json.dumps(token)+';\n',encoding='utf-8')
    backup=Path(r'C:\Asgard\backups\everything-20260914\browser-before-pairing');backup.mkdir(parents=True,exist_ok=True)
    for name in ['background.js','manifest.json']:
        if not (backup/name).exists():shutil.copy2(DEST/name,backup/name)
        shutil.copy2(ROOT/name,DEST/name)
    shutil.copy2(pairing,DEST/pairing.name)
    print('Pairing provisioned and extension files installed. Reload ASGARD Browser Control in chrome://extensions before authenticated Worker release. No secret was printed.')

if __name__=='__main__':main()
