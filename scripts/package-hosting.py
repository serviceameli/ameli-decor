#!/usr/bin/env python3
"""Package the static site for the 25 MB / 50 MB / 500 file ZIP host.

Images remain on the existing public image host. Fonts, JavaScript and CSS are
included locally. Run after publishing the matching content to GitHub Pages.
"""
import argparse
import hashlib
import json
import pathlib
import re
import shutil
import tempfile
import urllib.parse
import urllib.request
import zipfile

ROOT = pathlib.Path(__file__).resolve().parents[1]
parser = argparse.ArgumentParser(description=__doc__)
parser.add_argument('--images-base', default='https://serviceameli.github.io/ameli-decor/')
parser.add_argument('--output', type=pathlib.Path, default=ROOT / 'release' / 'ameli-decor.zip')
args = parser.parse_args()
base = args.images_base.rstrip('/') + '/'
url = urllib.parse.urlsplit(base)
if url.scheme != 'https' or not url.netloc or url.query or url.fragment:
    raise SystemExit('Image host must be an HTTPS URL without query or fragment.')
dist = ROOT / 'dist'
data = json.loads((dist / 'content.json').read_text(encoding='utf-8'))
fingerprint = hashlib.sha256((dist / 'content.json').read_bytes()).hexdigest()[:12]

# Do not produce a ZIP pointing at photographs that have not been published yet.
with urllib.request.urlopen(base + 'content.json?v=' + fingerprint, timeout=30) as response:
    published = json.load(response)
if published != data:
    raise SystemExit('Publish the latest content to the image host and wait for deployment first.')
image_paths = sorted(p.relative_to(dist).as_posix() for p in (dist / 'assets').rglob('*') if p.is_file())
sample = next(p for p in image_paths if p.endswith('.jpg'))
request = urllib.request.Request(urllib.parse.urljoin(base, sample), method='HEAD')
with urllib.request.urlopen(request, timeout=30) as response:
    if response.headers.get('Access-Control-Allow-Origin') != '*':
        raise SystemExit('Image host must allow cross-origin image downloads for PDF export.')

def rewrite(value):
    if isinstance(value, str) and value.startswith('assets/'):
        return urllib.parse.urljoin(base, value)
    if isinstance(value, list):
        return [rewrite(item) for item in value]
    if isinstance(value, dict):
        return {rewrite(key): rewrite(item) for key, item in value.items()}
    return value

content = json.dumps(rewrite(data), ensure_ascii=False, separators=(',', ':'))
version = hashlib.sha256((content + (dist / 'app.js').read_text()).encode()).hexdigest()[:12]
output = args.output.expanduser().resolve()
output.parent.mkdir(parents=True, exist_ok=True)
with tempfile.TemporaryDirectory(prefix='ameli-hosting-') as temporary:
    stage = pathlib.Path(temporary)
    for source in sorted(dist.rglob('*')):
        relative = source.relative_to(dist)
        if not source.is_file() or relative.parts[0] == 'assets' or source.name == 'content.json':
            continue
        target = stage / relative
        # Plain .js avoids hosts that serve .mjs as application/octet-stream.
        if target.suffix == '.mjs':
            target = target.with_suffix('.js')
        target.parent.mkdir(parents=True, exist_ok=True)
        if source.suffix in {'.js', '.mjs', '.html', '.css'}:
            text = source.read_text(encoding='utf-8')
            text = text.replace('./model.mjs', './model.js').replace('./pdf.mjs', './pdf.js')
            text = re.sub(r'\?v=[0-9a-f]{12}', '?v=' + version, text)
            target.write_text(text, encoding='utf-8')
        else:
            shutil.copyfile(source, target)
    (stage / 'content.json').write_text(content, encoding='utf-8')
    files = sorted(p for p in stage.rglob('*') if p.is_file())
    expanded = sum(p.stat().st_size for p in files)
    assert (stage / 'index.html').read_text(encoding='utf-8').startswith('<!doctype html>')
    assert len(files) <= 500 and expanded <= 50_000_000, 'Host unpacked limits exceeded'
    candidate = stage / 'site.zip'
    with zipfile.ZipFile(candidate, 'w', compression=zipfile.ZIP_DEFLATED, compresslevel=9) as archive:
        for file in files:
            archive.write(file, file.relative_to(stage).as_posix())
    assert candidate.stat().st_size <= 25_000_000, 'Host ZIP limit exceeded'
    with zipfile.ZipFile(candidate) as archive:
        assert archive.testzip() is None
    shutil.copyfile(candidate, output)
manifest = {
    'version': version, 'files': len(files), 'zipBytes': output.stat().st_size,
    'expandedBytes': expanded, 'imageFilesOnExternalHost': len(image_paths),
    'imageHost': base, 'publishedContentMatches': True, 'pdfImageCors': True,
    'archive': str(output),
}
output.with_suffix('.json').write_text(json.dumps(manifest, ensure_ascii=False, indent=2) + '\n', encoding='utf-8')
print(json.dumps(manifest, ensure_ascii=False, indent=2))
