"""Usage: python3 -I scripts/snapshot-canvas-views.py <export.json|export.csv> supabase/view-snapshots
Write one .sql file per view plus a columns.json contract from the snapshot query output."""
import csv, json, os, shutil, sys
src, out = sys.argv[1], sys.argv[2]
if src.endswith('.csv'):  # Supabase SQL Editor export
    rows = list(csv.DictReader(open(src, newline='', encoding='utf-8')))
else:
    raw = open(src).read()
    data = json.loads(raw[raw.index('['):raw.rindex(']') + 1])
    rows = data if isinstance(data, list) else data.get('rows', [])
if os.path.isdir(out):
    shutil.rmtree(out)
contract = {}
for r in rows:
    d = os.path.join(out, r['schema'])
    os.makedirs(d, exist_ok=True)
    cols = r['columns'] if isinstance(r['columns'], list) else json.loads(r['columns'] or '[]')
    with open(os.path.join(d, r['name'] + '.sql'), 'w') as f:
        f.write(f"-- {r['schema']}.{r['name']} ({r['kind']}) — live definition snapshot, do not apply\n")
        for c in cols:
            f.write(f"--   {c['column']}: {c['type']}\n")
        f.write(f"CREATE OR REPLACE VIEW {r['schema']}.{r['name']} AS\n{r['definition'].rstrip()}\n")
    contract[f"{r['schema']}.{r['name']}"] = cols
with open(os.path.join(out, 'columns.json'), 'w') as f:
    json.dump(contract, f, indent=1, sort_keys=True)
print(f"{len(rows)} views written to {out}")
