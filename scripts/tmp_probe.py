import runpy, json
mod = runpy.run_path('scripts/mempalace_bridge.py')
res = mod['import_mempalace']()
print(json.dumps(res, ensure_ascii=False, indent=2))
