"""Deploy the existing release checkout with a local token, never printing secrets."""
import json,os,subprocess
from pathlib import Path
root=Path(r'C:\Asgard\companion')
repo=Path(r'C:\Users\Hoengager\Desktop\ASGARD\rayven-warden-release')
node=Path(r'C:\Asgard\tools\node-v24.13.0-win-x64\node.exe')
wrangler=Path(r'C:\Asgard\tools\node_modules\wrangler\bin\wrangler.js')
token=json.loads((root/'secrets.json').read_text())['local_token']
for args,stdin in [(['secret','put','ASGARD_COMPANION_TOKEN'],token+'\n'),(['deploy'],None)]:
    r=subprocess.run([str(node),str(wrangler),*args],cwd=repo,input=stdin,encoding='utf-8',errors='replace',capture_output=True)
    print(r.stdout);print(r.stderr)
    if r.returncode:raise SystemExit(r.returncode)
