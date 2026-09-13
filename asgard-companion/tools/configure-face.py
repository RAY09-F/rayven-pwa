"""Copy the thin extension and generate a local-only pairing file."""
import json,shutil,sys
from pathlib import Path
sys.path.insert(0,str(Path(__file__).resolve().parents[1]))
from config import Config,ROOT
source=Path(sys.argv[1]);dest=ROOT.parent/'asgard-face'
if source.resolve()!=dest.resolve():shutil.copytree(source,dest,dirs_exist_ok=True,ignore=shutil.ignore_patterns('pairing.js'))
if not (dest/'manifest.json').exists():raise RuntimeError('Extension source is missing')
(dest/'pairing.js').write_text('// Local-only pairing; never share or commit.\nglobalThis.ASGARD_PAIRING='+json.dumps(Config().secrets['local_token'])+';',encoding='utf-8')
print('Chrome face prepared and paired locally.')
